// Fresh synthetic PostgreSQL/PostgREST only. Existing images; never pull or attach a real DB.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const docker = process.argv[2] ?? 'docker';
const suffix = randomUUID().slice(0, 8);
const pgName = `fynfo137-synthetic-pg-${suffix}`;
const netName = `fynfo137-synthetic-net-${suffix}`;
const restName = `fynfo137-synthetic-rest-${suffix}`;
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
    'merchant_fixture',
    '-X',
    '-q',
    '-t',
    '-A',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    query,
  ]);
const A = '13700000-0000-4000-8000-000000000101';
const B = '13700000-0000-4000-8000-000000000102';
const bookId = randomUUID();
const jwtKey = 'fynfo137-synthetic-only-jwt-signing-key';
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
      'POSTGRES_DB=merchant_fixture',
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
        'merchant_fixture',
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
      new URL(
        '../migrations/20261013000137_personal_merchant_rulebooks.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  await sql(
    await readFile(
      new URL(
        '../../test/security/137-merchant-rulebooks.sql',
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
        "select count(*) from pg_stat_activity where pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%compare_save_personal_merchant_rulebook%';"
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
        `select * from public.compare_save_personal_merchant_rulebook('${bookId}',0,'synthetic-create')`
    )
  );
  await race(
    Array.from(
      { length: 4 },
      (_, i) =>
        `select * from public.compare_save_personal_merchant_rulebook('${bookId}',1,'synthetic-edit-${i}')`
    )
  );
  assert.equal(
    await sql(
      `select revision from public.personal_merchant_rulebooks where user_id='${A}'`
    ),
    '2'
  );
  // A failed surrounding transaction must roll back payload and revision together.
  await assert.rejects(
    sql(
      transaction(
        `select * from public.compare_save_personal_merchant_rulebook('${bookId}',2,'rollback')`
      ).replace('select pg_sleep(1)', 'select 1/0')
    )
  );
  assert.equal(
    await sql(
      `select revision from public.personal_merchant_rulebooks where user_id='${A}'`
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
      `PGRST_DB_URI=postgres://authenticator:synthetic-fixture-only@${pgName}:5432/merchant_fixture`,
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
    return { status: response.status, value: await response.json() };
  };
  ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if (
        (await request('personal_merchant_rulebooks', undefined, null))
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
    'personal_merchant_rulebooks?select=id,revision::text,payload';
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
  const rpcPath = 'rpc/compare_save_personal_merchant_rulebook';
  assert.equal((await request(rpcPath, body, null)).status, 401);
  assert.equal(
    (await request(rpcPath, body, A, 'POST', 'service_role')).status,
    403
  );
  assert.equal((await request(rpcPath, body, B)).value[0].status, 'CONFLICT');
  assert.equal(
    (
      await request(
        'personal_merchant_rulebooks',
        { payload: 'forged' },
        A,
        'PATCH'
      )
    ).status,
    403
  );
  assert.equal(
    (await request('personal_merchant_rulebooks', undefined, A, 'DELETE'))
      .status,
    403
  );
  assert.equal((await request(rpcPath, body)).value[0].status, 'SAVED');
  assert.equal(
    (await request(rpcPath, { ...body, p_expected_revision: '0' })).value[0]
      .status,
    'CONFLICT'
  );
  await sql(
    `update public.personal_merchant_rulebooks set revision=9007199254740993 where user_id='${A}'`
  );
  const big = await request(rpcPath, {
    ...body,
    p_expected_revision: '9007199254740993',
  });
  assert.equal(big.value[0].revision, '9007199254740994');
  assert.equal((await request(readPath)).value[0].revision, '9007199254740994');
  for (const invalid of [
    { p_payload: '' },
    { p_payload: 'x'.repeat(262145) },
    { p_expected_revision: null },
    { p_expected_revision: '-1' },
    { p_expected_revision: '9223372036854775807' },
  ])
    assert.equal((await request(rpcPath, { ...body, ...invalid })).status, 400);
  await sql(`delete from auth.users where id='${A}'`);
  assert.deepEqual((await request(readPath)).value, []);
  process.stdout.write(
    'PASS: fresh PG17/PostgREST14.14 owner/RLS/grants, direct-write denial, observed create/CAS races, rollback, retained empty book, lossless revisions, input bounds and account cascade.\n'
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
      '137 synthetic SQL verification or owned-resource cleanup failed'
    );
}
