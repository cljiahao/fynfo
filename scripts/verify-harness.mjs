#!/usr/bin/env node
// Harness integrity verifier (templateCentral 5.2 concept, Node port for Fynfo).
// Recomputes SHA-256 of every file tracked in .claude/harness.json and compares
// to its recorded origin_hash. Exit 1 on any drift or missing file, 0 if clean.
// Hashing matches /regen-harness exactly (raw file bytes -> sha256 hex).
//
// Runs as the first step of `pnpm check` (see package.json), so husky pre-commit
// and CI both fail when the enforcement layer (settings.json, hooks/**, rulebooks,
// skills) drifts from the last human-blessed manifest. The baseline is only
// re-blessed by a HUMAN running /regen-harness — this script never rewrites it.
/* eslint-disable no-console -- spec 065: standalone CLI validator; stdout + exit code is its interface, not app code */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const MANIFEST = '.claude/harness.json';

if (!existsSync(MANIFEST)) {
  console.error(`verify-harness: ${MANIFEST} not found`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const entries = Object.values(manifest.seeded_files ?? {});
const drift = [];

for (const { path, origin_hash } of entries) {
  if (!existsSync(path)) {
    drift.push(`  MISSING  ${path}`);
    continue;
  }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== origin_hash) drift.push(`  DRIFTED  ${path}`);
}

if (drift.length) {
  console.error(
    `verify-harness: ${drift.length} of ${entries.length} tracked file(s) drifted from ${MANIFEST}:`
  );
  console.error(drift.join('\n'));
  console.error(
    'If the change is intentional, a human should review it and run /regen-harness.'
  );
  process.exit(1);
}

console.log(`verify-harness: OK (${entries.length} files match manifest)`);
process.exit(0);
