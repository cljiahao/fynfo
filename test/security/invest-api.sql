-- Disposable fixture only; run with psql ON_ERROR_STOP=1 after the invest_api migration.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('a4000000-0000-0000-0000-000000000001'),
 ('a4000000-0000-0000-0000-000000000002');
INSERT INTO public.invest_api_callers(id,user_id,name,x25519_public_key) VALUES
 ('a4100000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','ballast',repeat('A',44)),
 ('a4100000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000002','ballast',repeat('B',44));

-- At most two active keys per caller; revoking or expiring frees a slot.
DO $$
DECLARE v_key uuid;
BEGIN
  INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
    VALUES ('a4100000-0000-0000-0000-000000000001',repeat('A',44),'{summary:read}',now()+interval '90 days');
  INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
    VALUES ('a4100000-0000-0000-0000-000000000001',repeat('B',44),'{summary:read}',now()+interval '90 days')
    RETURNING id INTO v_key;
  BEGIN
    INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
      VALUES ('a4100000-0000-0000-0000-000000000001',repeat('C',44),'{summary:read}',now()+interval '90 days');
    RAISE EXCEPTION 'REGRESSION: third active key accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'caller already has two active keys' THEN RAISE; END IF;
  END;
  UPDATE public.invest_api_keys SET revoked_at = now() WHERE id = v_key;
  INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
    VALUES ('a4100000-0000-0000-0000-000000000001',repeat('C',44),'{summary:read}',now()+interval '90 days');
  -- An already-expired key never counts as active.
  INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
    VALUES ('a4100000-0000-0000-0000-000000000001',repeat('D',44),'{summary:read}',now()-interval '1 day');
  -- Un-revoking past the cap is rejected too.
  BEGIN
    UPDATE public.invest_api_keys SET revoked_at = NULL WHERE id = v_key;
    RAISE EXCEPTION 'REGRESSION: un-revoke exceeded the cap';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'caller already has two active keys' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.invest_api_keys(caller_id,public_key,scopes,expires_at)
      VALUES ('a4100000-0000-0000-0000-000000000002',repeat('E',44),'{not:a:scope}',now()+interval '1 day');
    RAISE EXCEPTION 'REGRESSION: unknown scope accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

-- RPCs under the service_role: authenticate, nonce replay, journal append.
SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.invest_api_keys;
    RAISE EXCEPTION 'REGRESSION: service_role read a table directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
DO $$
DECLARE
  v_journal uuid;
  v_key uuid;
BEGIN
  v_key := (SELECT k.caller_id FROM public.invest_api_authenticate(gen_random_uuid()) k);
  IF v_key IS NOT NULL THEN RAISE EXCEPTION 'REGRESSION: unknown key authenticated'; END IF;
  IF NOT public.invest_api_consume_nonce(repeat('a',64), now()+interval '5 minutes') THEN
    RAISE EXCEPTION 'REGRESSION: first nonce rejected';
  END IF;
  IF public.invest_api_consume_nonce(repeat('a',64), now()+interval '5 minutes') THEN
    RAISE EXCEPTION 'REGRESSION: replayed nonce accepted';
  END IF;
  v_journal := public.invest_api_append_journal('a4100000-0000-0000-0000-000000000001','plan',now(),'sealed-fixture');
  IF v_journal IS NULL THEN RAISE EXCEPTION 'REGRESSION: append returned null'; END IF;
  BEGIN
    PERFORM public.invest_api_append_journal('a4100000-0000-0000-0000-000000000001','bogus',now(),'x');
    RAISE EXCEPTION 'REGRESSION: unknown event type accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.invest_api_journal_meta('a4000000-0000-0000-0000-000000000001', NULL)) <> 1 THEN
    RAISE EXCEPTION 'REGRESSION: journal meta count';
  END IF;
  IF (SELECT count(*) FROM public.invest_api_journal_meta('a4000000-0000-0000-0000-000000000002', NULL)) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: journal meta leaked across users';
  END IF;
END;
$$;
RESET ROLE;

-- Append-only: neither the trigger nor the grants allow UPDATE/DELETE, even for the table owner.
DO $$
BEGIN
  BEGIN
    UPDATE public.invest_journal SET sealed = 'tampered';
    RAISE EXCEPTION 'REGRESSION: journal UPDATE succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invest_journal is append-only' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.invest_journal;
    RAISE EXCEPTION 'REGRESSION: journal DELETE succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invest_journal is append-only' THEN RAISE; END IF;
  END;
  IF has_table_privilege('authenticated','public.invest_journal','UPDATE')
     OR has_table_privilege('authenticated','public.invest_journal','DELETE')
     OR has_table_privilege('service_role','public.invest_journal','UPDATE')
     OR has_table_privilege('service_role','public.invest_journal','DELETE')
     OR has_table_privilege('anon','public.invest_journal','SELECT') THEN
    RAISE EXCEPTION 'REGRESSION: journal grants too broad';
  END IF;
END;
$$;

-- EXECUTE is service_role only; anon, authenticated and PUBLIC are denied.
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'invest_api_%'
  LOOP
    IF NOT has_function_privilege('service_role', v_fn.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'REGRESSION: service_role lacks EXECUTE on %', v_fn.sig;
    END IF;
    IF has_function_privilege('anon', v_fn.sig, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'REGRESSION: client role can EXECUTE %', v_fn.sig;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'invest_api_%'
      AND NOT p.prosecdef
  ) THEN RAISE EXCEPTION 'REGRESSION: non-definer invest_api function'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'invest_api_%'
      AND NOT coalesce(p.proconfig, '{}') @> ARRAY['search_path=""']
  ) THEN RAISE EXCEPTION 'REGRESSION: invest_api function without search_path'; END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname LIKE 'invest_%' AND c.relkind = 'r'
        AND c.relrowsecurity) <> 7 THEN
    RAISE EXCEPTION 'REGRESSION: RLS not enabled on every invest table';
  END IF;
END;
$$;

-- Authenticated users see only their own rows and can never write.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000002',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.invest_api_callers) <> 1
     OR (SELECT count(*) FROM public.invest_api_keys) <> 0
     OR (SELECT count(*) FROM public.invest_journal) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: owner policy leaked another user rows';
  END IF;
  BEGIN
    INSERT INTO public.invest_api_callers(user_id,name,x25519_public_key)
      VALUES ('a4000000-0000-0000-0000-000000000002','x1',repeat('A',44));
    RAISE EXCEPTION 'REGRESSION: authenticated INSERT succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.invest_api_nonces;
    RAISE EXCEPTION 'REGRESSION: authenticated read nonces';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.invest_api_prune();
    RAISE EXCEPTION 'REGRESSION: authenticated called a service RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;

-- Deleting a user must still cascade through the append-only journal.
BEGIN;
INSERT INTO auth.users(id) VALUES ('a4000000-0000-0000-0000-000000000003');
INSERT INTO public.invest_api_callers(id,user_id,name,x25519_public_key) VALUES
 ('a4100000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000003','atlas',repeat('A',44));
INSERT INTO public.invest_journal(user_id,caller_id,event_type,occurred_at,sealed) VALUES
 ('a4000000-0000-0000-0000-000000000003','a4100000-0000-0000-0000-000000000003','verdict',now(),'sealed-fixture');
DELETE FROM auth.users WHERE id = 'a4000000-0000-0000-0000-000000000003';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.invest_journal WHERE user_id = 'a4000000-0000-0000-0000-000000000003') THEN
    RAISE EXCEPTION 'REGRESSION: user delete did not cascade';
  END IF;
END;
$$;
ROLLBACK;
