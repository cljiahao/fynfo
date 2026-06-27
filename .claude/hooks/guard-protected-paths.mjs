// PreToolUse guard: block edits to constitutional / governance / secret / CI files.
// Reads hook JSON from stdin. Exit 0 = allow. Exit 2 = block (reason on stderr).
// Cross-platform (Windows + macOS) via node — async stdin read; strips a leading
// BOM (some shells prepend one) before parsing.

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

const protectedPatterns = [
  /\/\.claude\/settings\.json$/,
  /\/\.claude\/harness\.json$/,
  /\/\.claude\/hooks\//,
  /\/\.claude\/skills\//,
  /\/\.env(?!\.example(\.|$))(\.|$)/,
  /\/scripts\/build-push\.sh$/,
  /\/\.github\/workflows\//,
  /\.(pem|key|p12|pfx|secret)$/,
  /\/(credentials\.json|\.netrc|\.secrets)$/,
];

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
  for (const re of protectedPatterns) {
    if (re.test(normalized)) {
      process.stderr.write(
        `BLOCKED: ${path} is governance/secret/CI-protected. Amend governance via specs/governance/ + human approval (CONSTITUTION.md S7.1 + S8.2); secrets/CI files are never agent-editable.\n`
      );
      process.exit(2);
    }
  }
  process.exit(0);
}

if (process.stdin.isTTY) process.exit(0);
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => decide(raw));
