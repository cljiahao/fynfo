// PostToolUse feedback hook: incremental TypeScript typecheck.
// Feedback-only — always exits 0 (never blocks the agent). Cross-platform via node.
import { execSync } from 'node:child_process';

try {
  const out = execSync('pnpm exec tsc --noEmit --incremental', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tail = out.trim().split(/\r?\n/).slice(-5).join('\n');
  if (tail) process.stdout.write(tail + '\n');
} catch (err) {
  // tsc exits non-zero on type errors — surface the tail as feedback, don't block.
  const text = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
  const tail = text.split(/\r?\n/).slice(-5).join('\n');
  if (tail) process.stdout.write(tail + '\n');
}

process.exit(0);
