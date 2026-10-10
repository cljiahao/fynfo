// Spec103: fresh synthetic PostgreSQL/PostgREST only, no existing-DB fallback.
// Requires existing postgres:17-alpine and Supabase PostgREST:v14.14 images.
// Run: node supabase/tests/103-personal-planning-scenarios.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
const executeRaw = promisify(execFile);
const execute = (file, args, options = {}) =>
  executeRaw(file, args, { timeout: 30000, ...options });
let verificationFailure;
const docker = process.argv[2] ?? 'docker';
const suffix = randomUUID().slice(0, 8);
const pgName = `fynfo103-synthetic-pg-${suffix}`;
const restName = `fynfo103-synthetic-rest-${suffix}`;
const networkName = `fynfo103-synthetic-net-${suffix}`;
let pgResource = null;
let restResource = null;
let networkResource = null;
let restBase = '';
const command = async (args) =>
  (await execute(docker, args, { maxBuffer: 1024 * 1024 })).stdout.trim();
const ownedResource = (value) => {
  assert.match(value, /^[a-f0-9]{64}$/);
  return value;
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 250));
try {
  networkResource = ownedResource(
    await command(['network', 'create', networkName])
  );
  pgResource = ownedResource(
    await command([
      'run',
      '-d',
      '--pull=never',
      '--name',
      pgName,
      '--network',
      networkName,
      '--tmpfs',
      '/var/lib/postgresql/data:rw',
      '-e',
      'POSTGRES_PASSWORD=synthetic-only-fixture',
      '-e',
      'POSTGRES_DB=scenario_fixture',
      'postgres:17-alpine',
    ])
  );
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await command([
        'exec',
        pgName,
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'scenario_fixture',
      ]);
      ready = true;
      break;
    } catch {
      await pause();
    }
  }
  assert.equal(ready, true, 'fresh synthetic PostgreSQL readiness');
  const bootstrap = `create role anon nologin; create role authenticated nologin; create role authenticator login password 'synthetic-only-fixture'; grant anon,authenticated to authenticator; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('33333333-3333-4333-8333-333333333333'); create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid; $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`;
  const runSetup = (query) =>
    command([
      'exec',
      pgName,
      'psql',
      '-U',
      'postgres',
      '-d',
      'scenario_fixture',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-c',
      query,
    ]);
  await runSetup(bootstrap);
  await runSetup(
    await readFile(
      new URL(
        '../migrations/20261010000103_personal_planning_scenarios.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  await runSetup(
    await readFile(
      new URL('./103_personal_planning_scenarios.sql', import.meta.url),
      'utf8'
    )
  );
  restResource = ownedResource(
    await command([
      'run',
      '-d',
      '--pull=never',
      '--name',
      restName,
      '--network',
      networkName,
      '-p',
      '127.0.0.1::3000',
      '-e',
      `PGRST_DB_URI=postgres://authenticator:synthetic-only-fixture@${pgName}:5432/scenario_fixture`,
      '-e',
      'PGRST_DB_ANON_ROLE=anon',
      '-e',
      'PGRST_DB_SCHEMAS=public',
      '-e',
      'PGRST_JWT_SECRET=fynfo103-synthetic-only-jwt-signing-secret',
      'public.ecr.aws/supabase/postgrest:v14.14',
    ])
  );
  const port = await command(['port', restName, '3000/tcp']);
  assert.match(port, /^127\.0\.0\.1:\d+$/);
  restBase = `http://${port}`;
  process.stdout.write(
    `Fresh synthetic resources: ${pgName}, ${restName}, ${networkName}; ${restBase}\n`
  );
  ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(
        `${restBase}/rpc/get_personal_planning_scenarios`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(1000),
        }
      );
      if (response.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await pause();
  }
  assert.equal(ready, true, 'fresh synthetic PostgREST readiness');
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '33333333-3333-4333-8333-333333333333';
  const sql = async (query, owner = A) => {
    const wrapped = `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${owner}'; ${query}; commit;`;
    const { stdout } = await execute(docker, [
      'exec',
      pgName,
      'psql',
      '-U',
      'postgres',
      '-d',
      'scenario_fixture',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-t',
      '-A',
      '-c',
      wrapped,
    ]);
    return stdout.trim();
  };
  const rpcSql = (query, owner) =>
    sql(`select row_to_json(r) from (select * from ${query}) r`, owner).then(
      JSON.parse
    );
  const create = (request, owner = A) =>
    rpcSql(
      `public.create_personal_planning_scenario('${request}','synthetic-ciphertext')`,
      owner
    );
  const rows = (owner = A) =>
    sql(
      "select coalesce(json_agg(r),'[]'::json) from public.get_personal_planning_scenarios() r",
      owner
    ).then(JSON.parse);
  const remove = (row, owner = A) =>
    rpcSql(
      `public.compare_delete_personal_planning_scenario('${row.id}',${row.revision})`,
      owner
    );
  const cleanup = async (owner = A) => {
    for (const row of await rows(owner))
      assert.equal((await remove(row, owner)).status, 'DELETED');
  };
  await cleanup();
  await cleanup(B);
  const request = randomUUID();
  const same = await Promise.all(
    Array.from({ length: 8 }, () => create(request))
  );
  assert.equal(same.filter((r) => r.status === 'CREATED').length, 1);
  assert.equal(same.filter((r) => r.status === 'EXISTING').length, 7);
  assert.equal(new Set(same.map((r) => r.id)).size, 1);
  const original = same[0];
  const secondOwner = await create(request, B);
  assert.equal(secondOwner.status, 'CREATED');
  assert.notEqual(secondOwner.id, original.id);
  const saves = await Promise.all(
    Array.from({ length: 8 }, () =>
      rpcSql(
        `public.compare_save_personal_planning_scenario('${original.id}',1,'synthetic-racing-save')`
      )
    )
  );
  assert.equal(saves.filter((r) => r.status === 'SAVED').length, 1);
  assert.equal(saves.filter((r) => r.status === 'CONFLICT').length, 7);
  const deletes = await Promise.all(
    Array.from({ length: 8 }, () => remove({ id: original.id, revision: '2' }))
  );
  assert.equal(deletes.filter((r) => r.status === 'DELETED').length, 1);
  assert.equal(deletes.filter((r) => r.status === 'CONFLICT').length, 7);
  const replacement = await create(request);
  assert.equal(replacement.status, 'CREATED');
  assert.notEqual(replacement.id, original.id);
  assert.equal(
    (await remove({ id: original.id, revision: '1' })).status,
    'CONFLICT'
  );
  assert.equal(
    (
      await rpcSql(
        `public.compare_save_personal_planning_scenario('${original.id}',1,'stale-incarnation')`
      )
    ).status,
    'CONFLICT'
  );
  const requests = Array.from({ length: 12 }, () => randomUUID());
  const capacity = await Promise.all(requests.map((r) => create(r)));
  assert.equal(capacity.filter((r) => r.status === 'CREATED').length, 9);
  assert.equal(capacity.filter((r) => r.status === 'CAPACITY').length, 3);
  assert.equal((await rows()).length, 10);
  await cleanup();
  await cleanup(B);
  const b64 = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = (owner) => {
    const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'authenticated', sub: owner, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
    return `${body}.${createHmac('sha256', 'fynfo103-synthetic-only-jwt-signing-secret').update(body).digest('base64url')}`;
  };
  const rest = async (fn, body, owner = A) => {
    const response = await fetch(`${restBase}/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(owner ? { Authorization: `Bearer ${jwt(owner)}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, value: await response.json() };
  };
  const jsonCreated = await rest('create_personal_planning_scenario', {
    p_creation_request_id: randomUUID(),
    p_payload: 'synthetic-JSON-ciphertext',
  });
  assert.equal(jsonCreated.status, 200);
  assert.equal(typeof jsonCreated.value[0].revision, 'string');
  const jsonId = jsonCreated.value[0].id;
  await sql(
    `update public.personal_planning_scenarios set revision = 9007199254740993 where id = '${jsonId}'`
  );
  const jsonRows = await rest('get_personal_planning_scenarios', {});
  assert.equal(jsonRows.status, 200);
  assert.equal(jsonRows.value[0].revision, '9007199254740993');
  const jsonSaved = await rest('compare_save_personal_planning_scenario', {
    p_id: jsonId,
    p_expected_revision: '9007199254740993',
    p_payload: 'synthetic-JSON-save',
  });
  assert.equal(jsonSaved.status, 200);
  assert.equal(jsonSaved.value[0].revision, '9007199254740994');
  assert.equal(typeof jsonSaved.value[0].revision, 'string');
  const forbidden = await rest('get_personal_planning_scenarios', {}, null);
  assert.equal(forbidden.status, 401);
  const other = await rest('get_personal_planning_scenarios', {}, B);
  assert.equal(other.status, 200);
  assert.deepEqual(other.value, []);
  await sql(
    `update public.personal_planning_scenarios set revision = 9223372036854775807 where id = '${jsonId}'`
  );
  const overflow = await rest('compare_save_personal_planning_scenario', {
    p_id: jsonId,
    p_expected_revision: '9223372036854775807',
    p_payload: 'synthetic-overflow',
  });
  assert.equal(overflow.status, 200);
  assert.equal(overflow.value[0].status, 'CONFLICT');
  const anonWrite = await rest(
    'create_personal_planning_scenario',
    { p_creation_request_id: randomUUID(), p_payload: 'synthetic' },
    null
  );
  assert.equal(anonWrite.status, 401);
  // Explicit authenticated JWT lacking a subject must also be denied.
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  const noSubjectJwt = `${head}.${createHmac('sha256', 'fynfo103-synthetic-only-jwt-signing-secret').update(head).digest('base64url')}`;
  const missingIdentity = await fetch(
    `${restBase}/rpc/create_personal_planning_scenario`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${noSubjectJwt}`,
      },
      body: JSON.stringify({
        p_creation_request_id: randomUUID(),
        p_payload: 'synthetic',
      }),
    }
  );
  assert.equal(missingIdentity.status, 400);
  const crossSave = await rest(
    'compare_save_personal_planning_scenario',
    {
      p_id: jsonId,
      p_expected_revision: '9223372036854775807',
      p_payload: 'forged',
    },
    B
  );
  assert.equal(crossSave.status, 200);
  assert.equal(crossSave.value[0].status, 'CONFLICT');
  const crossDelete = await rest(
    'compare_delete_personal_planning_scenario',
    { p_id: jsonId, p_expected_revision: '9223372036854775807' },
    B
  );
  assert.equal(crossDelete.status, 200);
  assert.equal(crossDelete.value[0].status, 'CONFLICT');
  const maxPayload = await rest('create_personal_planning_scenario', {
    p_creation_request_id: randomUUID(),
    p_payload: 'x'.repeat(32768),
  });
  assert.equal(maxPayload.status, 200);
  assert.equal(maxPayload.value[0].status, 'CREATED');
  const tooLong = await rest('create_personal_planning_scenario', {
    p_creation_request_id: randomUUID(),
    p_payload: 'x'.repeat(32769),
  });
  assert.equal(tooLong.status, 400);
  const emptyPayload = await rest('create_personal_planning_scenario', {
    p_creation_request_id: randomUUID(),
    p_payload: '',
  });
  assert.equal(emptyPayload.status, 400);
  await cleanup();
  process.stdout.write(
    'PASS: actual PG17 RLS fixture plus eight-session same-request/CAS/delete races, twelve-session ten-slot capacity, cross-owner UUID, delete/replay incarnation, PostgRESTv14.14 bigint-text JSON/anon denial/overflow. Synthetic rows cleaned through owner CAS RPCs.\n'
  );
} catch (error) {
  verificationFailure = error;
} finally {
  // Only IDs returned by successful fresh creation qualify for cleanup.
  // Attempt every owned resource even when another cleanup operation fails.
  const failures = verificationFailure ? [verificationFailure] : [];
  for (const resource of [restResource, pgResource]) {
    if (resource) {
      try {
        await command(['stop', resource]);
      } catch (error) {
        failures.push(error);
      }
      try {
        await command(['rm', resource]);
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (networkResource) {
    try {
      await command(['network', 'rm', networkResource]);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      'Synthetic SQL verification or owned-resource cleanup failed'
    );
}
