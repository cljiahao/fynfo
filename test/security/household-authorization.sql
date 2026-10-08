-- Disposable fixture only; run with psql ON_ERROR_STOP=1 after historical migrations.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('71000000-0000-0000-0000-000000000001'),
 ('71000000-0000-0000-0000-000000000002'),
 ('71000000-0000-0000-0000-000000000003');
INSERT INTO public.households(id,name,created_by) VALUES
 ('72000000-0000-0000-0000-000000000001','Fixture','71000000-0000-0000-0000-000000000001');
INSERT INTO public.household_members(household_id,user_id,role,wrapped_kh) VALUES
 ('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','owner','fixture-wrapped');
INSERT INTO public.household_invites(id,household_id,invite_code_hash,kdf_salt,wrapped_kh_under_invite,created_by,expires_at) VALUES
 ('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',repeat('a',64),'fixture-salt','fixture-wrapped','71000000-0000-0000-0000-000000000001',now()+interval '1 hour');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000002',true);
DO $$
BEGIN
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','fixture-wrapped',NULL);
    RAISE EXCEPTION 'REGRESSION: missing proof succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invite not valid' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','fixture-wrapped');
    RAISE EXCEPTION 'REGRESSION: UUID-only consume succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
DO $$
BEGIN
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','fixture-wrapped',repeat('b',64));
    RAISE EXCEPTION 'REGRESSION: wrong proof succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invite not valid' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','fixture-wrapped',repeat('a',64));
    RAISE EXCEPTION 'REGRESSION: caller mismatch succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unauthorized' THEN RAISE; END IF;
  END;
END;
$$;
SELECT public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','fixture-wrapped',repeat('a',64));
DO $$
BEGIN
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','fixture-wrapped',repeat('a',64));
    RAISE EXCEPTION 'REGRESSION: consumed invite replay succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invite not valid' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.household_invites SET invite_code_hash=repeat('b',64);
    RAISE EXCEPTION 'REGRESSION: invite proof mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.household_members SET role='owner' WHERE user_id=auth.uid();
    RAISE EXCEPTION 'REGRESSION: member role mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.households SET created_by=auth.uid();
    RAISE EXCEPTION 'REGRESSION: creator mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.household_invites) THEN RAISE EXCEPTION 'REGRESSION: member reads secret proof'; END IF;
  BEGIN
    INSERT INTO public.household_invites(household_id,invite_code_hash,kdf_salt,wrapped_kh_under_invite,created_by,expires_at)
      VALUES ('72000000-0000-0000-0000-000000000001',repeat('b',64),'salt','wrapped',auth.uid(),now()+interval '1 hour');
    RAISE EXCEPTION 'REGRESSION: member minted invite';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
-- Expired invites cannot be consumed even with a correct proof.
INSERT INTO public.household_invites(id,household_id,invite_code_hash,kdf_salt,wrapped_kh_under_invite,created_by,expires_at) VALUES
 ('73000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000001',repeat('c',64),'salt','wrapped','71000000-0000-0000-0000-000000000001',now()-interval '1 second');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000003',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000003','wrapped',repeat('c',64));
    RAISE EXCEPTION 'REGRESSION: expired invite succeeded';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invite not valid' THEN RAISE; END IF; END;
END $$;
-- Legitimate creator bootstrap remains usable through RLS.
INSERT INTO public.households(id,name,created_by) VALUES
 ('72000000-0000-0000-0000-000000000002','Bootstrap',auth.uid());
INSERT INTO public.household_members(household_id,user_id,role,wrapped_kh) VALUES
 ('72000000-0000-0000-0000-000000000002',auth.uid(),'owner','fixture-wrapped');
RESET ROLE;
-- Privileged maintenance cannot move a third member into a full household.
DO $$ BEGIN
  BEGIN
    UPDATE public.household_members SET household_id='72000000-0000-0000-0000-000000000001'
      WHERE user_id='71000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'REGRESSION: UPDATE bypassed capacity';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'household is full' THEN RAISE; END IF; END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.consume_household_invite('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','fixture',repeat('a',64));
    RAISE EXCEPTION 'REGRESSION: anonymous consume executable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.household_members WHERE household_id='72000000-0000-0000-0000-000000000001') <> 2 THEN RAISE EXCEPTION 'join missing'; END IF;
  IF (SELECT consumed_at IS NULL FROM public.household_invites WHERE id='73000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'consume missing'; END IF;
END;
$$;
ROLLBACK;
