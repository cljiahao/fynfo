// Stop hook: run tests related to uncommitted source/test/config changes.
// Exit 2 on failure so a red suite must be fixed before stopping. A turn with
// no relevant changes skips the run; pre-push still runs the full gates.
// Cross-platform via node.
import { execSync } from 'node:child_process';

const RELEVANT =
  /^(src|test|supabase)\/|^(vitest|next|eslint)\.config\.|^(package\.json|tsconfig\.json)$/;

let changed = [];
try {
  changed = execSync('git status --porcelain', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
    .filter((path) => path && RELEVANT.test(path));
} catch {
  changed = ['<git status failed>'];
}

if (changed.length === 0) {
  process.stderr.write('Stop hook: no source/test changes; tests skipped.\n');
  process.exit(0);
}

let output = '';
let code = 0;
try {
  output = execSync('pnpm exec vitest run --changed HEAD --passWithNoTests', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  code = typeof err.status === 'number' ? err.status : 1;
}

const tail = output.split(/\r?\n/).slice(-20).join('\n');
process.stderr.write(tail + '\n');

if (code !== 0) {
  process.stderr.write(
    `Stop hook: related tests FAILED (exit ${code}). Fix them before ending the turn (AGENTS.md section 3).\n`
  );
  process.exit(2);
}

process.stderr.write(
  'Stop hook: related tests green. Full gates run on pre-push. Spec or audit record linked? Scope respected?\n'
);
process.exit(0);
