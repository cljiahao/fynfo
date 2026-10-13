// Fresh synthetic PostgreSQL/PostgREST only. Existing images; never pull or attach a real DB.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const docker = process.argv[2] ?? 'docker';
const suffix = randomUUID().slice(0, 8);
const pgName = `fynfo138-synthetic-pg-${suffix}`;
const netName = `fynfo138-synthetic-net-${suffix}`;
const restName = `fynfo138-synthetic-rest-${suffix}`;
const resources = [];
let network;
let failure;
const run = async (args) =>
  (
    await execute(docker, args, {
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    })
  ).stdout.trim();
const owned = (id) => {
  assert.match(id, /^[a-f0-9]{64}$/);
  resources.push(id);
  return id;
};
const sql = (query) =>
  run([
    'exec',
    pgName,
    'psql',
    '-U',
    'postgres',
    '-d',
    'recurring_fixture',
    '-X',
    '-q',
    '-t',
    '-A',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    query,
  ]);
const A = '13800000-0000-4000-8000-000000000101';
const B = '13800000-0000-4000-8000-000000000102';
const bookId = randomUUID();
const jwtKey = 'fynfo138-synthetic-only-jwt-signing-key';
const jwt = (sub, role = 'authenticated') => {
  const part = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ role, sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}`;
  return `${part}.${createHmac('sha256', jwtKey).update(part).digest('base64url')}`;
};
const pause = () => new Promise((done) => setTimeout(done, 250));
try {
  network = await run(['network', 'create', netName]);
  assert.match(network, /^[a-f0-9]{64}$/);
  owned(
    await run([
      'run',
      '-d',
      '--pull=never',
      '--name',
      pgName,
      '--network',
      netName,
      '--tmpfs',
      '/var/lib/postgresql/data:rw',
      '-e',
      'POSTGRES_PASSWORD=synthetic-fixture-only',
      '-e',
      'POSTGRES_DB=recurring_fixture',
      'postgres:17-alpine',
    ])
  );
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      await run([
        'exec',
        pgName,
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'recurring_fixture',
      ]);
      ready = true;
      break;
    } catch {
      await pause();
    }
  }
  assert.ok(ready, 'new PostgreSQL readiness');
  await sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create role authenticator login password 'synthetic-fixture-only'; grant anon,authenticated,service_role to authenticator;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid; $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'); $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;`);
  await sql(
    await readFile(
      new URL('../migrations/20260411150000_init.sql', import.meta.url),
      'utf8'
    )
  );
  await sql(
    await readFile(
      new URL(
        '../migrations/20261013000138_personal_recurring_rulebooks.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  await sql(
    await readFile(
      new URL(
        '../../test/security/138-recurring-rulebooks.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  await sql(`insert into auth.users values ('${A}'),('${B}');`);
  const transaction = (call) =>
    `begin; set local role authenticated; set local "request.jwt.claim.sub"='${A}'; set local "request.jwt.claim.role"='authenticated'; select row_to_json(r) from (${call}) r; select pg_sleep(1); commit;`;
  const race = async (calls) => {
    const pending = calls.map((call) => sql(transaction(call)));
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      const observed = await sql(
        "select count(*) from pg_stat_activity where pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%compare_save_personal_recurring_rulebook%';"
      );
      if (Number(observed) > 0) {
        blocked = true;
        break;
      }
      await pause();
    }
    const results = await Promise.all(pending);
    assert.ok(blocked, 'observed concurrent row/unique lock contention');
    assert.equal(
      results.filter((result) => result.includes('SAVED')).length,
      1
    );
    assert.equal(
      results.filter((result) => result.includes('CONFLICT')).length,
      calls.length - 1
    );
  };
  await race(
    Array.from(
      { length: 4 },
      () =>
        `select * from public.compare_save_personal_recurring_rulebook('${bookId}',0,'synthetic-create')`
    )
  );
  await race(
    Array.from(
      { length: 4 },
      (_, i) =>
        `select * from public.compare_save_personal_recurring_rulebook('${bookId}',1,'synthetic-edit-${i}')`
    )
  );
  assert.equal(
    await sql(
      `select revision from public.personal_recurring_rulebooks where user_id='${A}'`
    ),
    '2'
  );
  // A failed surrounding transaction must roll back payload and revision together.
  await assert.rejects(
    sql(
      transaction(
        `select * from public.compare_save_personal_recurring_rulebook('${bookId}',2,'rollback')`
      ).replace('select pg_sleep(1)', 'select 1/0')
    )
  );
  assert.equal(
    await sql(
      `select revision from public.personal_recurring_rulebooks where user_id='${A}'`
    ),
    '2'
  );
  owned(
    await run([
      'run',
      '-d',
      '--pull=never',
      '--name',
      restName,
      '--network',
      netName,
      '-p',
      '127.0.0.1::3000',
      '-e',
      `PGRST_DB_URI=postgres://authenticator:synthetic-fixture-only@${pgName}:5432/recurring_fixture`,
      '-e',
      'PGRST_DB_ANON_ROLE=anon',
      '-e',
      'PGRST_DB_SCHEMAS=public',
      '-e',
      `PGRST_JWT_SECRET=${jwtKey}`,
      'public.ecr.aws/supabase/postgrest:v14.14',
    ])
  );
  const port = await run(['port', restName, '3000/tcp']);
  assert.match(port, /^127\.0\.0\.1:\d+$/);
  const base = `http://${port}`;
  const request = async (
    path,
    body,
    owner = A,
    method = body === undefined ? 'GET' : 'POST',
    role = 'authenticated'
  ) => {
    const response = await fetch(`${base}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(owner === null
          ? {}
          : { Authorization: `Bearer ${jwt(owner, role)}` }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const content = await response.text();
    return {
      status: response.status,
      value: content ? JSON.parse(content) : null,
    };
  };
  ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if (
        (await request('personal_recurring_rulebooks', undefined, null))
          .status === 401
      ) {
        ready = true;
        break;
      }
    } catch {}
    await pause();
  }
  assert.ok(ready, 'new PostgREST readiness');
  const readPath =
    'personal_recurring_rulebooks?select=id,revision::text,payload';
  const own = await request(readPath);
  assert.equal(own.status, 200);
  assert.equal(own.value[0].revision, '2');
  const other = await request(readPath, undefined, B);
  assert.equal(other.status, 200);
  assert.deepEqual(other.value, []);
  const body = {
    p_id: bookId,
    p_expected_revision: '2',
    p_payload: 'synthetic-empty-book',
  };
  const rpcPath = 'rpc/compare_save_personal_recurring_rulebook';
  assert.equal((await request(rpcPath, body, null)).status, 401);
  assert.equal(
    (await request(rpcPath, body, A, 'POST', 'service_role')).status,
    403
  );
  assert.equal((await request(rpcPath, body, B)).value[0].status, 'CONFLICT');
  assert.equal(
    (
      await request(
        'personal_recurring_rulebooks',
        { payload: 'forged' },
        A,
        'PATCH'
      )
    ).status,
    403
  );
  assert.equal(
    (await request('personal_recurring_rulebooks', undefined, A, 'DELETE'))
      .status,
    403
  );
  assert.equal((await request(rpcPath, body)).value[0].status, 'SAVED');
  assert.equal(
    (await request(rpcPath, { ...body, p_expected_revision: '0' })).value[0]
      .status,
    'CONFLICT'
  );
  const expense = {
    id: randomUUID(),
    date: '2026-02-28',
    type: 'bills',
    item: 'synthetic-encrypted-item',
    info: 'synthetic-encrypted-info',
    amount: 'synthetic-encrypted-amount',
  };
  const quotedExpense = JSON.stringify(expense);
  // Confirm and Skip compete for the same revision. Ciphertext receipt contents
  // are action-validated; this race proves the database's atomic exclusion.
  await race([
    `select * from public.compare_save_personal_recurring_rulebook('${bookId}',3,'confirm-receipt','${quotedExpense}'::jsonb)`,
    `select * from public.compare_save_personal_recurring_rulebook('${bookId}',3,'skip-receipt',null)`,
  ]);
  const winner = await sql(
    `select payload from public.personal_recurring_rulebooks where user_id='${A}'`
  );
  assert.equal(
    await sql(
      `select count(*) from public.expense_records where id='${expense.id}'`
    ),
    winner === 'confirm-receipt' ? '1' : '0'
  );
  const confirmedExpense = { ...expense, id: randomUUID(), date: '2026-03-03' };
  const confirm = {
    ...body,
    p_expected_revision: '4',
    p_payload: 'retained-february-receipt',
    p_expense: confirmedExpense,
  };
  const confirmed = await request(rpcPath, confirm);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.value[0].revision, '5');
  const savedExpenses = await request(
    `expense_records?id=eq.${confirmedExpense.id}&select=id,user_id,date,type,item,info,amount,split_type`
  );
  assert.equal(savedExpenses.status, 200);
  assert.equal(savedExpenses.value.length, 1);
  assert.equal(savedExpenses.value[0].user_id, A);
  assert.equal(savedExpenses.value[0].split_type, 'self');
  assert.equal(savedExpenses.value[0].amount, confirmedExpense.amount);
  assert.deepEqual(
    (
      await request(
        `expense_records?id=eq.${confirmedExpense.id}`,
        undefined,
        B
      )
    ).value,
    []
  );
  // Insertion collision rolls the prior book update back within the RPC.
  const collision = await request(rpcPath, {
    ...confirm,
    p_expected_revision: '5',
    p_payload: 'must-rollback',
  });
  assert.equal(collision.status, 409);
  const afterCollision = await request(readPath);
  assert.equal(afterCollision.value[0].revision, '5');
  assert.equal(afterCollision.value[0].payload, 'retained-february-receipt');
  assert.equal(
    (
      await request(
        `expense_records?id=eq.${confirmedExpense.id}`,
        undefined,
        A,
        'DELETE'
      )
    ).status,
    204
  );
  assert.equal((await request(rpcPath, confirm)).value[0].status, 'CONFLICT');
  assert.deepEqual(
    (await request(`expense_records?id=eq.${confirmedExpense.id}`)).value,
    []
  );
  for (const invalidExpense of [
    { ...expense, extra: true },
    { ...expense, id: 'invalid' },
    { ...expense, date: '2026-02-30' },
    { ...expense, type: 'unsupported' },
    { ...expense, amount: 100 },
    { ...expense, item: '' },
  ]) {
    assert.equal(
      (
        await request(rpcPath, {
          ...confirm,
          p_expected_revision: '5',
          p_expense: invalidExpense,
        })
      ).status,
      400
    );
    assert.equal((await request(readPath)).value[0].revision, '5');
  }
  await sql(
    `update public.personal_recurring_rulebooks set revision=9007199254740993 where user_id='${A}'`
  );
  const big = await request(rpcPath, {
    ...body,
    p_expected_revision: '9007199254740993',
  });
  assert.equal(big.value[0].revision, '9007199254740994');
  assert.equal((await request(readPath)).value[0].revision, '9007199254740994');
  for (const invalid of [
    { p_payload: '' },
    { p_payload: 'x'.repeat(1048577) },
    { p_expected_revision: null },
    { p_expected_revision: '-1' },
    { p_expected_revision: '9223372036854775807' },
  ])
    assert.equal((await request(rpcPath, { ...body, ...invalid })).status, 400);
  await sql(`delete from auth.users where id='${A}'`);
  assert.deepEqual((await request(readPath)).value, []);
  process.stdout.write(
    'PASS: fresh PG17/PostgREST14.14 owner/RLS/grants, direct-write denial, observed create/CAS/Confirm-Skip races, atomic expense insertion, collision rollback, deleted-expense replay exclusion, lossless revisions, input bounds and account cascade.\n'
  );
} catch (error) {
  failure = error;
} finally {
  const failures = failure ? [failure] : [];
  for (const id of resources.reverse()) {
    try {
      await run(['stop', id]);
    } catch (error) {
      failures.push(error);
    }
    try {
      await run(['rm', id]);
    } catch (error) {
      failures.push(error);
    }
  }
  if (network)
    try {
      await run(['network', 'rm', network]);
    } catch (error) {
      failures.push(error);
    }
  if (failures.length)
    throw new AggregateError(
      failures,
      '138 synthetic SQL verification or owned-resource cleanup failed'
    );
}
