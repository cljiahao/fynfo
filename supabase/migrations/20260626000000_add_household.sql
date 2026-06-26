------------------------------------------
-- Two-person household: membership + key-wrapping foundation (spec 053).
-- Authorized by specs/governance/052 (constitution v3.0, §1.1/§2.3/§5.1a).
--
-- A household links exactly two accounts. A single random household key K_h
-- (held only client/server-session-side) encrypts household data; each member
-- stores K_h *wrapped* under their own PIN-derived DEK (household_members.
-- wrapped_kh). The server never persists raw K_h. A one-time invite carries K_h
-- to the second member, wrapped under a secret-derived key, hashed at rest.
--
-- Idempotent — safe to re-run.
------------------------------------------

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,                       -- plaintext, non-sensitive
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  wrapped_kh   TEXT NOT NULL,                     -- K_h sealed under this member's DEK
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);

CREATE TABLE IF NOT EXISTS public.household_invites (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invite_code_hash       TEXT NOT NULL,           -- SHA-256 hex of the one-time secret
  kdf_salt               TEXT NOT NULL,           -- base64 PBKDF2 salt
  wrapped_kh_under_invite TEXT NOT NULL,          -- K_h sealed under the secret-derived key
  created_by             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at             TIMESTAMPTZ NOT NULL,
  consumed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_invites_code ON public.household_invites(invite_code_hash);

-- ── Membership helper (SECURITY DEFINER avoids RLS self-recursion) ──────────
-- A policy on household_members that itself selects household_members triggers
-- "infinite recursion detected in policy". This definer function runs as owner
-- (bypasses RLS), so policies can call it safely.

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_member(UUID) TO authenticated;

-- ── Two-member cap ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_household_member_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.household_members
        WHERE household_id = NEW.household_id) >= 2 THEN
    RAISE EXCEPTION 'household is full';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_member_cap ON public.household_members;
CREATE TRIGGER trg_household_member_cap
  BEFORE INSERT ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_household_member_cap();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- households: members see/edit/delete; only the creator inserts.
DROP POLICY IF EXISTS "Members read own household" ON public.households;
CREATE POLICY "Members read own household" ON public.households
  FOR SELECT USING (public.is_household_member(id));
DROP POLICY IF EXISTS "Creator inserts household" ON public.households;
CREATE POLICY "Creator inserts household" ON public.households
  FOR INSERT WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Members update own household" ON public.households;
CREATE POLICY "Members update own household" ON public.households
  FOR UPDATE USING (public.is_household_member(id));
DROP POLICY IF EXISTS "Members delete own household" ON public.households;
CREATE POLICY "Members delete own household" ON public.households
  FOR DELETE USING (public.is_household_member(id));

-- household_members: members see the roster; only the OWNER self-inserts
-- directly (the second member joins via the consume RPC, which is definer).
-- A member may delete only their own row (leave).
DROP POLICY IF EXISTS "Members read roster" ON public.household_members;
CREATE POLICY "Members read roster" ON public.household_members
  FOR SELECT USING (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Owner self-inserts member" ON public.household_members;
CREATE POLICY "Owner self-inserts member" ON public.household_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_id AND h.created_by = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Member leaves own row" ON public.household_members;
CREATE POLICY "Member leaves own row" ON public.household_members
  FOR DELETE USING (user_id = auth.uid());

-- household_invites: only members of the household manage invites. The accepter
-- (not yet a member) never selects this table directly — they use the RPCs.
DROP POLICY IF EXISTS "Members manage invites" ON public.household_invites;
CREATE POLICY "Members manage invites" ON public.household_invites
  FOR ALL
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_invites TO authenticated;

-- ── Invite-accept bootstrap (two-step, SECURITY DEFINER) ────────────────────
-- The accepter is not yet a member, so RLS blocks a direct invite read. Step 1
-- validates the invite and returns only what the action needs to re-wrap K_h
-- under the accepter's own DEK (in app code — the RPC never sees a DEK or raw
-- K_h). Step 2 atomically inserts the member row + consumes the invite,
-- re-asserting the cap to close the TOCTOU window.

CREATE OR REPLACE FUNCTION public.accept_household_invite(p_code_hash TEXT)
RETURNS TABLE (
  invite_id               UUID,
  household_id            UUID,
  wrapped_kh_under_invite TEXT,
  kdf_salt                TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
    SELECT i.id, i.household_id, i.wrapped_kh_under_invite, i.kdf_salt
      FROM public.household_invites i
      WHERE i.invite_code_hash = p_code_hash
        AND i.consumed_at IS NULL
        AND i.expires_at > now()
      LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not valid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_household_invite(
  p_invite_id  UUID,
  p_user_id    UUID,
  p_wrapped_kh TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.household_invites%ROWTYPE;
  v_count  integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_invite
    FROM public.household_invites
    WHERE id = p_invite_id
      AND consumed_at IS NULL
      AND expires_at > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not valid';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.household_members
    WHERE household_id = v_invite.household_id;
  IF v_count >= 2 THEN
    RAISE EXCEPTION 'household is full';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role, wrapped_kh)
    VALUES (v_invite.household_id, p_user_id, 'member', p_wrapped_kh);

  UPDATE public.household_invites
    SET consumed_at = now()
    WHERE id = p_invite_id;

  RETURN v_invite.household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_household_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_household_invite(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_household_invite(UUID, UUID, TEXT) TO authenticated;
