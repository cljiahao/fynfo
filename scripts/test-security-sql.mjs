import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAtomicFinancialConcurrency } from '../test/security/atomic-financial-concurrency.mjs';
import { runHouseholdConcurrency } from '../test/security/household-concurrency.mjs';
import { runVaultConcurrency } from '../test/security/vault-concurrency.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (
    !['--pg-bin', '--data-dir', '--port'].includes(args[index]) ||
    !args[index + 1]
  ) {
    throw new Error(
      'Usage: node scripts/test-security-sql.mjs --pg-bin PATH --data-dir NEW_PATH [--port 55472]'
    );
  }
  options.set(args[index], args[index + 1]);
}
if (!options.has('--pg-bin') || !options.has('--data-dir'))
  throw new Error('Explicit --pg-bin and new --data-dir required');
const pgBin = path.resolve(options.get('--pg-bin'));
const dataDir = path.resolve(options.get('--data-dir'));
const port = Number(options.get('--port') ?? 55472);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid fixture port');
try {
  await stat(dataDir);
  throw new Error(
    'Fixture data directory must not exist; retained clusters are never reused or deleted'
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(path.dirname(dataDir), { recursive: true });
const transcript = [];
function execute(binary, parameters, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      path.join(
        pgBin,
        `${binary}${process.platform === 'win32' ? '.exe' : ''}`
      ),
      parameters,
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill(), 30000);
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    // Windows pg_ctl's detached server can inherit pipe handles after pg_ctl exits.
    child.on(binary === 'pg_ctl' ? 'exit' : 'close', (code) => {
      clearTimeout(timeout);
      if (binary === 'pg_ctl') {
        child.stdout.destroy();
        child.stderr.destroy();
      }
      transcript.push(`${binary}: exit=${code}\n${stdout}${stderr}`);
      if (code !== 0 && !allowFailure)
        reject(new Error(`${binary} failed (${code}): ${stderr}`));
      else resolve({ code, stdout, stderr });
    });
  });
}
const connection = [
  '-h',
  '127.0.0.1',
  '-p',
  String(port),
  '-U',
  'fynfo_fixture',
  '-d',
  'fynfo_security_fixture',
  '-X',
  '-q',
  '-v',
  'ON_ERROR_STOP=1',
];
const fixture = {
  read: (relative) => readFile(path.join(root, relative), 'utf8'),
  sql: (sql, { allowFailure = false } = {}) =>
    execute('psql', [...connection, '-t', '-A', '-c', sql], allowFailure),
  file: (relative) =>
    execute('psql', [...connection, '-f', path.join(root, relative)]),
  async concurrent(
    queries,
    { expectedSuccesses, expectedFailurePattern, observeQuery }
  ) {
    const running = queries.map((sql) =>
      fixture.sql(sql, { allowFailure: true })
    );
    let observed = false;
    for (let probe = 0; probe < 15; probe++) {
      const observation = await fixture.sql(
        `SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%${observeQuery}%';`
      );
      if (Number(observation.stdout.trim()) > 0) {
        observed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const results = await Promise.all(running);
    if (!observed)
      throw new Error('No overlapping blocked SQL worker observed');
    if (
      results.filter((result) => result.code === 0).length !== expectedSuccesses
    )
      throw new Error(
        `Unexpected concurrent result: ${JSON.stringify(results)}`
      );
    if (
      expectedFailurePattern &&
      results.some(
        (result) =>
          result.code !== 0 && !expectedFailurePattern.test(result.stderr)
      )
    )
      throw new Error('Concurrent worker failed for an unexpected reason');
    return results;
  },
};
const histories = [
  '20260411150000_init.sql',
  '20260413000000_add_vault_check.sql',
  '20260414000000_add_profile_insert_policy.sql',
  '20260527000000_add_vault_v2.sql',
  '20260602000000_add_vault_unlock_throttle.sql',
  '20260611000000_add_marketing_telemetry.sql',
  '20260626000000_add_household.sql',
  '20260627000000_add_household_goals.sql',
  '20260705000000_fix_household_creator_select.sql',
  '20261008000000_security_rpc_boundaries.sql',
  '20261008000001_household_authorization.sql',
  '20261009000000_atomic_financial_replacements.sql',
];
let started = false;
try {
  await execute('initdb', [
    '-D',
    dataDir,
    '-U',
    'fynfo_fixture',
    '--auth=trust',
    '--no-locale',
    '--encoding=UTF8',
  ]);
  started = true;
  await execute('pg_ctl', [
    '-D',
    dataDir,
    '-l',
    path.join(dataDir, 'fixture-postgres.log'),
    '-o',
    `-h 127.0.0.1 -p ${port}`,
    '-w',
    '-t',
    '20',
    'start',
  ]);
  await execute('psql', [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'fynfo_fixture',
    '-d',
    'postgres',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'CREATE DATABASE fynfo_security_fixture;',
  ]);
  await fixture.file('test/security/bootstrap.sql');
  for (const migration of histories)
    await fixture.file(`supabase/migrations/${migration}`);
  await fixture.file('test/security/household-authorization.sql');
  await fixture.file('test/security/vault-telemetry-authorization.sql');
  await fixture.file('test/security/atomic-financial-replacements.sql');
  await runHouseholdConcurrency(fixture);
  await runVaultConcurrency(fixture);
  await runAtomicFinancialConcurrency(fixture);
  process.stdout.write(
    'Real SQL authorization, conflict and concurrent boundaries passed.\n'
  );
} finally {
  try {
    if (started)
      await execute('pg_ctl', [
        '-D',
        dataDir,
        '-w',
        '-t',
        '20',
        '-m',
        'fast',
        'stop',
      ]);
  } finally {
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      path.join(dataDir, 'fixture-tests.log'),
      transcript.join('\n'),
      'utf8'
    );
  }
}
