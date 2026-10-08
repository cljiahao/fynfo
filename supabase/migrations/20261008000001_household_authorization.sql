-- Spec071: preserve records while enforcing household authorization in PostgreSQL.
BEGIN;

LOCK TABLE public.household_members IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.household_members GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'household migration blocked: reconcile duplicate memberships before retry';
  END IF;
  IF EXISTS (SELECT 1 FROM public.household_members GROUP BY household_id HAVING count(*) > 2) THEN
    RAISE EXCEPTION 'household migration blocked: reconcile household capacity before retry';
  END IF;
END;
$$;
ALTER TABLE public.household_members ADD CONSTRAINT household_members_one_household_per_user UNIQUE (user_id);

CREATE OR REPLACE FUNCTION public.enforce_household_member_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  -- A row version also makes stale REPEATABLE READ writers fail safely.
  UPDATE public.households SET name = name WHERE id = NEW.household_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'household not valid'; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT count(*) INTO v_count FROM public.household_members
      WHERE household_id = NEW.household_id AND id <> OLD.id;
  ELSE
    SELECT count(*) INTO v_count FROM public.household_members WHERE household_id = NEW.household_id;
  END IF;
  IF v_count >= 2 THEN RAISE EXCEPTION 'household is full'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_household_member_cap() FROM PUBLIC, authenticated, anon;
DROP TRIGGER trg_household_member_cap ON public.household_members;
CREATE TRIGGER trg_household_member_cap BEFORE INSERT OR UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_household_member_cap();

CREATE FUNCTION public.is_household_owner(p_household_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = auth.uid() AND role = 'owner');
$$;
REVOKE ALL ON FUNCTION public.is_household_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;

DROP POLICY "Owner self-inserts member" ON public.household_members;
CREATE POLICY "Owner self-inserts member" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'owner' AND EXISTS (
    SELECT 1 FROM public.households h WHERE h.id = household_id AND h.created_by = auth.uid()));
REVOKE UPDATE ON public.household_members FROM authenticated, anon;
REVOKE UPDATE ON public.households FROM authenticated, anon;
GRANT UPDATE (name) ON public.households TO authenticated;

DROP POLICY "Members manage invites" ON public.household_invites;
CREATE POLICY "Owner reads invites" ON public.household_invites FOR SELECT TO authenticated
  USING (public.is_household_owner(household_id));
CREATE POLICY "Owner creates invites" ON public.household_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_household_owner(household_id) AND created_by = auth.uid() AND consumed_at IS NULL);
CREATE POLICY "Owner deletes invites" ON public.household_invites FOR DELETE TO authenticated
  USING (public.is_household_owner(household_id));
REVOKE UPDATE ON public.household_invites FROM authenticated, anon;

REVOKE ALL ON FUNCTION public.consume_household_invite(uuid, uuid, text) FROM PUBLIC, authenticated, anon;
CREATE FUNCTION public.consume_household_invite(
  p_invite_id uuid, p_user_id uuid, p_wrapped_kh text, p_code_hash text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household_id uuid; v_invite public.household_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$'
     OR p_wrapped_kh IS NULL OR length(p_wrapped_kh) = 0 THEN
    RAISE EXCEPTION 'invite not valid';
  END IF;
  SELECT household_id INTO v_household_id FROM public.household_invites
    WHERE id = p_invite_id AND invite_code_hash = p_code_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not valid'; END IF;
  -- All membership writers share this lock before checking capacity.
  UPDATE public.households SET name = name WHERE id = v_household_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not valid'; END IF;
  SELECT * INTO v_invite FROM public.household_invites
    WHERE id = p_invite_id AND household_id = v_household_id AND invite_code_hash = p_code_hash
      AND consumed_at IS NULL AND expires_at > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not valid'; END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'user already belongs to a household';
  END IF;
  INSERT INTO public.household_members (household_id, user_id, role, wrapped_kh)
    VALUES (v_household_id, p_user_id, 'member', p_wrapped_kh);
  UPDATE public.household_invites SET consumed_at = clock_timestamp() WHERE id = p_invite_id;
  RETURN v_household_id;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_household_invite(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_household_invite(uuid, uuid, text, text) TO authenticated;
COMMIT;
