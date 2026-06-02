---
id: 004
slug: extract-expense-table-logic
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved roadmap Phase 3 (SRP)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # SRP — filter/sort logic out of the table component
  - '§4.2' # ships unit tests for the extracted logic
constitution_overrides:
---

# Spec refactor/004: Extract expense-table filter/sort into a tested lib

## Problem

`expense-table.tsx` (643 lines, audit Phase 3) computed the filtered + sorted view inline (type/split/
free-text filter; 5-column sort with label-aware comparisons) — pure logic fused into the component and
untested.

## Constitution check

- Satisfies `§3.1` (SRP) and `§4.2` (tests). Overrides: none. No migration, no new dependency, no
  encryption path. Behavior-preserving extraction.

## Solution shape

- New `src/features/expenses/lib/expense-table.ts`: `SortKey`/`SortDir` types, `ExpenseFilters`,
  `filterExpenses(expenses, filters)`, `sortExpenses(list, key, dir)` (non-mutating, label-aware).
- `expense-table.tsx` imports them and replaces the inline `.filter`/`.sort`; pagination slice stays
  inline (trivial). JSX unchanged.

## Out of scope

- Decomposing the `EditableRow` / row JSX (no render test harness).
- The remaining oversized components (own specs).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [x] New `test/features/expenses/expense-table.test.ts`: no-filter passthrough, type/split filter,
      case-insensitive search across item/info/label, amount + item sort (asc/desc, non-mutating).
      234 total.
- [x] No new dependency, no `any`, no `console.log`.

## Risk & reversibility

- **Blast radius**: the expense table view only; literal extraction, JSX untouched.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
