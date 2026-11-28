-- Disposable fixture only; run with psql ON_ERROR_STOP=1 after 20261128000205_invest_journal_key_write.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('a5000000-0000-0000-0000-000000000001'),
 ('a5000000-0000-0000-0000-000000000002');

SET LOCAL ROLE service_role;
DO $$
DECLARE v_pub text := repeat('A',43)||'=';
BEGIN
  IF NOT public.invest_api_set_journal_key('a5000000-0000-0000-0000-000000000001', v_pub, 'wrapped-one') THEN
    RAISE EXCEPTION 'REGRESSION: first call did not create the key';
  END IF;
  -- A second call is a no-op and never overwrites the stored pair.
  IF public.invest_api_set_journal_key('a5000000-0000-0000-0000-000000000001', repeat('B',43)||'=', 'wrapped-two') THEN
    RAISE EXCEPTION 'REGRESSION: existing journal key overwritten';
  END IF;
  -- Another user gets their own row; one user can never touch another's.
  IF NOT public.invest_api_set_journal_key('a5000000-0000-0000-0000-000000000002', repeat('C',43)||'=', 'wrapped-three') THEN
    RAISE EXCEPTION 'REGRESSION: second user could not create a key';
  END IF;
  BEGIN
    PERFORM public.invest_api_set_journal_key('a5000000-0000-0000-0000-000000000002', 'short', 'wrapped');
    RAISE EXCEPTION 'REGRESSION: malformed public key accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid journal key' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT wrapped_private_key FROM public.invest_journal_keys
      WHERE user_id = 'a5000000-0000-0000-0000-000000000001') <> 'wrapped-one' THEN
    RAISE EXCEPTION 'REGRESSION: stored wrapped key changed';
  END IF;
  IF (SELECT count(*) FROM public.invest_journal_keys
      WHERE user_id IN ('a5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000002')) <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: unexpected journal key row count';
  END IF;
  -- The stricter signing-key format rejects wrong length and non-base64.
  INSERT INTO public.invest_api_callers(id,user_id,name,scopes,x25519_public_key) VALUES
    ('a5100000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','atlas','{summary:read}',repeat('A',43)||'=');
  BEGIN
    INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
      VALUES ('a5100000-0000-0000-0000-000000000001',repeat('A',44),'{summary:read}',now()+interval '1 day');
    RAISE EXCEPTION 'REGRESSION: unpadded signing key accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

-- Grants: service_role only.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(r, 'public.invest_api_set_journal_key(uuid,text,text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'REGRESSION: % can execute invest_api_set_journal_key', r;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.invest_api_set_journal_key(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESSION: service_role cannot execute invest_api_set_journal_key';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.invest_api_set_journal_key('a5000000-0000-0000-0000-000000000001', repeat('A',43)||'=', 'x');
    RAISE EXCEPTION 'REGRESSION: authenticated called the journal key RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.invest_journal_keys(user_id,public_key,wrapped_private_key)
      VALUES ('a5000000-0000-0000-0000-000000000001', repeat('A',43)||'=', 'x');
    RAISE EXCEPTION 'REGRESSION: authenticated wrote journal keys directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
