---
id: 058
slug: snapshot-format-and-household-lock-ux
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-27
approved: 2026-06-27
shipped: 2026-06-27
impl_pr:
supersedes:
constitution_satisfies:
  - '§4' # small UI correctness + DRY cleanup
constitution_overrides:
---

# Spec 058: snapshot-form currency dedupe + household lock-vs-error UX

## Problem

Two low-severity items from the 2026-06-27 sweep (both verified):

1. **Currency-format duplication.** `snapshot-form.tsx:219-223` hand-rolls
   `'$' + catTotal.toLocaleString('en-SG', { minimumFractionDigits: 2 })` — the one
   place in `src/` that re-implements SGD formatting instead of calling the shared
   `formatSGD()` (`lib/utils/currency.ts`). Output is identical; it should reuse the
   util.
2. **Household "locked" conflated with any goals-read error.**
   `household-overview.tsx` derives `const locked = goals.isError`. `getGoals`
   throws a plain "Household is locked" error when the household key is absent, but
   a transient DB read error throws an opaque `AppError`. Both currently render the
   "Household locked → Unlock" panel, so a real read failure shows a misleading
   message and an unlock button that won't fix it.

## Constitution check

- Satisfies `§4` (DRY + UI correctness). No HARD rule, dependency, schema, or
  encryption change. Normal feature/component files.
- Overrides: none.

## Solution shape

**1. snapshot-form dedupe**

- `snapshot-form.tsx` — import `formatSGD` from `@/lib/utils/currency`; replace the
  inline `($…)` expression with `({formatSGD(catTotal)})`. No behavior change.

**2. Household lock state from the session, not from a read error**

Determine "locked" authoritatively (does the household-key cookie exist?) instead
of inferring it from a failed goals read:

- `household/types.ts` — add `locked: boolean` to `HouseholdSummary`.
- `household/actions/household-actions.ts` `getHousehold()` — also read
  `getHouseholdKhSession()` (a cookie check, no DEK needed) and return
  `locked: kh === null`. Membership read is unchanged.
- `household/components/household-overview.tsx` — `const locked =
!!household.data && household.data.locked`; enable the goals query only when
  `hasHousehold && !locked`. With goals fetched only while unlocked, `goals.isError`
  now means a genuine read failure → render a real error panel (short message,
  no unlock button); the locked panel is driven by `locked`.
- `test/features/household/household-actions.test.ts` — extend the `getHousehold`
  tests: mock `getHouseholdKhSession` to assert `locked: true` (no key) and
  `locked: false` (key present).

## Out of scope

- **Single-household-per-user enforcement** (the other loop-2 LOW: `readOwnMember`
  / `getHousehold` / `createGoal` assume one household per user, `rows[0]` without
  `ORDER BY`; schema lacks `UNIQUE(user_id)`). Currently **unreachable via UI**
  (setup only renders when not in a household). A real fix needs a
  `UNIQUE(user_id)` migration (Clarence-run) + join guards — deferred, tracked here.
- `deleteGoal` using `requireHouseholdContext` instead of `requireDbContext`
  (marginal; delete is RLS-scoped and works while unlocked). Deferred.
- Any palette/chart change (that is spec 056).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] `snapshot-form.tsx` renders the category subtotal via `formatSGD`; visual
      output unchanged.
- [ ] `getHousehold` returns `locked`; the household page shows the unlock panel
      only when actually locked, and a distinct error panel on a real goals-read
      failure. `getHousehold` tests cover both `locked` states.
- [ ] No `any`, no `console.log`, no dependency.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: one asset-form label (cosmetic) + the household page's
  locked/error branching. No data, encryption, or schema change.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
