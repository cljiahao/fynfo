-- Local synthetic stack only (spec 147). Rolls back; leaves no rows behind.
-- Run: docker exec -i supabase_db_fynfo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/195-household-paid-by.sql
-- Users: ...01 and ...02 are members of household a1; ...03 is an outsider;
-- ...04 belongs to a different household a2.
BEGIN;
INSERT INTO auth.users(id, instance_id, aud, role, email) VALUES
 ('19500000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m1-195@fynfo.test'),
 ('19500000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m2-195@fynfo.test'),
 ('19500000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-195@fynfo.test'),
 ('19500000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','other-195@fynfo.test');
INSERT INTO public.households(id, name, created_by) VALUES
 ('19500000-0000-4000-8000-0000000000a1','Fixture','19500000-0000-4000-8000-000000000001'),
 ('19500000-0000-4000-8000-0000000000a2','Other','19500000-0000-4000-8000-000000000004');
INSERT INTO public.household_members(household_id, user_id, role, wrapped_kh) VALUES
 ('19500000-0000-4000-8000-0000000000a1','19500000-0000-4000-8000-000000000001','owner','fixture-wrapped'),
 ('19500000-0000-4000-8000-0000000000a1','19500000-0000-4000-8000-000000000002','member','fixture-wrapped'),
 ('19500000-0000-4000-8000-0000000000a2','19500000-0000-4000-8000-000000000004','owner','fixture-wrapped');
INSERT INTO public.household_goals(id, household_id, name, target_amount, created_by) VALUES
 ('19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-0000000000a1','enc','enc','19500000-0000-4000-8000-000000000001');
INSERT INTO public.household_goal_items(id, goal_id, name, budget) VALUES
 ('19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-0000000000b1','enc','enc');
INSERT INTO public.household_goal_payments(id, item_id, payer_user_id, amount, date) VALUES
 ('19500000-0000-4000-8000-0000000000d1','19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-000000000002','enc','2026-11-01'),
 ('19500000-0000-4000-8000-0000000000d2','19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-000000000002','enc','2026-11-01');
INSERT INTO public.household_goal_contributions(id, goal_id, contributor_user_id, amount, date) VALUES
 ('19500000-0000-4000-8000-0000000000e1','19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-000000000002','enc','2026-11-01'),
 ('19500000-0000-4000-8000-0000000000e2','19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-000000000002','enc','2026-11-01');

SET LOCAL ROLE authenticated;

-- Member 1: records for the partner, cannot name an outsider or a member of
-- another household, edits and reassigns the partner's entries, deletes one.
SELECT set_config('request.jwt.claim.sub','19500000-0000-4000-8000-000000000001',true);
DO $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
    VALUES ('19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-000000000002','enc','2026-11-02');
  INSERT INTO public.household_goal_contributions(goal_id, contributor_user_id, amount, date)
    VALUES ('19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-000000000002','enc','2026-11-02');

  BEGIN
    INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
      VALUES ('19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-000000000003','enc','2026-11-02');
    RAISE EXCEPTION 'REGRESSION: payment inserted with an outsider as payer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
      VALUES ('19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-000000000004','enc','2026-11-02');
    RAISE EXCEPTION 'REGRESSION: payment inserted with another household member as payer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_goal_contributions(goal_id, contributor_user_id, amount, date)
      VALUES ('19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-000000000003','enc','2026-11-02');
    RAISE EXCEPTION 'REGRESSION: contribution inserted with an outsider as contributor';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_goal_contributions(goal_id, contributor_user_id, amount, date)
      VALUES ('19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-000000000004','enc','2026-11-02');
    RAISE EXCEPTION 'REGRESSION: contribution inserted with another household member as contributor';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Edit the partner's entries, including reassigning to self.
  UPDATE public.household_goal_payments SET amount = 'edited', payer_user_id = '19500000-0000-4000-8000-000000000001'
    WHERE id = '19500000-0000-4000-8000-0000000000d1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: member cannot edit the partner payment'; END IF;
  UPDATE public.household_goal_contributions SET amount = 'edited', contributor_user_id = '19500000-0000-4000-8000-000000000001'
    WHERE id = '19500000-0000-4000-8000-0000000000e1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: member cannot edit the partner contribution'; END IF;

  BEGIN
    UPDATE public.household_goal_payments SET payer_user_id = '19500000-0000-4000-8000-000000000003'
      WHERE id = '19500000-0000-4000-8000-0000000000d1';
    RAISE EXCEPTION 'REGRESSION: payment reassigned to an outsider';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.household_goal_contributions SET contributor_user_id = '19500000-0000-4000-8000-000000000003'
      WHERE id = '19500000-0000-4000-8000-0000000000e1';
    RAISE EXCEPTION 'REGRESSION: contribution reassigned to an outsider';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM public.household_goal_payments WHERE id = '19500000-0000-4000-8000-0000000000d2';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: member cannot delete the partner payment'; END IF;
  DELETE FROM public.household_goal_contributions WHERE id = '19500000-0000-4000-8000-0000000000e2';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: member cannot delete the partner contribution'; END IF;
