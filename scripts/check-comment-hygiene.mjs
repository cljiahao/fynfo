// Fails on change-log style comments (was/added/removed..., dates, ticket ids)
// and on spec/gov/audit narration. Dependency-free; comments are matched
// line-wise, which is precise enough for the patterns involved.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'test', 'scripts'];
const EXT = /\.(?:ts|tsx|mjs)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage']);
// Suppressions cite the rule, e.g. `-- spec §3.2`, which is a required citation.
const CITATION = /(?:eslint-|@ts-|istanbul|c8|v8 ignore)|spec §/;
const NARRATION = /\b(?:spec|gov|audit)[ -]?\d{3}\b/i;

const patterns = readFileSync(
  new URL('./comment-hygiene-patterns.txt', import.meta.url),
  'utf8'
)
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .map((line) => new RegExp(line.replaceAll('[[:space:]]', '\s')));

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXT.test(entry.name)) yield path;
  }
}

function commentBody(line) {
  const match = /^\s*(?:\/\/+|\/\*+|\*(?!\/))\s?(.*?)(?:\*\/)?\s*$/.exec(line);
  return match ? match[1] : null;
}

const problems = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        const body = commentBody(line);
        if (!body || CITATION.test(body)) return;
        if (NARRATION.test(body) || patterns.some((re) => re.test(body))) {
          problems.push(`${file}:${index + 1}: ${body}`);
        }
      });
  }
}

if (problems.length > 0) {
  console.error(
    `Comment hygiene: ${problems.length} narration comment(s). Keep comments to non-obvious intent.\n${problems.join('\n')}`
  );
  process.exit(1);
}
