import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Runs `next dev` against the local Supabase stack. Values are passed
// through the child environment, which Next.js ranks above `.env*` files, so the
// hosted project's env files are never read or edited.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const shell = process.platform === 'win32';

let output;
try {
  output = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch {
  throw new Error('Local Supabase is not running. Run `pnpm db:start` first.');
}

const status = new Map();
for (const line of output.split(/\r?\n/)) {
  const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
  if (match) status.set(match[1], match[2]);
}

const url = status.get('API_URL');
const publishableKey = status.get('PUBLISHABLE_KEY') ?? status.get('ANON_KEY');
const secretKey = status.get('SECRET_KEY') ?? status.get('SERVICE_ROLE_KEY');
if (!url || !publishableKey || !secretKey)
  throw new Error('Local Supabase status is missing API_URL or keys.');
if (!LOCAL_HOSTS.has(new URL(url).hostname))
  throw new Error('Refusing to start: Supabase URL is not local.');

const child = spawn('pnpm', ['exec', 'next', 'dev', '--turbopack'], {
  shell,
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    SESSION_SECRET: randomBytes(32).toString('base64'),
    ADMIN_EMAILS: '',
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
