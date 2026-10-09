export async function runAtomicFinancialConcurrency(fixture) {
  const owner = '79100000-0000-0000-0000-000000000001';
  await fixture.sql(`INSERT INTO auth.users(id) VALUES ('${owner}');`);
  const json = (value) => `'${JSON.stringify(value)}'::jsonb`;
  const transaction = (call, isolation = 'READ COMMITTED') =>
    `BEGIN ISOLATION LEVEL ${isolation}; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',true); SELECT ${call}; SELECT pg_sleep(1); COMMIT;`;
  const asset = (version) =>
    [1, 2].map((index) => ({
      id: `asset-${version}-${index}`,
      category: 'savings',
      account: 'fixture',
      amount: version,
    }));
  const record = {
    id: 'race-expense',
    date: '2026-10-01T00:00:00Z',
    type: 'other',
    item: 'fixture',
    info: 'fixture',
    amount: 'fixture',
    split_type: 'shared',
  };
  const split = (version) =>
    [1, 2].map((index) => ({
      id: `split-${version}-${index}`,
      person: 'Fixture',
      amount: version,
      settled: true,
    }));
  const relief = (version) =>
    [1, 2].map((index) => ({
      id: `relief-${version}-${index}`,
      relief_key: `${version}-${index}`,
      amount: version,
    }));
  const race = (name, calls) =>
    fixture.concurrent(
      calls.map((call) => transaction(call)),
      {
        expectedSuccesses: 2,
        observeQuery: name,
      }
    );
  try {
    for (const initial of [true, false]) {
      await race(
        'replace_asset_snapshot',
        ['A', 'B'].map(
          (v) =>
            `public.replace_asset_snapshot('2026-10',NULL,'parent-${v}',${json(asset(v))})`
        )
      );
      await race(
        'replace_expense_record',
        ['A', 'B'].map(
          (v) =>
            `public.replace_expense_record(${json({ ...record, amount: v })},${json(split(v))})`
        )
      );
      await race(
        'replace_tax_relief_year',
        ['A', 'B'].map(
          (v) => `public.replace_tax_relief_year(2026,${json(relief(v))})`
        )
      );
      await fixture.sql(`DO $$ BEGIN
        IF (SELECT count(*) FROM public.monthly_snapshots WHERE user_id='${owner}') <> 1
          OR (SELECT count(*) FROM public.asset_entries e JOIN public.monthly_snapshots s ON s.id=e.snapshot_id WHERE s.user_id='${owner}') <> 2
          OR (SELECT count(DISTINCT e.amount) FROM public.asset_entries e JOIN public.monthly_snapshots s ON s.id=e.snapshot_id WHERE s.user_id='${owner}') <> 1
          OR (SELECT count(*) FROM public.expense_splits WHERE expense_id='race-expense') <> 2
          OR EXISTS (SELECT 1 FROM public.expense_splits s JOIN public.expense_records e ON e.id=s.expense_id WHERE e.id='race-expense' AND s.amount<>e.amount)
          OR (SELECT count(*) FROM public.tax_relief_entries WHERE user_id='${owner}' AND year=2026) <> 2
          OR (SELECT count(DISTINCT amount) FROM public.tax_relief_entries WHERE user_id='${owner}' AND year=2026) <> 1
        THEN RAISE EXCEPTION 'REGRESSION: concurrent saves combined children'; END IF;
      END $$;`);
      if (initial) {
        const parent = await fixture.sql(
          `SELECT id FROM public.monthly_snapshots WHERE user_id='${owner}' AND month='2026-10';`
        );
        await fixture.sql(
          `SELECT set_config('request.jwt.claim.sub','${owner}',false); SET ROLE authenticated; SELECT public.replace_asset_snapshot('2026-10',NULL,'retry-parent',${json(asset('retry'))}); RESET ROLE; DO $$ BEGIN IF (SELECT id FROM public.monthly_snapshots WHERE user_id='${owner}') <> '${parent.stdout.trim()}' THEN RAISE EXCEPTION 'REGRESSION: parent ID changed'; END IF; END $$;`
        );
      }
    }
    await race('replace_tax_relief_year', [
      `public.replace_tax_relief_year(2027,'[]')`,
      `public.replace_tax_relief_year(2027,${json(relief('empty-race'))})`,
    ]);
    await fixture.sql(`DO $$ BEGIN
      IF (SELECT count(*) FROM public.tax_relief_entries WHERE user_id='${owner}' AND year=2027) NOT IN (0,2)
      THEN RAISE EXCEPTION 'REGRESSION: incomplete empty-year race'; END IF;
    END $$;`);
    const rejected = await fixture.sql(
      transaction(
        `public.replace_tax_relief_year(2028,'[]')`,
        'REPEATABLE READ'
      ),
      { allowFailure: true }
    );
    if (
      rejected.code === 0 ||
      !rejected.stderr.includes('requires read committed')
    )
      throw new Error('Stale-snapshot isolation was not rejected');
  } finally {
    await fixture.sql(`DELETE FROM auth.users WHERE id='${owner}';`);
  }
}
