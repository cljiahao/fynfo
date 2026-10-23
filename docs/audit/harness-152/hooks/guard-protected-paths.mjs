// PreToolUse guard for Write/Edit.
// Secrets, env files (except .env.example) and key material: hard block (exit 2).
// Rulebooks, .claude/**, CI workflows, build-push.sh inside this repo: ask the
// owner (JSON "ask"). Paths outside the project (scratchpads) are not governed.
// Cross-platform via node; strips a leading BOM some shells prepend.

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

const secretPatterns = [
  /\/\.env(?!\.example(\.|$))(\.|$)/,
  /\.(pem|key|p12|pfx|secret)$/,
  /\/(credentials\.json|\.netrc|\.secrets)$/,
  /\/secrets\//,
];

const askPatterns = [
  /^(CLAUDE|AGENTS|CONSTITUTION)\.md$/,
  /^\.claude\//,
  /^\.github\/workflows\//,
  /^scripts\/build-push\.sh$/,
];

function ask(path) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `${path} is a governance/enforcement/CI file. Owner approval required (CONSTITUTION S8.2).`,
      },
    })
  );
  process.exit(0);
}

function relativeToProject(normalized, cwd) {
  const root = cwd.replace(/\\/g, '/').replace(/\/$/, '') + '/';
  const lower = normalized.toLowerCase();
  if (lower.startsWith(root.toLowerCase()))
    return normalized.slice(root.length);
  return /^[a-z]:\/|^\//i.test(normalized) ? null : normalized;
}

function decide(raw) {
  let payload;
  try {
    raw = raw.replace(BOM, '');
    if (!raw.trim()) process.exit(0);
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const tool = payload.tool_name;
  if (tool !== 'Write' && tool !== 'Edit') process.exit(0);

  const path = payload.tool_input?.file_path;
  if (!path) process.exit(0);

  const normalized = path.replace(/\\/g, '/');
  if (secretPatterns.some((re) => re.test(normalized))) {
    process.stderr.write(
      `BLOCKED: ${path} is a secret/credential file. Agents never edit secrets (CONSTITUTION S5.3, S8.2).\n`
    );
    process.exit(2);
  }

  const rel = relativeToProject(normalized, payload.cwd ?? process.cwd());
  if (rel !== null && askPatterns.some((re) => re.test(rel))) ask(path);
  process.exit(0);
}

if (process.stdin.isTTY) process.exit(0);
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => decide(raw));
