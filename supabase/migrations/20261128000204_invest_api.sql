-- Spec 204 slice S1: investment API schema (callers, Ed25519 keys, sealed summaries,
-- append-only sealed journal, replay nonces, audit) and service_role-only RPCs.
--
-- Rollback (manual; needs a backup spec per constitution 6.3 before running in production):
--   DROP the invest_api_* functions, then the tables in this order: invest_journal,
--   invest_summaries, invest_api_keys, invest_api_audit, invest_api_nonces,
--   invest_journal_keys, invest_api_callers.
BEGIN;

CREATE TABLE public.invest_api_callers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name ~ '^[a-z][a-z0-9_-]{1,31}$'),
  -- Raw 32-byte X25519 key, base64 (44 chars). Summaries are sealed to it.
  x25519_public_key text NOT NULL CHECK (x25519_public_key ~ '^[A-Za-z0-9+/]{43}=$'),
  -- Scopes are fixed per caller; every key issued to it inherits them.
  scopes text[] NOT NULL CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY['summary:read', 'journal:meta', 'journal:append:plan',
                        'journal:append:sell_flag', 'journal:append:verdict']::text[]
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, name)
);

CREATE TABLE public.invest_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.invest_api_callers(id) ON DELETE CASCADE,
  -- Raw 32-byte Ed25519 public key, base64 (44 chars). No secret is ever stored.
  public_key text NOT NULL CHECK (length(public_key) = 44),
  scopes text[] NOT NULL CHECK (
    cardinality(scopes) > 0
    AND scopes <@ ARRAY['summary:read', 'journal:meta', 'journal:append:plan',
                        'journal:append:sell_flag', 'journal:append:verdict']::text[]
  ),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invest_api_keys_caller ON public.invest_api_keys(caller_id);

CREATE TABLE public.invest_api_nonces (
  signature_hash text PRIMARY KEY CHECK (length(signature_hash) = 64),
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_invest_api_nonces_expiry ON public.invest_api_nonces(expires_at);

-- No payload, signature or body columns: the audit trail is metadata only.
CREATE TABLE public.invest_api_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caller_id uuid,
  key_id uuid,
  endpoint text NOT NULL CHECK (length(endpoint) <= 64),
  status smallint NOT NULL CHECK (status BETWEEN 100 AND 599),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invest_api_audit_created ON public.invest_api_audit(created_at);

CREATE TABLE public.invest_summaries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.invest_api_callers(id) ON DELETE CASCADE,
  sealed text NOT NULL CHECK (length(sealed) <= 8192),
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (caller_id)
);
CREATE INDEX idx_invest_summaries_user ON public.invest_summaries(user_id);

CREATE TABLE public.invest_journal_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key text NOT NULL CHECK (length(public_key) = 44),
  -- Private key encrypted under the user's DEK; the server never sees it in the clear.
  wrapped_private_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invest_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NO ACTION (not RESTRICT) so deleting the user can cascade to callers and journal together.
  caller_id uuid NOT NULL REFERENCES public.invest_api_callers(id),
  event_type text NOT NULL CHECK (event_type IN ('plan', 'sell_flag', 'verdict')),
  occurred_at timestamptz NOT NULL,
  sealed text NOT NULL CHECK (length(sealed) <= 16384),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_invest_journal_user_created ON public.invest_journal(user_id, created_at);

-- At most two active keys per caller; locking the caller row serializes concurrent inserts.
CREATE FUNCTION public.enforce_invest_key_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_active integer;
BEGIN
  IF NEW.revoked_at IS NOT NULL OR NEW.expires_at <= clock_timestamp() THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.invest_api_callers WHERE id = NEW.caller_id FOR UPDATE;
  SELECT count(*) INTO v_active FROM public.invest_api_keys
    WHERE caller_id = NEW.caller_id AND id <> NEW.id
      AND revoked_at IS NULL AND expires_at > clock_timestamp();
  IF v_active >= 2 THEN RAISE EXCEPTION 'caller already has two active keys'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_invest_key_cap() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER invest_api_keys_cap
  BEFORE INSERT OR UPDATE OF revoked_at, expires_at ON public.invest_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invest_key_cap();

