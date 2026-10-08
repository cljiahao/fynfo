\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('71000000-0000-4000-8000-000000000001'),
 ('71000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
  BEGIN
    PERFORM public.vault_unlock_record(true);
    RAISE EXCEPTION 'REGRESSION: caller asserted success resets lockout';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.reserve_vault_unlock('71000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'REGRESSION: untrusted reservation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.finish_vault_unlock('71000000-0000-4000-8000-000000000001',gen_random_uuid(),true);
    RAISE EXCEPTION 'REGRESSION: untrusted success';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.marketing_events(event_type,path) VALUES('page_view','/?email=fixture@example.test');
    RAISE EXCEPTION 'REGRESSION: direct telemetry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.get_marketing_event_stats();
    RAISE EXCEPTION 'REGRESSION: unauthorized aggregates';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.get_signup_stats();
    RAISE EXCEPTION 'REGRESSION: unauthorized signup counts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.record_marketing_event('page_view','/');
    RAISE EXCEPTION 'REGRESSION: anonymous bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.get_marketing_event_stats();
    RAISE EXCEPTION 'REGRESSION: anonymous aggregate';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_uid uuid := '71000000-0000-4000-8000-000000000001';
  v_other uuid := '71000000-0000-4000-8000-000000000002';
  v_token uuid;
  v_pending uuid;
  v_failed boolean;
BEGIN
  v_token := public.reserve_vault_unlock(v_uid);
  IF v_token IS NULL THEN RAISE EXCEPTION 'first attempt denied'; END IF;
  BEGIN
    PERFORM public.finish_vault_unlock(v_other,v_token,true);
    RAISE EXCEPTION 'REGRESSION: wrong user finished token';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid attempt' THEN RAISE; END IF;
  END;
  v_pending := public.reserve_vault_unlock(v_uid);
  IF public.finish_vault_unlock(v_uid,v_token,true) THEN RAISE EXCEPTION 'success locked'; END IF;
  IF public.finish_vault_unlock(v_uid,v_pending,false) THEN RAISE EXCEPTION 'pending failure lost'; END IF;
  BEGIN
    PERFORM public.finish_vault_unlock(v_uid,v_token,true);
    RAISE EXCEPTION 'REGRESSION: token replay';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid attempt' THEN RAISE; END IF;
  END;
  FOR i IN 2..5 LOOP
    v_token := public.reserve_vault_unlock(v_uid);
    IF v_token IS NULL THEN RAISE EXCEPTION 'budget denied before five failures'; END IF;
    v_failed := public.finish_vault_unlock(v_uid,v_token,false);
    IF v_failed <> (i=5) THEN RAISE EXCEPTION 'wrong threshold'; END IF;
  END LOOP;
  IF public.reserve_vault_unlock(v_uid) IS NOT NULL THEN RAISE EXCEPTION 'locked budget admitted'; END IF;
  PERFORM public.record_marketing_event('page_view','/');
  PERFORM public.record_marketing_event('cta_click','/login');
  IF NOT EXISTS(SELECT 1 FROM public.get_marketing_event_stats() WHERE events > 0) THEN
    RAISE EXCEPTION 'trusted telemetry missing';
  END IF;
  BEGIN
    PERFORM public.record_marketing_event('page_view','/?email=fixture@example.test');
    RAISE EXCEPTION 'REGRESSION: private path';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid event' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT fail_count FROM public.vault_unlock_attempts WHERE user_id='71000000-0000-4000-8000-000000000001') <> 5 THEN
    RAISE EXCEPTION 'counter incorrect';
  END IF;
END;
$$;
ROLLBACK;
