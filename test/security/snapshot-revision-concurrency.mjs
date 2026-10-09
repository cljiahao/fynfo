export async function runSnapshotRevisionConcurrency(fixture) {
  const owner = '83100000-0000-0000-0000-000000000001';
  await fixture.sql(`INSERT INTO auth.users(id) VALUES ('${owner}');`);
  const json = (version) =>
    JSON.stringify([
      {
        id: `revision-${version}`,
        category: 'savings',
        account: 'fixture',
        amount: version,
      },
    ]);
  const transaction = (call) =>
    `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',true); SELECT ${call}; SELECT pg_sleep(1); COMMIT;`;
  const race = (calls) =>
    fixture.concurrent(calls.map(transaction), {
      expectedSuccesses: 1,
      expectedFailurePattern: /snapshot conflict/,
      observeQuery: 'replace_asset_snapshot_if_current',
    });
  try {
    await race(
      ['A', 'B'].map(
        (v) =>
          `public.replace_asset_snapshot_if_current('2026-10',NULL,'revision-create-${v}',NULL,NULL,'${json(v)}')`
      )
    );
    const parent = (
      await fixture.sql(
        `SELECT id FROM public.monthly_snapshots WHERE user_id='${owner}' AND month='2026-10';`
      )
    ).stdout.trim();
    await fixture.sql(
      `DO $$ BEGIN IF (SELECT count(*) FROM public.monthly_snapshots WHERE user_id='${owner}')<>1 OR (SELECT revision FROM public.monthly_snapshots WHERE id='${parent}')<>1 THEN RAISE EXCEPTION 'REGRESSION: concurrent create'; END IF; END $$;`
    );
    await fixture.sql(
      transaction(
        `public.replace_asset_snapshot_if_current('2026-10','2026-10','unused','1','${parent}','${json('initial')}')`
      )
    );
    const reader = `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',true); DO $$ DECLARE s jsonb; BEGIN FOR i IN 1..150 LOOP s:=public.get_asset_snapshot_for_edit('2026-10'); IF jsonb_array_length(s->'entries')<>1 OR (s->>'revision'='2' AND s->'entries'->0->>'amount'<>'initial') OR (s->>'revision'='3' AND s->'entries'->0->>'amount' NOT IN ('edit-A','edit-B')) OR s->>'revision' NOT IN ('2','3') THEN RAISE EXCEPTION 'REGRESSION: incoherent version/payload'; END IF; PERFORM pg_sleep(0.01); END LOOP; END $$; COMMIT;`;
    await fixture.concurrent(
      [
        ...['A', 'B'].map((v) =>
          transaction(
            `public.replace_asset_snapshot_if_current('2026-10','2026-10','unused','2','${parent}','${json('edit-' + v)}')`
          )
        ),
        reader,
      ],
      {
        expectedSuccesses: 2,
        expectedFailurePattern: /snapshot conflict/,
        observeQuery: 'replace_asset_snapshot_if_current',
      }
    );
    await fixture.sql(
      `DO $$ BEGIN IF (SELECT revision FROM public.monthly_snapshots WHERE id='${parent}')<>3 OR (SELECT count(*) FROM public.asset_entries WHERE snapshot_id='${parent}')<>1 THEN RAISE EXCEPTION 'REGRESSION: concurrent edit'; END IF; END $$;`
    );
  } finally {
    await fixture.sql(`DELETE FROM auth.users WHERE id='${owner}';`);
  }
}
