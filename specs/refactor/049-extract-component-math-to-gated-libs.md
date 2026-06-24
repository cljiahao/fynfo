---
id: 049
slug: extract-component-math-to-gated-libs
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-25)
created: 2026-06-25
approved: 2026-06-25 # Clarence approved the audit roadmap (Everything 1-6); PR ceremony waived (personal project, direct-to-main)
shipped: 2026-06-25
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # extracted pure logic ships unit tests; new per-file coverage gates lock it down
  - '§3.4' # new lib files kebab-case; exported fns camelCase, types PascalCase
constitution_overrides:
---

# Spec 049: Extract untested component math into gated lib modules

## Problem

Two pieces of pure, non-trivial financial/aggregation math live inline inside `'use client'`
components, at 0% test coverage — the exact blind spot the per-file lib coverage gates (specs
035-039, refactor 002-006) exist to close:

1. `src/features/equity/components/portfolio-summary.tsx:24-91` — `computeIRR` (Newton's-method
   money-weighted return) and `buildCashFlows`. ~67 lines of iterative numerical math with clamping
   and convergence edges, none tested.
2. `src/features/expenses/components/owed-summary.tsx:32-98` — `buildPersonGroups`, a per-person /
   per-month settle rollup with a one-year cutoff for settled months and a multi-key sort. Untested.

Both sit in `.tsx`, so the coverage gate's `include: src/**` measures them but no per-file floor
guards them, and no test exercises the branches.

## Constitution check

- Satisfies:
  - `§4.2` — the extracted modules ship unit tests covering the IRR convergence/sign/market-filter
    branches and the owed grouping/cutoff/sort branches; new per-file coverage thresholds in
    `vitest.config.ts` prevent regression.
  - `§3.4` — new files `mwr.ts` / `owed.ts` kebab-case; functions camelCase, interfaces PascalCase.
- Overrides: none. No HARD rule touched. No new dependency. No encryption/schema/migration. Pure
  move of already-client logic into sibling `lib/` modules (no `'use client'` needed — pure fns).

## Solution shape

Behavior-preserving extraction. The only signature change is an optional injected `now: Date`
argument (defaulting to `new Date()`) so the time-dependent branches are deterministically testable;
all existing call sites keep working unchanged.

- **`src/features/equity/lib/mwr.ts` (new).** Export `interface CashFlow { date: Date; amount:
number }`, `computeIRR(cashFlows: CashFlow[]): number`, and `buildCashFlows(trades, holdings,
prices, marketFilter?, now?: Date): CashFlow[]`. Move the bodies verbatim from
  `portfolio-summary.tsx`; the "current value as final cash flow today" uses the injected `now`.
  Imports: `getMarket` (`./ticker-map`), `type Holding` (`./holdings`), `type EquityTradeData`
  (`../types`).
- **`portfolio-summary.tsx`.** Delete the two functions + `CashFlow` interface; import them from
  `../lib/mwr`. The three `useMemo` IRR calls are unchanged.
- **`src/features/expenses/lib/owed.ts` (new).** Export `interface MonthGroup`, `interface
PersonGroup`, and `buildPersonGroups(expenses: ExpenseData[], now?: Date): PersonGroup[]`. Move the
  body verbatim; the cutoff uses the injected `now`. Imports: `format`, `subYears` (date-fns),
  `type ExpenseData` (`../types`).
- **`owed-summary.tsx`.** Delete the function + both interfaces; import from `../lib/owed`.
- **Tests (new).**
  - `test/features/equity/mwr.test.ts` — `computeIRR`: <2 flows → 0; a single buy then a higher
    current value one year later → ~ the expected positive IRR; a loss → negative; convergence
    stays bounded (clamp). `buildCashFlows`: buy = negative, sell = proceeds−fees, market filter
    partitions SG/US, current holdings add a positive flow at `now`, output sorted by date.
  - `test/features/expenses/owed.test.ts` — only `shared` splits counted; per-person/per-month
    aggregation; settled month older than `now − 1yr` filtered out while an unsettled old month is
    kept; `totalOwed` sums only unsettled; sort = outstanding first then name.
- **`vitest.config.ts`.** Add per-file thresholds for `src/features/equity/lib/mwr.ts` and
  `src/features/expenses/lib/owed.ts` (lines/statements 95, functions 100, branches 85), a few points
  under measured, matching the existing gate style.

No change to the components' render output, the hooks, actions, encryption, schemas, or Supabase.

## Out of scope

- Any UI/markup change in the two components (only the function definitions move).
- Other untested components (summary-cards render test, payload dedup) — spec 050.
- The numeric algorithm itself (no tuning of iteration count / guess); pure move.

## Acceptance

- [ ] `pnpm format:check` + `pnpm lint` + `pnpm typecheck` green
- [ ] `pnpm test:coverage` green; `mwr.ts` and `owed.ts` meet their new per-file thresholds
- [ ] `pnpm build` green
- [ ] Equity portfolio summary still renders identical MWR figures (manual: open /dashboard/equity)
- [ ] Expenses "Who Owes You" still groups/sorts identically (manual: open /dashboard/expenses)
- [ ] No `any`, no `console.log`, no new dependency. Files: `mwr.ts`, `owed.ts`, two components, two
      tests, `vitest.config.ts`.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: two components' computed values. Behavior-preserving move; the new tests pin the
  numbers, so a transcription error fails the gate rather than shipping.
- **Reversibility**: single `git revert`. No data/schema.
- **Backout plan**: revert the impl commit; inline functions return.

## Open questions

- [ ] Q: Branch floor 85 acceptable for `computeIRR` (the `dnpv≈0` early-break is hard to hit
      deterministically)? — Owner: Clarence — A: (lean yes; adjust at impl if measured lower)
