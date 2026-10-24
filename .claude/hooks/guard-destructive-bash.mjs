// PreToolUse guard for Bash and PowerShell: hard-block destructive git/SQL/fs
// commands, shell reads or overwrites of real env files, and environment dumps.
// Exit 0 = allow (normal permission flow). Exit 2 = block (reason on stderr).
// Cross-platform via node; strips a leading BOM some shells prepend.

const ENV_FILE = String.raw`\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"|;&>)])`;
// A quoted .env followed by more arguments is a search pattern, not a path.
const ENV_TOKEN =
  String.raw`((^|[\s=/\\])` +
  ENV_FILE +
  String.raw`|(['"])(\.?/)?\.env(\.(?!example\b)[\w.-]+)?\5\s*($|[|;&>]))`;
const READ_VERBS = String.raw`\b(cat|type|less|more|head|tail|bat|nl|od|xxd|strings|Get-Content|gc|Select-String|sls|grep|rg|findstr|sed|awk|cp|copy|Copy-Item|mv|move|Move-Item|scp|curl|base64|certutil)\b[^|;&\n]*`;

const rules = [
  ['force push', /git\s+push\b[^\n]*(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/],
  ['hard reset', /git\s+reset\s+[^\n]*--hard/],
  ['git clean', /git\s+clean\s+-[a-z]*f/i],
  ['branch delete', /git\s+branch\s+[^\n]*(-D\b|--delete\s+--force|-d\s+-f)/],
  [
    'discard all changes',
    /git\s+(checkout\s+--|restore(?![^\n]*--staged))\s+\.(\s|$)/,
  ],
  ['stash drop', /git\s+stash\s+(drop|clear)\b/],
  ['hook bypass', /--no-verify\b/],
  [
    'recursive force delete',
    /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r\s+-f|-f\s+-r)\b/i,
  ],
  [
    'recursive force delete',
    /Remove-Item\b(?=[^\n]*-Recurse)(?=[^\n]*-Force)/i,
  ],
  ['docker push', /docker\s+push\b/],
  ['build-push', /build-push\.sh/],
  [
    'destructive SQL',
    /\b(DROP\s+(TABLE|SCHEMA|DATABASE|OWNED)|TRUNCATE\s+(TABLE\s+)?[\w."]+)/i,
  ],
  ['unbounded DELETE', /\bDELETE\s+FROM\s+[\w."]+\s*(;|'|"|$)/im],
  [
    'remote DB reset/push',
    /supabase\s+db\s+(reset\s+[^\n]*--(linked|db-url)|push\b)/,
  ],
  ['env file read', new RegExp(READ_VERBS + ENV_TOKEN)],
  [
    'env file overwrite',
    new RegExp(String.raw`>{1,2}\s*['"]?(\.?/)?` + ENV_FILE),
  ],
  [
    'environment dump',
    /(^|[;&|]\s*)(printenv|env)\s*($|[|;&])|Get-ChildItem\s+env:|\b(gci|dir|ls)\s+env:/i,
  ],
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

  if (payload.tool_name !== 'Bash' && payload.tool_name !== 'PowerShell')
    process.exit(0);
  const cmd = payload.tool_input?.command;
  if (!cmd) process.exit(0);

  for (const [label, re] of rules) {
    if (re.test(cmd)) {
      process.stderr.write(
        `BLOCKED: ${label}. Ask the owner to run this themselves (CONSTITUTION S8.2).\n`
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
