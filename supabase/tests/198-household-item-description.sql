-- Local synthetic stack only (spec 147). Rolls back; leaves no rows behind.
-- Run: docker exec -i supabase_db_fynfo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/198-household-item-description.sql
-- User ...01 is a member of household a1; ...03 is an outsider.
BEGIN;
INSERT INTO auth.users(id, instance_id, aud, role, email) VALUES
 ('19800000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m1-198@fynfo.test'),
 ('19800000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-198@fynfo.test');
INSERT INTO public.households(id, name, created_by) VALUES
 ('19800000-0000-4000-8000-0000000000a1','Fixture','19800000-0000-4000-8000-000000000001');
INSERT INTO public.household_members(household_id, user_id, role, wrapped_kh) VALUES
 ('19800000-0000-4000-8000-0000000000a1','19800000-0000-4000-8000-000000000001','owner','fixture-wrapped');
INSERT INTO public.household_goals(id, household_id, name, target_amount, created_by) VALUES
 ('19800000-0000-4000-8000-0000000000b1','19800000-0000-4000-8000-0000000000a1','enc','enc','19800000-0000-4000-8000-000000000001');
-- Row inserted without a description models every pre-198b item.
INSERT INTO public.household_goal_items(id, goal_id, name, budget) VALUES
 ('19800000-0000-4000-8000-0000000000c1','19800000-0000-4000-8000-0000000000b1','enc','enc');

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub','19800000-0000-4000-8000-000000000001',true);
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.household_goal_items
    WHERE id = '19800000-0000-4000-8000-0000000000c1' AND description IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'existing item should read a NULL description'; END IF;

  INSERT INTO public.household_goal_items(goal_id, name, budget, description)
    VALUES ('19800000-0000-4000-8000-0000000000b1','enc','enc','enc-desc');
  UPDATE public.household_goal_items SET description = 'enc-desc2'
    WHERE id = '19800000-0000-4000-8000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'member should update the description'; END IF;
END $$;

-- An outsider cannot read or change the description.
SELECT set_config('request.jwt.claim.sub','19800000-0000-4000-8000-000000000003',true);
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.household_goal_items WHERE description IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'outsider should not see descriptions'; END IF;
  UPDATE public.household_goal_items SET description = 'x';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'outsider should not update descriptions'; END IF;
END $$;

ROLLBACK;
