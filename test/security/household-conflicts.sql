-- Disposable fixture only. All constraint/trigger/data changes roll back.
BEGIN;
ALTER TABLE public.household_members DROP CONSTRAINT household_members_one_household_per_user;
ALTER TABLE public.household_members DISABLE TRIGGER trg_household_member_cap;
INSERT INTO auth.users(id) VALUES ('77000000-0000-0000-0000-000000000001'),('77000000-0000-0000-0000-000000000002'),('77000000-0000-0000-0000-000000000003');
INSERT INTO public.households(id,name,created_by) VALUES
 ('78000000-0000-0000-0000-000000000001','Conflict A','77000000-0000-0000-0000-000000000001'),
 ('78000000-0000-0000-0000-000000000002','Conflict B','77000000-0000-0000-0000-000000000001');
INSERT INTO public.household_members(household_id,user_id,role,wrapped_kh) VALUES
 ('78000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','owner','fixture'),
 ('78000000-0000-0000-0000-000000000002','77000000-0000-0000-0000-000000000001','owner','fixture');
DO $$ BEGIN
 IF current_setting('fynfo.fixture_conflict',true) = 'capacity' THEN
   DELETE FROM public.household_members WHERE household_id='78000000-0000-0000-0000-000000000002';
   INSERT INTO public.household_members(household_id,user_id,role,wrapped_kh) VALUES
    ('78000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000002','member','fixture'),
    ('78000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000003','member','fixture');
 END IF;
END $$;
-- Runner substitutes the actual migration preflight block, avoiding copied logic.
:preflight
ROLLBACK;
