---
id: 038
slug: tax-reliefs-label-coverage
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-15
approved: 2026-06-15 # Clarence: continuation of the coverage sweep ("go ahead")
shipped: 2026-06-15
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.2' # closes the last node-testable gap in the financial logic layer
constitution_overrides:
---

# Spec 038: tax-reliefs label-branch coverage

## Problem

`tax-reliefs.ts` (Singapore tax-relief logic) sits at 86% — the only uncovered
lines are the count-decorated (`(×N)`) and variant-decorated (`— variant`) label
branches in `buildReliefItems` (lines 59, 62-63). It is the last node-testable gap
in the otherwise-covered pure financial-logic layer. Display logic, but cheap to
lock down for a financial feature.

## Constitution check

- Satisfies `§4.2` (unit test). Overrides: none. No migration, no new dependency.
  Test-only — extends `test/features/salary/tax-reliefs.test.ts` + adds a per-file
  floor in `vitest.config.ts`. No `src/` behavior change.

## Solution shape

- Extend the `buildReliefItems` describe with two cases: a count-based relief with
  `count > 1` asserting the `(×N)` label, and a variant-based relief asserting the
  `— <variant label>` decoration. Both skip gracefully if the catalog lacks such a
  relief (matching the existing guarded-skip pattern).
- Add a `src/features/salary/lib/tax-reliefs.ts` per-file threshold (lines/functions
  100, branches ≥90) to lock the gain.

## Out of scope

- `get-marketing-stats.ts` (admin-only telemetry) and UI component/hook render tests
  — explicitly deferred as low-ROI.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm test:coverage` green; tax-reliefs.ts at/near 100% lines
- [ ] `pnpm build` green
- [ ] No `src/` file changed except `vitest.config.ts`

## Risk & reversibility

- **Blast radius**: test + threshold only. Zero runtime impact.
- **Reversibility**: single `git revert`.

## Open questions

- [ ] Q: none.