-- Defense in depth behind the missing UPDATE/DELETE grants. Deletion is allowed only when the
-- owning user is already gone, so account deletion still cascades.
CREATE FUNCTION public.invest_journal_append_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'invest_journal is append-only';
END;
$$;
REVOKE ALL ON FUNCTION public.invest_journal_append_only() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER invest_journal_no_update_delete
  BEFORE UPDATE OR DELETE ON public.invest_journal
  FOR EACH ROW EXECUTE FUNCTION public.invest_journal_append_only();

ALTER TABLE public.invest_api_callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_api_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_api_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_journal_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_journal ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.invest_api_callers, public.invest_api_keys, public.invest_api_nonces,
  public.invest_api_audit, public.invest_summaries, public.invest_journal_keys,
  public.invest_journal FROM PUBLIC, anon, authenticated, service_role;

-- Owner reads only where the UI needs them. All writes go through the RPCs below.
GRANT SELECT ON public.invest_api_callers, public.invest_api_keys,
  public.invest_journal_keys, public.invest_journal TO authenticated;

CREATE POLICY "Owner reads callers" ON public.invest_api_callers
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner reads keys" ON public.invest_api_keys
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.invest_api_callers c
    WHERE c.id = invest_api_keys.caller_id AND c.user_id = (SELECT auth.uid())));
CREATE POLICY "Owner reads journal keys" ON public.invest_journal_keys
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner reads journal" ON public.invest_journal
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Tables with no client access still carry an explicit deny policy.
CREATE POLICY "No client access" ON public.invest_api_nonces
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client access" ON public.invest_api_audit
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client access" ON public.invest_summaries
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Unknown, expired and revoked keys (or revoked callers) return zero rows; callers of this RPC
-- must map that to the same 401 as any other auth failure.
CREATE FUNCTION public.invest_api_authenticate(p_key_id uuid)
RETURNS TABLE (caller_id uuid, user_id uuid, caller_name text, public_key text, scopes text[])
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, c.user_id, c.name, k.public_key, k.scopes
  FROM public.invest_api_keys k
  JOIN public.invest_api_callers c ON c.id = k.caller_id
  WHERE k.id = p_key_id
    AND k.revoked_at IS NULL AND k.expires_at > clock_timestamp()
    AND c.revoked_at IS NULL;
$$;