END;
$$;

-- Member 2: edits an entry authored by member 1 and reassigns it.
SELECT set_config('request.jwt.claim.sub','19500000-0000-4000-8000-000000000002',true);
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.household_goal_payments SET amount = 'edited2', payer_user_id = '19500000-0000-4000-8000-000000000002'
    WHERE id = '19500000-0000-4000-8000-0000000000d1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: second member cannot edit the first member payment'; END IF;
  UPDATE public.household_goal_contributions SET contributor_user_id = '19500000-0000-4000-8000-000000000002'
    WHERE id = '19500000-0000-4000-8000-0000000000e1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: second member cannot reassign a contribution'; END IF;
END;
$$;

-- Outsider: reads, inserts, updates and deletes nothing.
SELECT set_config('request.jwt.claim.sub','19500000-0000-4000-8000-000000000003',true);
DO $$
DECLARE
  n integer;
BEGIN
  IF (SELECT count(*) FROM public.household_goal_payments) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: outsider reads payments';
  END IF;
  IF (SELECT count(*) FROM public.household_goal_contributions) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: outsider reads contributions';
  END IF;
  BEGIN
    INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
      VALUES ('19500000-0000-4000-8000-0000000000c1','19500000-0000-4000-8000-000000000003','enc','2026-11-02');
    RAISE EXCEPTION 'REGRESSION: outsider inserted a payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_goal_contributions(goal_id, contributor_user_id, amount, date)
      VALUES ('19500000-0000-4000-8000-0000000000b1','19500000-0000-4000-8000-000000000003','enc','2026-11-02');
    RAISE EXCEPTION 'REGRESSION: outsider inserted a contribution';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.household_goal_payments SET amount = 'tampered'
    WHERE item_id = '19500000-0000-4000-8000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'REGRESSION: outsider updated payments'; END IF;
  UPDATE public.household_goal_contributions SET amount = 'tampered'
    WHERE goal_id = '19500000-0000-4000-8000-0000000000b1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'REGRESSION: outsider updated contributions'; END IF;
  DELETE FROM public.household_goal_payments
    WHERE item_id = '19500000-0000-4000-8000-0000000000c1';
  DELETE FROM public.household_goal_contributions
    WHERE goal_id = '19500000-0000-4000-8000-0000000000b1';
END;
$$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_goal_payments
      WHERE item_id = '19500000-0000-4000-8000-0000000000c1') <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: outsider deleted payments or member delete failed';
  END IF;
  IF (SELECT count(*) FROM public.household_goal_contributions
      WHERE goal_id = '19500000-0000-4000-8000-0000000000b1') <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: outsider deleted contributions or member delete failed';
  END IF;
END;
$$;
SELECT 'household paid-by RLS: ok';
ROLLBACK;
