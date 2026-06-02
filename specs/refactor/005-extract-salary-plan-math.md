---
id: 005
slug: extract-salary-plan-math
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved roadmap Phase 3 (SRP)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # SRP — salary allocation math out of the planner component
  - '§4.2' # ships unit tests for the extracted math
constitution_overrides:
---

# Spec refactor/005: Extract salary-planner allocation math into a tested lib

## Problem

`salary-planner.tsx` (545 lines, audit Phase 3) computed the entire monthly take-home allocation inline
— net-after-CPF, fixed percentages, emergency/war-chest goals, the dynamic savings-vs-investment split,
and the per-slice amounts — plus the per-month user-share expense average. Money-affecting logic, fused
with chart/JSX, untested.

## Constitution check

- Satisfies `§3.1` (SRP) and `§4.2` (tests). Overrides: none. No migration, no new dependency, no
  encryption path. Behavior-preserving extraction.

## Solution shape

- New `src/features/assets/lib/salary-plan.ts`: `ceilToThousand`, `sumByCategory`,
  `calcAllTimeAvgExpense(expenses)` (shared-split aware), and the aggregate
  `computeSalaryPlan(input) → SalaryPlan` (all derived percentages/goals/amounts).
- `salary-planner.tsx` keeps the `currentSavings`/`currentBonds` snapshot reads (UI also shows them),
  passes them into `computeSalaryPlan`, and destructures the result. Inline helpers/math removed; JSX
  unchanged.

## Out of scope

- Decomposing the chart/breakdown JSX (no render test harness).
- The trade-form fee-derive extraction (its own spec).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [x] New `test/features/assets/salary-plan.test.ts`: ceil/sum helpers, shared-split average,
      net-after-CPF + goals, savings-while-unmet vs all-investment-when-fulfilled, zero-salary.
      242 total.
- [x] No new dependency, no `any`, no `console.log`.

## Risk & reversibility

- **Blast radius**: the salary-planner card only; literal extraction, JSX untouched.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
