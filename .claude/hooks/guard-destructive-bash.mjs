// PreToolUse guard: block destructive Bash commands.
// Reads hook JSON from stdin. Exit 0 = allow. Exit 2 = block (reason on stderr).
// Cross-platform (Windows + macOS) via node — async stdin read.

const patterns = [
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*\s-f(\s|$)/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-[a-z]*f/,
  /git\s+branch\s+-D/,
  /rm\s+-rf/,
  /--no-verify/,
  /docker\s+push/,
  /build-push\.sh/,
  /DROP\s+TABLE/i,
  />\s*\.?\/?\.env/,
];

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

function decide(raw) {
  let payload;
  try {
    raw = raw.replace(BOM, '');
    if (!raw.trim()) process.exit(0);
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  if (payload.tool_name !== 'Bash') process.exit(0);
  const cmd = payload.tool_input?.command;
  if (!cmd) process.exit(0);

  for (const re of patterns) {
    if (re.test(cmd)) {
      process.stderr.write('BLOCKED: destructive command.\n');
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
