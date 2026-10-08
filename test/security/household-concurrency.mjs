export async function runHouseholdConcurrency(fixture) {
  const migration = await fixture.read(
    'supabase/migrations/20261008000001_household_authorization.sql'
  );
  const preflight = migration.match(/DO \$\$[\s\S]*?\$\$;/)?.[0];
  if (!preflight) throw new Error('Missing migration preflight');
  const conflicts = (
    await fixture.read('test/security/household-conflicts.sql')
  ).replace(':preflight', () => preflight);
  for (const conflict of ['duplicate', 'capacity']) {
    const failure = await fixture.sql(
      `SET fynfo.fixture_conflict='${conflict}'; ${conflicts}`,
      { allowFailure: true }
    );
    if (
      failure.code === 0 ||
      !failure.stderr.includes('household migration blocked: reconcile')
    )
      throw new Error('Conflict preflight did not reject fixture');
  }
  await fixture.sql(`DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM auth.users WHERE id='77000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'conflict fixture persisted'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.household_members'::regclass AND conname='household_members_one_household_per_user') THEN RAISE EXCEPTION 'constraint rollback missing'; END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.household_members'::regclass AND tgname='trg_household_member_cap' AND tgenabled <> 'O') THEN RAISE EXCEPTION 'trigger rollback missing'; END IF;
END $$;`);
  await fixture.sql(`INSERT INTO auth.users(id) VALUES
 ('74000000-0000-0000-0000-000000000001'),('74000000-0000-0000-0000-000000000002'),
 ('74000000-0000-0000-0000-000000000003'),('74000000-0000-0000-0000-000000000004'),
 ('74000000-0000-0000-0000-000000000005'),('74000000-0000-0000-0000-000000000006');
INSERT INTO public.households(id,name,created_by) VALUES
 ('75000000-0000-0000-0000-000000000001','Concurrent cap','74000000-0000-0000-0000-000000000001'),
 ('75000000-0000-0000-0000-000000000002','Concurrent unique A','74000000-0000-0000-0000-000000000004'),
 ('75000000-0000-0000-0000-000000000003','Concurrent unique B','74000000-0000-0000-0000-000000000005');
INSERT INTO public.household_members(household_id,user_id,role,wrapped_kh) VALUES
 ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','owner','fixture'),
 ('75000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000004','owner','fixture'),
 ('75000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000005','owner','fixture');
INSERT INTO public.household_invites(id,household_id,invite_code_hash,kdf_salt,wrapped_kh_under_invite,created_by,expires_at) VALUES
 ('76000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',repeat('a',64),'salt','fixture','74000000-0000-0000-0000-000000000001',now()+interval '1 hour'),
 ('76000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001',repeat('b',64),'salt','fixture','74000000-0000-0000-0000-000000000001',now()+interval '1 hour'),
 ('76000000-0000-0000-0000-000000000003','75000000-0000-0000-0000-000000000002',repeat('c',64),'salt','fixture','74000000-0000-0000-0000-000000000004',now()+interval '1 hour'),
 ('76000000-0000-0000-0000-000000000004','75000000-0000-0000-0000-000000000003',repeat('d',64),'salt','fixture','74000000-0000-0000-0000-000000000005',now()+interval '1 hour');`);
  const join = (invite, user, proof, isolation = 'READ COMMITTED') =>
    `BEGIN ISOLATION LEVEL ${isolation}; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','74000000-0000-0000-0000-00000000000${user}',true); SELECT public.consume_household_invite('76000000-0000-0000-0000-00000000000${invite}','74000000-0000-0000-0000-00000000000${user}','fixture',repeat('${proof}',64)); SELECT pg_sleep(1); COMMIT;`;
  const race = (queries) =>
    fixture.concurrent(queries, {
      expectedSuccesses: 1,
      expectedFailurePattern:
        /household is full|duplicate key value|could not serialize|user already belongs/,
      observeQuery: 'consume_household_invite',
    });
  try {
    await race([join(1, 2, 'a'), join(2, 3, 'b')]);
    await fixture.sql(
      "DELETE FROM public.household_members WHERE user_id IN ('74000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000003'); UPDATE public.household_invites SET consumed_at=NULL WHERE id IN ('76000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000002');"
    );
    await race([
      join(1, 2, 'a', 'REPEATABLE READ'),
      join(2, 3, 'b', 'REPEATABLE READ'),
    ]);
    await race([join(3, 6, 'c'), join(4, 6, 'd')]);
    await fixture.sql(`DO $$ BEGIN
 IF (SELECT count(*) FROM public.household_members WHERE household_id='75000000-0000-0000-0000-000000000001') <> 2 THEN RAISE EXCEPTION 'capacity race'; END IF;
 IF (SELECT count(*) FROM public.household_members WHERE user_id='74000000-0000-0000-0000-000000000006') <> 1 THEN RAISE EXCEPTION 'unique membership race'; END IF;
 IF (SELECT count(*) FROM public.household_invites WHERE consumed_at IS NOT NULL AND id IN ('76000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000002')) <> 1 THEN RAISE EXCEPTION 'failed join consumed invite'; END IF;
END $$;`);
  } finally {
    await fixture.sql(
      "DELETE FROM auth.users WHERE id IN ('74000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000004','74000000-0000-0000-0000-000000000005','74000000-0000-0000-0000-000000000006');"
    );
  }
}
