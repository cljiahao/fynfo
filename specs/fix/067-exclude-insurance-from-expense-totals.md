---
id: 067
slug: exclude-insurance-from-expense-totals
area: fix
status: shipped
author: Claude Code
created: 2026-07-22
approved: 2026-07-22
shipped: 2026-07-22
impl_pr: (direct to main)
supersedes:
constitution_satisfies:
  - '§1.1'
constitution_overrides:
---

# Spec 067: Exclude insurance-type entries from "expenses" totals

## Problem

`insurance` is a first-class `ExpenseType` (`src/features/expenses/types.ts`), so any insurance premium logged on the Expenses page is summed into every "total expenses" figure: the Expenses page chart headline/avg (`expense-chart.tsx`), and `calcAllTimeAvgExpense()` (`salary-plan.ts`), which feeds the dashboard Salary Planner's `expensesPct`/`expensesAmt`.

But the Salary Planner already models insurance as its own fixed 5% slice of net income (`insurancePct = 0.05` in `computeSalaryPlan`), separate from the expenses slice. Any user who also logs real insurance premiums as `insurance`-type expenses gets it counted twice in the planner's allocation (once folded into `expensesPct`, again via the flat `insurancePct`), and the Expenses page's own "12-month total" / "All-time avg" overstate true discretionary spend by the same amount.

## Constitution check

- Satisfies: `§1.1` (accurate wealth-management figures)
- Overrides: none

## Solution shape

- `src/features/expenses/constants.ts`: `EXPENSE_TOTAL_EXCLUDED_TYPES = ['insurance']`.
- `src/features/expenses/lib/utils.ts`: `isCountedInExpenseTotals(type)` helper, exported via the feature barrel.
- `src/features/assets/lib/salary-plan.ts`: `calcAllTimeAvgExpense()` skips excluded types before summing — so the planner's `expensesPct`/`expensesAmt` no longer double-counts against its own flat `insurancePct`.
- Insurance rows stay visible in the Expenses page table and as their own bar-chart segment (still useful to track/log) — only the Salary Planner's expenses aggregate is corrected.
- `OwedSummary` / split-owed math (`owed.ts`) untouched — unrelated to this aggregate.
- No schema/migration change; pure client-side aggregation fix.

## Out of scope

- The Expenses page's own chart headline (`expense-chart.tsx` `totalExpense`/`allTimeAvg`/reference-line `avgExpense`) is **not** changed here: those numbers double as the stacked bar's height/domain source, so excluding insurance there either clips real bar height against `yMax` or requires dropping the insurance segment from the stack entirely — a separate, riskier design decision than the confirmed double-count bug. Flagged for Clarence if he wants it revisited.
- Not adding a dedicated "insurance" feature/page.
- Not changing the flat 5% `insurancePct` planner assumption.
- Not touching `expense-table.tsx` row display or split/owed logic.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; existing/new unit tests on `calcAllTimeAvgExpense` and chart total cover an insurance-type row being excluded from the sum
- [ ] `pnpm build` green
- [ ] Manual: log an `insurance`-type expense; Expenses page 12-month total / avg unchanged; dashboard Salary Planner `expensesAmt` unchanged; insurance row still visible in table + chart legend
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: expenses feature + dashboard Salary Planner only. No DB/RLS/encryption path touched.
- **Reversibility**: single git revert.
- **Backout plan**: revert commit; no migration to unwind.

## Open questions

None — Clarence confirmed intent inline: insurance should stay a loggable expense type but be excluded from expense-total aggregates since the dashboard already accounts for it separately.
