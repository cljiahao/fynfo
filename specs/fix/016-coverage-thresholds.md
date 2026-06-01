---
id: 016
slug: coverage-thresholds
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence approved Phase 2 of the 2026-06-02 audit roadmap (track selection)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3' # makes "done" enforceable for coverage — no silent erosion
constitution_overrides:
---

# Spec 016: Coverage thresholds (close the silent-erosion gap)

## Problem

The audit (`docs/audit/2026-06-02-project-audit-roadmap.md`, MED) found `vitest.config.ts` configures
the v8 coverage provider but sets **no thresholds**, so coverage can erode silently — nothing fails.
Now that specs 014/015 lock down the security core, set thresholds so that coverage is enforced.

## Constitution check

- Satisfies `§3` — coverage becomes a checkable "done" criterion on `pnpm test:coverage`.
- Overrides: none. No HARD rule. No new dependency. Config-only change + this spec.

## Solution shape

`vitest.config.ts` `coverage.thresholds`:

- **Global floor** — `lines/statements: 10`, `functions: 50`, `branches: 60`. Deliberately low:
  most UI (30 components) is still untested pending the jsdom/RTL dep decision, and coverage.include
  spans all of `src`. The floor's job is to prevent regression below today's baseline (lines 10.38,
  funcs 78.97, branches 82.23), not to assert good coverage. Ratchet up as coverage grows.
- **Security-core gates** (per-file globs) — `crypto.ts` and `action-guard.ts` at 100/100/100/branch-90;
  `keystore.ts` at 95/95/func-100/branch-85. Keeps the zero-knowledge contract from silently losing
  coverage.

Enforcement runs on `pnpm test:coverage`. The fast gate (`pnpm test:ci`, used by the Stop hook/CI)
is intentionally left coverage-free for speed; wiring `test:coverage` into CI is a small follow-up
if desired.

Also adds `coverage/**` to `eslint.config.mjs` `globalIgnores`: running `test:coverage` generates a
`coverage/` report dir (already gitignored) that `eslint .` would otherwise lint and fail on (an
unused-disable warning in the generated lcov HTML). Ignoring it keeps `pnpm check` green after a
coverage run.

## Out of scope

- Raising the global floor (needs the UI-testing dep decision first).
- Adding coverage to the `test:ci` gate / Stop hook (separate, optional).
- Any production code change beyond the config.

## Acceptance

- [ ] `pnpm test:coverage` passes with thresholds enforced (exit 0).
- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] Only `vitest.config.ts`, `eslint.config.mjs` (ignore `coverage/`), + this spec changed.
- [ ] No new dependency.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: tooling only. A future drop below a threshold fails `test:coverage` (intended).
- **Reversibility**: `git revert`; remove the `thresholds` block.
- **Backout plan**: delete the `thresholds` key.

## Open questions

- None. (Global-floor ratcheting tracked under the jsdom/RTL decision, deferred.)
