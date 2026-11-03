/**
 * Times the queries behind getExpenses against a LOCAL Supabase seeded with
 * synthetic encrypted rows, then runs EXPLAIN (ANALYZE, BUFFERS) for one
 * records page and one splits page as the seeded user (RLS applied).
 *
 * Usage (Docker running, then `pnpm db:start`):
 *   node scripts/bench-expenses-read.mjs [scale ...]     default: 2500 10000
 * Writes EXPLAIN output to scripts/.bench-out/explain-<scale>.txt (gitignored). Seeded data and the throwaway
 * user are removed at the end. Refuses any non-localhost API URL.
 *
 * Keys come from `supabase status` at runtime and are never printed.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encryptPayload } from '../src/lib/crypto.ts';

const PAGE = 500;
const SHARED_RATIO = 0.4;
const DB_CONTAINER = 'supabase_db_fynfo';

function localStatus() {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const env = {};
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host))
    throw new Error(`refusing to run against non-local host: ${host}`);
}

const ms = (t) => Math.round(performance.now() - t);

async function pagedRead(build, label) {
  const pages = [];
  let rows = 0;
  let expected;
  const started = performance.now();
  do {
    const t = performance.now();
    const { data, error, count } = await build(rows, rows + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.code ?? error.status}`);
    expected = count;
    rows += data.length;
    pages.push(ms(t));
    if (data.length === 0) break;
  } while (rows < expected);
  return { rows, pagesMs: pages, totalMs: ms(started) };
}

function seedRows(userId, dek, records) {
  const recs = [];
  const splits = [];
  const base = Date.parse('2024-01-01T00:00:00Z');
  for (let i = 0; i < records; i++) {
    const id = randomUUID();
    const shared = Math.random() < SHARED_RATIO;
    recs.push({
      id,
      user_id: userId,
      date: new Date(base + (i % 1000) * 86_400_000).toISOString(),
      type: 'food_drink',
      item: encryptPayload('x'.repeat(20), dek),
      info: encryptPayload('y'.repeat(40), dek),
      amount: encryptPayload((Math.random() * 100).toFixed(2), dek),
      split_type: shared ? 'shared' : 'self',
    });
    if (shared) {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < n; s++)
        splits.push({
          id: randomUUID(),
          expense_id: id,
          person: `person-${s}`,
          amount: encryptPayload((Math.random() * 50).toFixed(2), dek),
          settled: false,
        });
    }
  }
  return { recs, splits };
}

async function insertBatched(admin, table, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + 1000));
    if (error) throw new Error(`seed ${table}: ${error.code ?? error.status}`);
  }
}

function psql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
}

function explain(userId) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
  const setup = `begin;
set local role authenticated;
select set_config('request.jwt.claims', '${claims}', true);
select set_config('request.jwt.claim.sub', '${userId}', true);
`;
  const records = `explain (analyze, buffers)
select id, date, type, item, info, amount, split_type from expense_records
where user_id = '${userId}' order by date desc, id asc limit ${PAGE};`;
  const splits = `explain (analyze, buffers)
select s.expense_id, s.person, s.amount, s.settled from expense_splits s
join expense_records p on p.id = s.expense_id
where p.user_id = '${userId}' order by s.expense_id, s.id limit ${PAGE};`;
  return [
    '-- records page 1',
    psql(`${setup}${records}\nrollback;`),
    '-- splits page 1 (!inner join)',
    psql(`${setup}${splits}\nrollback;`),
  ].join('\n');
}

async function runScale(env, records) {
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const email = `bench-${randomUUID()}@example.test`;
  const password = randomBytes(18).toString('base64url');
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    { email, password, email_confirm: true }
  );
  if (createErr)
    throw new Error(`create user: ${createErr.code ?? createErr.status}`);
  const userId = created.user.id;

  try {
    const dek = randomBytes(32);
    const { recs, splits } = seedRows(userId, dek, records);
    await insertBatched(admin, 'expense_records', recs);
    await insertBatched(admin, 'expense_splits', splits);

    const anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false },
    });
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr)
      throw new Error(`sign in: ${signInErr.code ?? signInErr.status}`);

    const recordsRead = await pagedRead(
      (from, to) =>
        anon
          .from('expense_records')
          .select('id, date, type, item, info, amount, split_type', {
            count: 'exact',
          })
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      'records'
    );
    const splitsRead = await pagedRead(
      (from, to) =>
        anon
          .from('expense_splits')
          .select(
            'expense_id, person, amount, settled, parent:expense_records!inner(user_id)',
            { count: 'exact' }
          )
          .eq('parent.user_id', userId)
          .order('expense_id', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'splits'
    );

    mkdirSync('scripts/.bench-out', { recursive: true });
    writeFileSync(`scripts/.bench-out/explain-${records}.txt`, explain(userId));
    return {
      records,
      splitRowsSeeded: splits.length,
      recordsRead,
      splitsRead,
      sequentialTotalMs: recordsRead.totalMs + splitsRead.totalMs,
    };
  } finally {
    await admin.from('expense_records').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

const env = localStatus();
assertLocal(env.API_URL);
const scales = process.argv.slice(2).map(Number);
for (const scale of scales.length ? scales : [2500, 10000])
  process.stdout.write(`${JSON.stringify(await runScale(env, scale))}
`);
