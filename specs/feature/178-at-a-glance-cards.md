---
id: '178'
slug: at-a-glance-cards
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-06
approved: 2026-11-06 # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # no PR (direct to main); commit shas recorded per slice
supersedes:
constitution_satisfies:
  - '§2.4'
  - '§2.5'
  - '§3.1'
  - '§3.2'
  - '§4.5'
  - '§5.1'
constitution_overrides:
---

# Spec 178: At a glance cards

## Problem

The three "At a glance" cards on the Overview
(`src/features/overview/components/latest-records.tsx`) show a value and then
stack metadata ("Latest snapshot", "Latest: Oct 2026", "Earlier than this month")
that says when, not what changed. The owner cannot tell from a card whether
assets went up, whether the salary moved, or whether this month's spending is
high. The section subtitle and the "Current Salary" label add noise.

## Constitution check

- Satisfies: `§2.4` (data comes from existing hooks; the page only composes),
  `§2.5` (the component is already a client component; no new boundary beyond the
  popover trigger), `§3.1` and `§3.2` (no new dependency; existing
  `src/components/ui/popover.tsx`; no inline styles), `§4.5` (no new fetch; all
  data is already loaded for the cards), `§5.1` (personal data only, read in the
  browser from the owner's own decrypted records; nothing new is stored).
- Overrides: none.

## Solution shape

Each card keeps the minimalist shape: label link, big value, ONE meaningful line,
and a detail popover.

### Facts verified in the code

- `SalaryData`: `{ id: 'YYYY-MM', salary, bonus }`
  (`src/features/salary/types.ts:1-6`). `bonus` is a number (0 when none).
- `SnapshotData`: `{ id: 'YYYY-MM', entries: AssetEntryData[] }`; an entry is
  `{ category: AssetCategory, account, amount }` (`assets/types.ts:10-20`). Total
  via `calculateTotal(entries)`.
- `ExpenseData`: `{ id, date (ISO), type: ExpenseType, item, info, amount,
splitType, splits }` (`expenses/types.ts:23-33`). The category is `type`
  (`bills`, `groceries`, `food_drink`, and so on).
- The user's own amount per expense is `userExpenseAmount` (private in
  `assets/lib/salary-plan.ts:19`); the month's figure comes from
  `buildMonthlyReview(...).personalSpending`; the 12-month average comes from
  `calcRecentAvgExpense(expenses, now, 12)`, the same calc as the planner (spec
  176 amendment A2).

### Cards

- **Total Assets**: line = change versus the previous snapshot, "▲ $1,200" or
  "▼ $800" with the previous month ("vs Sep 2026"); "No earlier snapshot" with a
  single snapshot. Detail = top 3 categories of the latest snapshot with amount
  and share, plus the snapshot month.
- **Salary** (label renamed from "Current Salary"): line = change versus the
  record about 12 months earlier (nearest record at or before latest month minus
  12; "▲ $300 vs Oct 2025"); if the salary is unchanged, "Unchanged since <month
  of last change>". Detail = last raise percentage (the latest change between
  consecutive records, relative to the earlier value), the latest non-zero bonus
  with its month when any record has `bonus > 0`, and the latest record month.
- **Spending this month** (label renamed from "Recorded spending"): line =
  versus the 12-month average, "▲ $120 vs 12-mo avg" or "▼"; "No 12-month
  average yet" when `monthsUsed` is 0. Detail = top 3 categories this month (own
  share, by `type`), the last expense date, and the month. The existing "Check
  shared splits" value state is kept.
- Removed: "Earlier than this month", the hints "Latest snapshot" and "Latest
  base salary", the "Latest: <period>" lines (the period moves into the detail),
  and the section subtitle. The `periodLabel` helper stays for the details.
- Masking: every amount in a line or detail goes through
  `useAmountVisibility().mask`. Percentages and months are not masked. When
  amounts are hidden, the ▲/▼ direction is still shown without the amount.

### Detail interaction: Popover

Use `Popover` (`src/components/ui/popover.tsx`), not `Tooltip`. A tooltip opens
on hover and focus only, so it is unreachable by touch and cannot hold
interactive content; this dashboard is used on a phone. Popover opens on click
and tap and on Enter or Space for keyboard users, and Radix handles focus return
and Escape. The trigger is a small "Details" button with a text label beside the
line (not colour alone); the card label stays a link to the source page.
Hover-open is optional and not required.

### Pure helpers

Add `src/features/overview/lib/glance-metrics.ts` with pure, tested functions:
`assetDelta(snapshots)`, `topAssetCategories(snapshot, n)`,
`salaryChange(records, monthsBack)`, `lastRaise(records)`, `latestBonus(records)`,
`spendingVsAverage(month, avg)`, `topExpenseCategories(expenses, month, n)`. They
take plain data and return numbers and keys; formatting and masking stay in the
component. Reusing the user-share amount may require exporting
`userExpenseAmount` from the assets barrel or moving it to a shared lib; keep
that to the smallest change.

### Edit list

- `src/features/overview/components/latest-records.tsx`: card layout, labels,
  popovers.
- `src/features/overview/lib/glance-metrics.ts` and its test (new).
- `src/features/overview/components/latest-records.test.tsx` (new).
- No data model, migration, encryption or action changes.

## Out of scope

- Charts, sparklines or new dashboard cards; the dividend card (spec 177).
- Changing how records are loaded, cached or stored.
- Tooltips with hover-only content.
- Planner changes (spec 176).

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] Unit tests cover each helper: increase, decrease, single record, empty, unchanged salary, no bonus, zero average, ties in category ranking
- [ ] Render tests: each card shows one line and a Details trigger that opens the popover with the specified content; removed texts are absent; loading, error and "Not recorded" states preserved
- [ ] Amounts hidden: no amount appears in lines or popover content; direction and percentages still do
- [ ] Popover opens by click and by keyboard; manual check at 375px and in dark mode
- [ ] No `any`, no `console.log`, no `@ts-ignore`, no `eslint-disable`
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: one Overview component; read-only.
- **Reversibility**: a single git revert.
- **Backout plan**: revert the commit.

## Open questions

- [x] Q1: Tooltip or Popover for the detail? A: Popover, for touch support. (owner, 2026-11-06, recommended default).
- [x] Q2: Salary comparison basis? A: About 12 months earlier, falling back to "Unchanged since <month>". (owner, 2026-11-06, recommended default).
