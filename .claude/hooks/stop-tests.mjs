// Stop hook: run the test suite at turn end (spec 010 enforcement).
// Tail to stderr; exit 2 on failure so a red suite must be fixed before stopping.
// Cross-platform (Windows + macOS) via node.
import { execSync } from 'node:child_process';

let output = '';
let code = 0;
try {
  output = execSync('pnpm test:ci', {
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
    `Stop hook: pnpm test:ci FAILED (exit ${code}). Fix tests before ending the turn (AGENTS.md section 3 gates).\n`
  );
  process.exit(2);
}

process.stderr.write(
  'Stop hook: tests green. Reminder: spec linked? sections cited? scope respected?\n'
);
process.exit(0);