-- Returns false for a replayed signature hash.
CREATE FUNCTION public.invest_api_consume_nonce(p_hash text, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_inserted integer;
BEGIN
  IF p_hash IS NULL OR length(p_hash) <> 64 OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'invalid nonce';
  END IF;
  DELETE FROM public.invest_api_nonces WHERE signature_hash = p_hash AND expires_at <= clock_timestamp();
  INSERT INTO public.invest_api_nonces(signature_hash, expires_at) VALUES (p_hash, p_expires_at)
    ON CONFLICT (signature_hash) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted = 1;
END;
$$;

CREATE FUNCTION public.invest_api_get_summary(p_caller_id uuid)
RETURNS TABLE (sealed text, published_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.sealed, s.published_at FROM public.invest_summaries s
  JOIN public.invest_api_callers c ON c.id = s.caller_id
  WHERE s.caller_id = p_caller_id AND c.revoked_at IS NULL;
$$;

CREATE FUNCTION public.invest_api_get_journal_public_key(p_caller_id uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jk.public_key FROM public.invest_api_callers c
  JOIN public.invest_journal_keys jk ON jk.user_id = c.user_id
  WHERE c.id = p_caller_id AND c.revoked_at IS NULL;
$$;

CREATE FUNCTION public.invest_api_append_journal(
  p_caller_id uuid, p_event_type text, p_occurred_at timestamptz, p_sealed text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
  v_id uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.invest_api_callers
    WHERE id = p_caller_id AND revoked_at IS NULL;
  IF v_user IS NULL THEN RAISE EXCEPTION 'invalid caller'; END IF;
  INSERT INTO public.invest_journal(user_id, caller_id, event_type, occurred_at, sealed)
    VALUES (v_user, p_caller_id, p_event_type, p_occurred_at, p_sealed)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Pages on the (created_at, id) tuple so rows sharing a timestamp are never skipped; the next
-- page starts from the last row returned. created_at is clock_timestamp(), so it is unique in
-- practice and strictly increases across commits in one session.
CREATE FUNCTION public.invest_api_journal_meta(
  p_user_id uuid, p_since_created_at timestamptz, p_since_id uuid)
RETURNS TABLE (id uuid, caller text, event_type text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT j.id, c.name, j.event_type, j.created_at
  FROM public.invest_journal j
  JOIN public.invest_api_callers c ON c.id = j.caller_id
  WHERE j.user_id = p_user_id
    AND (j.created_at, j.id) > (
      coalesce(p_since_created_at, '-infinity'::timestamptz),
      coalesce(p_since_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ORDER BY j.created_at, j.id
  LIMIT 500;
$$;

CREATE FUNCTION public.invest_api_audit_write(
  p_caller_id uuid, p_key_id uuid, p_endpoint text, p_status integer)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.invest_api_audit(caller_id, key_id, endpoint, status)
  VALUES (p_caller_id, p_key_id, left(p_endpoint, 64), p_status::smallint);
$$;

-- Publish and prune run from trusted server code (unlocked-session action, scheduled job).
CREATE FUNCTION public.invest_api_publish_summary(p_user_id uuid, p_caller_id uuid, p_sealed text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.invest_api_callers
    WHERE id = p_caller_id AND user_id = p_user_id AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid caller'; END IF;
  INSERT INTO public.invest_summaries(user_id, caller_id, sealed, published_at)
    VALUES (p_user_id, p_caller_id, p_sealed, now())
    ON CONFLICT (caller_id) DO UPDATE SET sealed = EXCLUDED.sealed, published_at = EXCLUDED.published_at;
END;
$$;

CREATE FUNCTION public.invest_api_prune()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM public.invest_api_nonces WHERE expires_at <= clock_timestamp();
  DELETE FROM public.invest_api_audit WHERE created_at < now() - interval '90 days';
$$;

-- Caller management. Every RPC takes the acting user and acts only on callers that user owns;
-- a foreign or revoked caller raises (or returns false) without changing anything.
CREATE FUNCTION public.invest_api_create_caller(
  p_user_id uuid, p_name text, p_scopes text[], p_caller_public_key text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_name IS NULL OR p_scopes IS NULL OR p_caller_public_key IS NULL THEN
    RAISE EXCEPTION 'invalid caller';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'invalid caller';
  END IF;
  IF cardinality(p_scopes) = 0 OR NOT p_scopes <@ ARRAY['summary:read', 'journal:meta',
       'journal:append:plan', 'journal:append:sell_flag', 'journal:append:verdict']::text[] THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;
  IF p_caller_public_key !~ '^[A-Za-z0-9+/]{43}=$' THEN
    RAISE EXCEPTION 'invalid public key';
  END IF;
  INSERT INTO public.invest_api_callers(user_id, name, scopes, x25519_public_key)
    VALUES (p_user_id, p_name, p_scopes, p_caller_public_key)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The 90-day expiry is set here, never by the client. The key-cap trigger enforces two active keys.
CREATE FUNCTION public.invest_api_add_key(
  p_user_id uuid, p_caller_id uuid, p_signing_public_key text)
RETURNS TABLE (key_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_scopes text[];
  v_key uuid;
  v_expires timestamptz := now() + interval '90 days';
BEGIN
  IF p_signing_public_key IS NULL OR p_signing_public_key !~ '^[A-Za-z0-9+/]{43}=$' THEN
    RAISE EXCEPTION 'invalid public key';
  END IF;
  SELECT c.scopes INTO v_scopes FROM public.invest_api_callers c
    WHERE c.id = p_caller_id AND c.user_id = p_user_id AND c.revoked_at IS NULL;
  IF v_scopes IS NULL THEN RAISE EXCEPTION 'invalid caller'; END IF;
  INSERT INTO public.invest_api_keys(caller_id, public_key, scopes, expires_at)
    VALUES (p_caller_id, p_signing_public_key, v_scopes, v_expires)
    RETURNING id INTO v_key;
  RETURN QUERY SELECT v_key, v_expires;
END;
$$;

CREATE FUNCTION public.invest_api_revoke_key(p_user_id uuid, p_key_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_changed integer;
BEGIN
  UPDATE public.invest_api_keys k SET revoked_at = now()
    WHERE k.id = p_key_id AND k.revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM public.invest_api_callers c
                  WHERE c.id = k.caller_id AND c.user_id = p_user_id);
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

CREATE FUNCTION public.invest_api_revoke_caller(p_user_id uuid, p_caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_changed integer;
BEGIN
  UPDATE public.invest_api_callers SET revoked_at = now()
    WHERE id = p_caller_id AND user_id = p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 0 THEN RETURN false; END IF;
  UPDATE public.invest_api_keys SET revoked_at = now()
    WHERE caller_id = p_caller_id AND revoked_at IS NULL;
  DELETE FROM public.invest_summaries WHERE caller_id = p_caller_id;
  RETURN true;
END;
$$;

-- Deleting the summary in the same transaction means a ciphertext sealed to the old key is
-- never served after the key changes.
CREATE FUNCTION public.invest_api_set_caller_public_key(
  p_user_id uuid, p_caller_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_changed integer;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9+/]{43}=$' THEN
    RAISE EXCEPTION 'invalid public key';
  END IF;
  UPDATE public.invest_api_callers SET x25519_public_key = p_key
    WHERE id = p_caller_id AND user_id = p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed = 0 THEN RETURN false; END IF;
  DELETE FROM public.invest_summaries WHERE caller_id = p_caller_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.invest_api_authenticate(uuid),
  public.invest_api_consume_nonce(text, timestamptz),
  public.invest_api_get_summary(uuid),
  public.invest_api_get_journal_public_key(uuid),
  public.invest_api_append_journal(uuid, text, timestamptz, text),
  public.invest_api_journal_meta(uuid, timestamptz, uuid),
  public.invest_api_audit_write(uuid, uuid, text, integer),
  public.invest_api_publish_summary(uuid, uuid, text),
  public.invest_api_prune(),
  public.invest_api_create_caller(uuid, text, text[], text),
  public.invest_api_add_key(uuid, uuid, text),
  public.invest_api_revoke_key(uuid, uuid),
  public.invest_api_revoke_caller(uuid, uuid),
  public.invest_api_set_caller_public_key(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.invest_api_authenticate(uuid),
  public.invest_api_consume_nonce(text, timestamptz),
  public.invest_api_get_summary(uuid),
  public.invest_api_get_journal_public_key(uuid),
  public.invest_api_append_journal(uuid, text, timestamptz, text),
  public.invest_api_journal_meta(uuid, timestamptz, uuid),
  public.invest_api_audit_write(uuid, uuid, text, integer),
  public.invest_api_publish_summary(uuid, uuid, text),
  public.invest_api_prune(),
  public.invest_api_create_caller(uuid, text, text[], text),
  public.invest_api_add_key(uuid, uuid, text),
  public.invest_api_revoke_key(uuid, uuid),
  public.invest_api_revoke_caller(uuid, uuid),
  public.invest_api_set_caller_public_key(uuid, uuid, text)
TO service_role;

COMMIT;
