import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'hooks');
const run = (hook, payload) => {
  const r = spawnSync('node', [join(dir, hook)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  if (r.status === 2) return 'block';
  return r.stdout.includes('"ask"') ? 'ask' : 'allow';
};

const bash = [
  ['git push --force origin main', 'block'],
  ['git push origin +main', 'block'],
  ['git push --force-with-lease', 'block'],
  ['git push origin main', 'allow'],
  ['git push -u origin impl/152-x', 'allow'],
  ['git reset --hard HEAD~1', 'block'],
  ['git reset --soft HEAD~1', 'allow'],
  ['git restore --staged .', 'allow'],
  ['git restore .', 'block'],
  ['git checkout -- .', 'block'],
  ['git checkout main', 'allow'],
  ['git branch -D foo', 'block'],
  ['git stash push -u -m tag', 'allow'],
  ['git stash drop', 'block'],
  ['git commit --no-verify -m x', 'block'],
  ['rm -rf node_modules', 'block'],
  ['rm -fr x', 'block'],
  ['rm -r -f x', 'block'],
  ['rm file.txt', 'allow'],
  ['Remove-Item -Force -Recurse x', 'block'],
  ['Remove-Item x', 'allow'],
  ['cat .env.local', 'block'],
  ['cat ./.env', 'block'],
  ['Get-Content .env.production', 'block'],
  ['cat .env.example', 'allow'],
  ['cp .env.example .env.local', 'block'],
  ['cat ".env.local"', 'block'],
  ["Get-Content '.env' | Select-String KEY", 'block'],
  ['grep -n ".env" README.md', 'allow'],
  ['echo X=1 > .env', 'block'],
  ['echo X=1 >> .env.local', 'block'],
  ['echo X=1 > .env.example', 'allow'],
  ['printenv', 'block'],
  ['env | sort', 'block'],
  ['Get-ChildItem env:', 'block'],
  ['$env:FOO = "1"; pnpm test', 'allow'],
  ['node -e "console.log(process.env.NODE_ENV)"', 'allow'],
  ["psql -c 'DROP TABLE x'", 'block'],
  ["psql -c 'TRUNCATE t'", 'block'],
  ["psql -c 'DELETE FROM t WHERE id=1'", 'allow'],
  ["psql -c 'DELETE FROM t;'", 'block'],
  ['supabase db push', 'block'],
  ['supabase db reset', 'allow'],
  ['supabase db reset --linked', 'block'],
  ['git commit -m "docs: mention .env.local placeholder"', 'allow'],
  ['pnpm check && pnpm test:ci && pnpm build', 'allow'],
];
const paths = [
  ['C:/r/.env.local', 'block'],
  ['C:/r/.env', 'block'],
  ['C:/r/.env.example', 'allow'],
  ['C:/r/certs/server.pem', 'block'],
  ['C:/r/AGENTS.md', 'ask'],
  ['C:/r/CONSTITUTION.md', 'ask'],
  ['C:/r/.claude/settings.json', 'ask'],
  ['C:/r/.claude/hooks/x.mjs', 'ask'],
  ['C:/r/.github/workflows/ci.yml', 'ask'],
  ['C:/r/scripts/build-push.sh', 'ask'],
  ['C:/r/src/a.ts', 'allow'],
  ['C:/r/docs/AGENTS.md', 'allow'],
  ['C:/tmp/scratch/.claude/hooks/x.mjs', 'allow'],
  ['src/a.ts', 'allow'],
];

let fail = 0;
for (const tool of ['Bash', 'PowerShell'])
  for (const [command, want] of bash) {
    const got = run('guard-destructive-bash.mjs', {
      tool_name: tool,
      tool_input: { command },
    });
    if (got !== want) {
      fail++;
      process.stdout.write(`FAIL ${tool} [${command}] want=${want} got=${got}
`);
    }
  }
for (const [file_path, want] of paths) {
  const got = run('guard-protected-paths.mjs', {
    tool_name: 'Edit',
    cwd: 'C:\\r',
    tool_input: { file_path },
  });
  if (got !== want) {
    fail++;
    process.stdout.write(`FAIL path [${file_path}] want=${want} got=${got}
`);
  }
}
process.stdout.write(
  fail
    ? `${fail} failures\n`
    : `all ${bash.length * 2 + paths.length} cases pass\n`
);
process.exit(fail ? 1 : 0);
