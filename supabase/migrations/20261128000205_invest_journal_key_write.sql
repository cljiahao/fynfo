-- 204 follow-up: write path for the per-user journal keypair, and a stricter signing-key format.
-- invest_journal_keys had an owner SELECT policy but no way to create the row; a SECURITY
-- DEFINER RPC keeps the table closed to direct writes like every other invest_* table.

BEGIN;

-- Raw 32-byte Ed25519 key in standard base64: 43 chars plus one padding char.
-- Added NOT VALID then validated separately; invest_api_add_key already enforced the same regex.
ALTER TABLE public.invest_api_keys
  DROP CONSTRAINT invest_api_keys_public_key_check,
  ADD CONSTRAINT invest_api_keys_public_key_check
    CHECK (public_key ~ '^[A-Za-z0-9+/]{43}=$') NOT VALID;
ALTER TABLE public.invest_api_keys VALIDATE CONSTRAINT invest_api_keys_public_key_check;

-- Insert only: an existing keypair is never overwritten, because replacing it would make every
-- sealed journal event already stored for the user unreadable. Returns true when created.
CREATE FUNCTION public.invest_api_set_journal_key(
  p_user_id uuid, p_public_key text, p_wrapped_private_key text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_created integer;
BEGIN
  IF p_public_key !~ '^[A-Za-z0-9+/]{43}=$' OR coalesce(length(p_wrapped_private_key), 0) = 0 THEN
    RAISE EXCEPTION 'invalid journal key';
  END IF;
  INSERT INTO public.invest_journal_keys (user_id, public_key, wrapped_private_key)
    VALUES (p_user_id, p_public_key, p_wrapped_private_key)
    ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN v_created = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.invest_api_set_journal_key(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invest_api_set_journal_key(uuid, text, text) TO service_role;

-- Encrypted per-user investment settings (weekly budget). The app writes payload as
-- encryptPayload JSON under the user's DEK; the server cannot read it without an unlocked vault.
CREATE TABLE public.invest_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload text NOT NULL CHECK (length(payload) BETWEEN 1 AND 4096),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invest_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invest_settings FROM PUBLIC, anon, authenticated, service_role;
-- No DELETE grant: removal happens only through the auth.users cascade.
GRANT SELECT, INSERT, UPDATE ON public.invest_settings TO authenticated;
CREATE POLICY "Owner reads invest settings" ON public.invest_settings
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner inserts invest settings" ON public.invest_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner updates invest settings" ON public.invest_settings
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
