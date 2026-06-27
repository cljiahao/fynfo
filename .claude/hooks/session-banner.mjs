// SessionStart hook: print the governance banner + heads of CONSTITUTION / AGENTS.
// Cross-platform (Windows + macOS) via node.
import { readFileSync } from 'node:fs';

const head = (file, n) => {
  try {
    return readFileSync(file, 'utf8').split(/\r?\n/).slice(0, n).join('\n');
  } catch {
    return `(${file} not found)`;
  }
};

console.log(
  'FYNFO GOVERNANCE ACTIVE | Read CONSTITUTION.md + AGENTS.md before acting | ' +
    'Spec-first: no code without approved spec in specs/** | ' +
    'Gates: pnpm check && pnpm test:ci && pnpm build green | ' +
    'Hard stops: .env*, CONSTITUTION.md, AGENTS.md, .claude/**, specs/governance/**, destructive git/docker'
);
console.log('=== CONSTITUTION (head) ===');
console.log(head('CONSTITUTION.md', 20));
console.log('=== AGENTS (head) ===');
console.log(head('AGENTS.md', 30));
