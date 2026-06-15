---
id: 037
slug: finish-action-layer-coverage
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-15
approved: 2026-06-15 # Clarence: "Yes, implement 037" (continuation of 035)
shipped: 2026-06-15
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.2' # rounds out unit tests across the whole server-action layer
  - '§2.1' # exercises the remaining encrypt-on-write + guard paths
constitution_overrides:
---

# Spec 037: Finish server-action-layer coverage

## Problem

Spec 035 covered the worst action gaps but left a tail: `planner-actions` is still
0% (both functions untested); `equity.updateTrade`, `snapshot.getSnapshot`, and the
`expense` write/settle/people paths (`upsertExpense`, `deleteExpense`, `settleSplit`,
`settleMonthSplits`, `getDistinctPeople`) are uncovered. These are the same
confidentiality-critical surface (encrypt-on-write, parse-at-boundary, opaque DB
errors) and are node-testable today with the existing `makeFakeSupabase` helper. No
new dependency. (Stryker mutation testing considered and declined — solo app.)

## Constitution check

- Satisfies `§4.2` (completes action-layer unit tests) and `§2.1` (asserts the
  encrypt/decrypt + guard contracts). Overrides: none. No migration, no new
  dependency. Test-only — no `src/` behavior change except `vitest.config.ts` floors.

## Solution shape

- **`test/features/assets/planner-actions.test.ts`** (new): `getPlannerSettings`
  maps snake→camel and returns `null` on error; `upsertPlannerSettings` rejects
  invalid input pre-DB, writes mapped columns, surfaces an opaque write error.
- **Extend `equity-actions.test.ts`**: `updateTrade` encrypts fields before update
  and surfaces an opaque error; rejects invalid input.
- **Extend `snapshot-actions.test.ts`**: `getSnapshot` decrypts a single month and
  returns `null` on error/empty.
- **Extend `expense-actions.test.ts`**: `upsertExpense` (encrypt item/info/amount +
  shared splits; parse-reject; opaque upsert/splits errors), `deleteExpense`,
  `settleSplit`, `settleMonthSplits` (scoped updates + opaque errors),
  `getDistinctPeople` (dedupe + sort; opaque error).
- **`vitest.config.ts`**: add/raise per-file floors for the newly-covered files.

## Out of scope

- Component / hook render tests (jsdom/RTL).
- Stryker / mutation testing (declined 2026-06-15).
- Any action behavior change. A real bug → separate fix spec.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; new tests cover planner + the equity/snapshot/expense tail
- [ ] `pnpm test:coverage` green against ratcheted thresholds
- [ ] `pnpm build` green
- [ ] planner-actions 0% → >90%; expense-actions write/settle/people paths covered
- [ ] No `src/` file changed except `vitest.config.ts`

## Risk & reversibility

- **Blast radius**: test-only + threshold config. Zero runtime impact.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- [ ] Q: none.
