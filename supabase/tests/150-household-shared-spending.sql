-- Local synthetic stack only (spec 147). Rolls back; leaves no rows behind.
-- Run: docker exec -i supabase_db_fynfo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/150-household-shared-spending.sql
BEGIN;
INSERT INTO auth.users(id, instance_id, aud, role, email) VALUES
 ('15000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-150@fynfo.test'),
 ('15000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-150@fynfo.test');
INSERT INTO public.households(id, name, created_by) VALUES
 ('15000000-0000-4000-8000-0000000000a1','Fixture','15000000-0000-4000-8000-000000000001');
INSERT INTO public.household_members(household_id, user_id, role, wrapped_kh) VALUES
 ('15000000-0000-4000-8000-0000000000a1','15000000-0000-4000-8000-000000000001','owner','fixture-wrapped');
INSERT INTO public.household_spaces(id, household_id, kind, name, created_by) VALUES
 ('15000000-0000-4000-8000-0000000000b1','15000000-0000-4000-8000-0000000000a1','ongoing','enc','15000000-0000-4000-8000-000000000001');
INSERT INTO public.household_spending(space_id, payer_user_id, date, category, amount) VALUES
 ('15000000-0000-4000-8000-0000000000b1','15000000-0000-4000-8000-000000000001','2026-10-01','enc','enc');

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_spaces) <> 1 THEN
    RAISE EXCEPTION 'REGRESSION: member cannot read spaces';
  END IF;
  IF (SELECT count(*) FROM public.household_spending) <> 1 THEN
    RAISE EXCEPTION 'REGRESSION: member cannot read spending';
  END IF;
  INSERT INTO public.household_spaces(household_id, kind, name, start_date, end_date, created_by)
    VALUES ('15000000-0000-4000-8000-0000000000a1','trip','enc','2026-12-01','2026-12-10','15000000-0000-4000-8000-000000000001');
  INSERT INTO public.household_spending(space_id, payer_user_id, date, category, amount)
    VALUES ('15000000-0000-4000-8000-0000000000b1','15000000-0000-4000-8000-000000000001','2026-10-02','enc','enc');
  BEGIN
    INSERT INTO public.household_spaces(household_id, kind, name, created_by)
      VALUES ('15000000-0000-4000-8000-0000000000a1','weekly','enc','15000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'REGRESSION: unknown space kind accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_spending(space_id, payer_user_id, date, category, amount)
      VALUES ('15000000-0000-4000-8000-0000000000b1','15000000-0000-4000-8000-000000000002','2026-10-02','enc','enc');
    RAISE EXCEPTION 'REGRESSION: member recorded spending as another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.household_spending SET amount = 'tampered';
    RAISE EXCEPTION 'REGRESSION: spending is updatable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_spaces) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: outsider reads spaces';
  END IF;
  IF (SELECT count(*) FROM public.household_spending) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: outsider reads spending';
  END IF;
  BEGIN
    INSERT INTO public.household_spaces(household_id, kind, name, created_by)
      VALUES ('15000000-0000-4000-8000-0000000000a1','trip','enc','15000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'REGRESSION: outsider created a space';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_spending(space_id, payer_user_id, date, category, amount)
      VALUES ('15000000-0000-4000-8000-0000000000b1','15000000-0000-4000-8000-000000000002','2026-10-02','enc','enc');
    RAISE EXCEPTION 'REGRESSION: outsider recorded spending';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM public.household_spaces;
  DELETE FROM public.household_spending;
END;
$$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_spaces
      WHERE household_id = '15000000-0000-4000-8000-0000000000a1') <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: outsider deleted spaces';
  END IF;
  IF (SELECT count(*) FROM public.household_spending
      WHERE space_id = '15000000-0000-4000-8000-0000000000b1') <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: outsider deleted spending';
  END IF;
END;
$$;
SELECT 'household shared spending RLS: ok';
ROLLBACK;
