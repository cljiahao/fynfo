#!/usr/bin/env node
// Route-logging enforcement (templateCentral 5.7 concept, Node port for Fynfo).
// Fails if any src/app/api/**/route.ts exports an HTTP handler that isn't wrapped
// by withLogging. Makes "every API route is logged" (AGENTS.md §4) true by
// construction rather than by convention. Exit 1 on any violation, 0 if clean.
//
// Assumes Fynfo's handler idiom: `export const GET = withLogging('label', ...)`.
// Runs as a step of `pnpm check` (see package.json).
/* eslint-disable no-console -- spec 065: standalone CLI validator; stdout + exit code is its interface, not app code */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = 'src/app/api';
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name === 'route.ts' || name === 'route.tsx') out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

let routeFiles;
try {
  routeFiles = walk(API_DIR);
} catch {
  console.log(`check-route-logging: no ${API_DIR}, nothing to check`);
  process.exit(0);
}

const violations = [];
for (const file of routeFiles) {
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const m of METHODS) {
    // `export const METHOD = <ident>` — the ident must be withLogging.
    const constRe = new RegExp(`export\\s+const\\s+${m}\\s*=\\s*(\\w+)`);
    const cm = src.match(constRe);
    if (cm && cm[1] !== 'withLogging') {
      violations.push(
        `  ${file} — ${m} assigned ${cm[1]}(), not wrapped by withLogging`
      );
    }
    // `export (async) function METHOD` — a raw handler, never wrapped.
    const fnRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`);
    if (fnRe.test(src)) {
      violations.push(
        `  ${file} — ${m} is a raw function export; wrap with withLogging`
      );
    }
  }
}

if (violations.length) {
  console.error('check-route-logging: unwrapped API handler(s) found:');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(
  `check-route-logging: OK (${routeFiles.length} route file(s) all wrapped)`
);
process.exit(0);
