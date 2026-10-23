-- Local synthetic stack only (spec 147). Rolls back; leaves no rows behind.
-- Run: docker exec -i supabase_db_fynfo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/149-household-project-items.sql
BEGIN;
INSERT INTO auth.users(id, instance_id, aud, role, email) VALUES
 ('14900000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-149@fynfo.test'),
 ('14900000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-149@fynfo.test');
INSERT INTO public.households(id, name, created_by) VALUES
 ('14900000-0000-4000-8000-0000000000a1','Fixture','14900000-0000-4000-8000-000000000001');
INSERT INTO public.household_members(household_id, user_id, role, wrapped_kh) VALUES
 ('14900000-0000-4000-8000-0000000000a1','14900000-0000-4000-8000-000000000001','owner','fixture-wrapped');
INSERT INTO public.household_goals(id, household_id, name, target_amount, created_by) VALUES
 ('14900000-0000-4000-8000-0000000000b1','14900000-0000-4000-8000-0000000000a1','enc','enc','14900000-0000-4000-8000-000000000001');
INSERT INTO public.household_goal_items(id, goal_id, name, budget) VALUES
 ('14900000-0000-4000-8000-0000000000c1','14900000-0000-4000-8000-0000000000b1','enc','enc');
INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date) VALUES
 ('14900000-0000-4000-8000-0000000000c1','14900000-0000-4000-8000-000000000001','enc','2026-10-01');

SET LOCAL ROLE authenticated;

-- Member: reads, inserts as self, cannot insert as someone else, cannot update.
SELECT set_config('request.jwt.claim.sub','14900000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_goal_items) <> 1 THEN
    RAISE EXCEPTION 'REGRESSION: member cannot read items';
  END IF;
  IF (SELECT count(*) FROM public.household_goal_payments) <> 1 THEN
    RAISE EXCEPTION 'REGRESSION: member cannot read payments';
  END IF;
  INSERT INTO public.household_goal_items(goal_id, name, budget)
    VALUES ('14900000-0000-4000-8000-0000000000b1','enc','enc');
  INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
    VALUES ('14900000-0000-4000-8000-0000000000c1','14900000-0000-4000-8000-000000000001','enc','2026-10-02');
  BEGIN
    INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
      VALUES ('14900000-0000-4000-8000-0000000000c1','14900000-0000-4000-8000-000000000002','enc','2026-10-02');
    RAISE EXCEPTION 'REGRESSION: member inserted a payment as another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.household_goal_items SET budget = 'tampered';
    RAISE EXCEPTION 'REGRESSION: items are updatable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

-- Outsider: sees nothing, writes nothing, deletes nothing.
SELECT set_config('request.jwt.claim.sub','14900000-0000-4000-8000-000000000002',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_goal_items) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: outsider reads items';
  END IF;
  IF (SELECT count(*) FROM public.household_goal_payments) <> 0 THEN
    RAISE EXCEPTION 'REGRESSION: outsider reads payments';
  END IF;
  BEGIN
    INSERT INTO public.household_goal_items(goal_id, name, budget)
      VALUES ('14900000-0000-4000-8000-0000000000b1','enc','enc');
    RAISE EXCEPTION 'REGRESSION: outsider inserted an item';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.household_goal_payments(item_id, payer_user_id, amount, date)
      VALUES ('14900000-0000-4000-8000-0000000000c1','14900000-0000-4000-8000-000000000002','enc','2026-10-02');
    RAISE EXCEPTION 'REGRESSION: outsider inserted a payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM public.household_goal_items;
  DELETE FROM public.household_goal_payments;
END;
$$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_goal_items
      WHERE goal_id = '14900000-0000-4000-8000-0000000000b1') <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: outsider deleted items';
  END IF;
  IF (SELECT count(*) FROM public.household_goal_payments
      WHERE item_id = '14900000-0000-4000-8000-0000000000c1') <> 2 THEN
    RAISE EXCEPTION 'REGRESSION: outsider deleted payments';
  END IF;
END;
$$;
SELECT 'household project items RLS: ok';
ROLLBACK;
