---
id: '190'
slug: household-goal-detail-followups
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-16
approved: 2026-11-16 # owner-approved in chat 2026-11-16 as drafted, all recommended defaults
shipped: 2026-11-16 # YYYY-MM-DD, set on impl merge
impl_pr: https://github.com/cljiahao/fynfo/pull/79 # link to impl PR, set on shipped
supersedes: # none; amends decisions of spec 189 (listed under "Decisions of 189 that change")
constitution_satisfies:
  - '§2.1'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.4'
  - '§4.1'
  - '§5.1a'
constitution_overrides: []
---

# Spec 190: Household goal detail follow-ups

## Problem

Spec 189 redesigned `/dashboard/household/goals/[goalId]` and shipped
(PR 78). A production check on the owner's real goal found two problems. The
owner answered "Yes, fix both" in chat on 2026-11-16.

1. **Gap at `lg`.** With a long budget-item list, about 320px of empty space sits
   between the "Progress over time" box and "Recent activity" in the right
   column.
2. **The headline does not fit how the goal is used.** The owner's goal has
   budget items with payments recorded against them (about a quarter of the
   budget is paid) and no contributions. The page leads with "Saved $0.00 of
   <target>", "0%", an empty two-tone bar, a "Behind" chip and an empty 220px
   chart that says "Add to the goal to start the chart". The real progress, the
   payments, appears only as a small "Paid out" fact.

This is a presentation and client-side derivation change. No server action,
schema, migration, RLS, crypto or dependency change is needed (checked below).

## Constitution check

- Satisfies: `§2.1` and `§5.1a` (nothing leaves the browser; masking stays a
  display layer and covers every new number, bar, legend, label and chart
  state, with explicit rules below), `§2.4` (the page stays a thin composer; the
  new derivations are pure helpers in `lib/`), `§2.5` (no new client boundary;
  every touched component is already a client component), `§2.6` / `§2.7`
  (barrel import `@/features/household`, named exports), `§3.1` (no dependency
  change), `§3.4` (kebab-case names), `§4.1` (all five gates).
- Overrides: none. No HARD rule is touched.
- Authorization: owner request in chat 2026-11-16 ("Yes, fix both"); approved
  2026-11-16.

## Data model: what "saved" and "paid" mean

Read from `src/features/household/types.ts` and specs 149, 171, 175, 183, 185.

- **Saved = contributions.** `HouseholdGoal.contributions[]` is money the
  household has set aside toward the goal. `contributed` is their sum,
  `remaining = max(0, targetAmount - contributed)` and `pct` is
  `contributed / targetAmount` clamped to 100 (`computeGoalProgress`, computed
  server-side in `goal-actions.ts:219-221`). The goal card, the status chip
  (`goalStatus`), the deadline (`goalDeadline`), the pace (`goalPlanShare`) and
  the burn-up chart all use this meaning. `isSelf` splits you from partner.
- **Paid = item payments.** Each `GoalItem` has `payments[]`
  (`household_goal_payments`, spec 149). `item.paid` is their sum, `goal.paid`
  the sum over items. An item's expected cost is `effectiveAmount(item) = quote
?? budget` (`goal-stats.ts:165`); `goal.budgeted` is the sum of `budget` only
  (estimates, ignoring quotes). Payments carry `isSelf` and a date.
- **They are independent records.** A payment does not create or reduce a
  contribution; `remaining` ignores payments entirely. Spec 183 treats
  contributions as the pot that pays the earliest bills, `funds on hand = c -
P`, and accepts as a known limitation (183 Q6) that a payment logged without a
  matching contribution lowers the planner's schedule but not `goal.remaining`.
  The owner's goal is exactly that case at the extreme (`c = 0`, `P > 0`): the
  planner and "Monthly share" already treat paid items as paid, while the
  summary and the card still say nothing has happened.
- **Truthful consequence.** "Saved $0 of target, Behind" is correct for
  contributions and wrong as a headline for a goal that is run through items.
  Showing payments as "saved" would be false (it is spent, not set aside), so
  the headline must name what it measures ("Paid") and `Saved` stays the name of
  contributions only.

No data-model, action or query change is required: `contributed`, `paid`,
`items[].{budget,quote,dueDate,paid,payments[].{amount,date,isSelf}}` and
`createdAt`/`targetDate` already reach the client.

## Decisions of 189 that change

- 189 "Hierarchy rules": the primary number is always Saved. Now the primary
  number depends on the goal's **basis** (below): Saved, or Paid for items-first
  goals.
- 189 "States, No contributions and no items" and chart placeholder "Add to the
  goal to start the chart": kept only for goals with no items.
- 189 Q5 (resolved: card unchanged): reopened. The card derives its chip from
  the same `goalStatus` and prints "of target / to go" from contributions, so
  fixing the page alone would leave the card and page disagreeing for the same
  goal. This spec edits `goal-card.tsx` minimally (see Files).
- 189 "Layout" (Budget items `lg:row-span-2`): replaced by the fix below.
- Everything else in 189 (header, actions, item list, activity, masking and
  touch-target rules, Add to goal, deadline text) is unchanged.

## Problem 1: the gap

### Root cause

`src/features/household/components/goal-detail.tsx:314-390`: the grid has the
items section on column 1 with `lg:row-span-2` (line 316), and the chart section
(`lg:col-start-2`, line 378) and the activity wrapper (`lg:col-start-2`, line 387) as two separate grid items. They occupy rows 1 and 2 of column 2. When the
spanning items section is taller than row 1 plus row 2 plus the gap, the grid
distributes the surplus height across both auto rows, so row 1 (chart) grows and
the activity, top-aligned in row 2 by `lg:items-start`, starts after that
extra height. The gap is roughly half the surplus. `gap-y-8` adds a further
fixed 32px, which is the intended gap. The same pattern is in
`goal-detail-skeleton.tsx:16-18`.

### Exact fix

Put the two right-hand sections in one wrapper so they are one grid item, and
drop the row span:

```tsx
<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-8">
  <section className="space-y-3" aria-labelledby="items-heading">
    …
  </section>
  <div className="space-y-6 lg:space-y-8">
    <section className="space-y-3" aria-labelledby="burn-up-heading">
      …
    </section>
    <GoalActivity entries={activity} onEdit={editEntry} />
  </div>
</div>
```

- Remove `lg:col-start-1`, `lg:row-span-2`, `lg:col-start-2` and `lg:gap-y-8`
  (a single grid row has no row gap to set; `gap-6` remains for the stacked
  layout below `lg`).
- The wrapper has no `lg:col-start-*`: two children in a two-column grid auto
  place left then right, so DOM order stays items, chart, activity (mobile order
  and screen-reader order unchanged). `lg:items-start` top-aligns the wrapper so
  it does not stretch to the tall left column; no section gets an extra height.
- The wrapper's `space-y-6 lg:space-y-8` equals the page's section rhythm
  (`goal-detail.tsx:248`), so below `lg` the gap between chart and activity is
  identical to today (24px), and at `lg` it is 32px, with no empty band.
- Mirror it in `goal-detail-skeleton.tsx`: left `Skeleton` without span and
  column classes, right a `div className="space-y-6 lg:space-y-8"` holding the
  `h-[220px]` and `h-40` skeletons.

## Problem 2: headline for goals that run through items

### Basis

One pure helper decides what the page and the card lead with:

```ts
export type GoalBasis = 'saved' | 'paid';

/** Items-first goals are tracked by payments until the first contribution arrives. */
export function goalBasis(
  goal: Pick<HouseholdGoal, 'contributed' | 'items'>
): GoalBasis {
  const planned = goal.items.reduce((sum, i) => sum + effectiveAmount(i), 0);
  return goal.contributed <= 0 && planned > 0 ? 'paid' : 'saved';
}
```

- Paid basis needs a denominator, so it applies only when the items have a
  positive total. A goal with items that all have budget 0 stays on `saved`.
- It is keyed on `contributed`, not on "has payments": the first item added to
  a goal with no savings already switches the headline to "Paid $0 of $Y", which
  is how this goal is used; waiting for a first payment would show "Saved $0 /
  Behind" for the stretch the owner starts a goal.
- **Both contributions and payments exist: basis `saved`.** Contributions are
  household money against the target and drive the card, the plan and the
  status; payments are what has been spent from it (183: `c >= P` normally).
  The summary is unchanged from 189 and the Paid out fact carries payments. One
  addition: when `paid > contributed` the Paid out hint adds "{n} more than
  saved" (muted, masked), because that is the 183 Q6 case (a payment logged
  without a matching contribution) and the page would otherwise understate
  progress without saying why.

Derived values for the paid basis (all in `lib/goal-stats.ts`, whole cents for
comparisons):

- `planned = sum(effectiveAmount(item))` (a quote replaces the estimate, as in
  the item rows; equals `goal.budgeted` when no item has a quote; the label
  still reads "budgeted").
- `leftToPay = goalCommitted(goal)` (existing; overpaid items contribute 0).
- `paidPct = min(100, round(goal.paid / planned * 100))`; bar scale
  `max(planned, goal.paid)`; you and partner widths from `payments` by `isSelf`.

### Status chip and deadline in the paid basis

The linear "expected saved" line of `goalStatus` is meaningless for payments
(deposits fall due early, balances late), so the paid basis compares payments
with what the items say is due. Each item falls due on `item.dueDate ??
goal.targetDate` (the rule already used by the planner, spec 183).

`goalStatus(goal, now)` keeps its signature (`Pick` gains `items`); when
`goalBasis(goal) === 'paid'`:

1. `leftToPay` is 0 (compared in cents) and `planned > 0` -> `funded`.
2. else any item whose due date is before today (`startOfDay`) with `paid <
effective` (cents) -> `behind`.
3. else no item has a due date and the goal has no `targetDate` -> `no-date`.
4. else `on-track`.

`goalDeadline` treats the paid basis the same way: `funded` is decided by
`leftToPay === 0` instead of `remaining <= 0`, so a goal with every item paid
never shows "Overdue". Both functions branch on `goalBasis`, so the card (which
calls `goalStatus`) and the page cannot disagree. In the saved basis nothing
changes. Chip label for `funded` in the paid basis is "Paid in full" (other
labels keep `GOAL_STATUS_LABEL`); `GoalStatusChip` takes an optional `basis`
prop (default `'saved'`) to pick it.

### Chart in the paid basis

Heading "Payments over time" (while amounts are visible; see Masking), series
from a new pure `paidSeries(goal, now)` mirroring `burnUpSeries`:

- `paid`: cumulative payments per calendar day (`payment.date.slice(0, 10)`,
  same-day entries merge), starting at 0 on `min(createdAt date, first payment
date)`, carried to today. Solid `var(--chart-2)` line, same as Saved.
- `due`: cumulative effective amounts by effective due date, drawn
  `type="stepAfter"`, dashed muted (the existing needed-pace styling), starting
  at 0 on the start date and ending at `planned`. Drawn only when at least one
  item has an effective due date. This is exactly what the chip compares
  against, so the picture and the label agree.
- Y axis max `max(planned, paid, due)`; ticks and formatter as today. Legend:
  "Paid" and "Due by date" (swatches as today). Tooltip names via the existing
  `SERIES_LABEL` pattern extended with `paid` and `due`.
- No payments yet: the same 220px box, text "Record a payment to start the
  chart". Chart still lazy (`goal-burn-up-chart.tsx` untouched) and not mounted
  while hidden.

### Facts row per basis

| Basis       | Fact 1      | Fact 2                | Fact 3        |
| ----------- | ----------- | --------------------- | ------------- |
| saved (189) | Remaining   | Paid out (items only) | Monthly share |
| paid        | Left to pay | Saved                 | Monthly share |

- **Left to pay** = `leftToPay`; `text-gain` with hint "All paid" when 0 and not
  hidden; hint "Over budget by {paid - planned}" in `text-loss` when `paid >
planned` and not hidden (the amount is masked).
- **Saved** = `goal.contributed` (`$0.00`), hint "of {target} target" (masked).
  It is the honest statement that nothing has been set aside, and the place the
  target stays visible.
- **Monthly share** unchanged, except the paid basis calls `goalPlanShare({
targetDate, remaining: leftToPay }, now, jointMonthly)` so a goal with every
  item paid does not say "Past target date" because contributions are zero.
  The number itself still comes from the plan.
- The over-commit note is unchanged (it states saved plus still-to-pay against
  the target, which stays true).

### Text wireframes of the summary card, per state

State 1, no items and no contributions (189 as is):

```
+--------------------------------------------------+
| Saved                                         0% |
| $0.00  of $10,000                                |
| [--------------------------------------------]   |
| ------------------------------------------------ |
| Remaining $10,000                Monthly share   |
|                                  $292/mo         |
+--------------------------------------------------+
```

State 2, contributions only (189 as is):

```
| Saved                                        62% |
| $6,200  of $10,000                               |
| [#### you ####][## partner ##]----------------   |
| o You $3,720 (60%)   o Partner $2,480 (40%)      |
| ------------------------------------------------ |
| Remaining $3,800                 Monthly share   |
```

State 3, payments only (the owner's goal; items, no contributions):

```
+--------------------------------------------------+
| Paid                                         26% |
| $12,000  of $46,000 budgeted                     |
| [## you ##][# partner #]----------------------   |
| o You paid $8,000 (67%)  o Partner paid $4,000   |
| ------------------------------------------------ |
| Left to pay    Saved          Monthly share      |
| $34,000        $0.00          $1,900/mo          |
|                of $46,000 target                 |
+--------------------------------------------------+
Chip: [On track]   (or [Behind] if an item is past due and unpaid)
```

State 4, both (189 as is, plus the Q6 hint when `paid > contributed`):

```
| Saved                                        62% |
| $6,200  of $10,000                               |
| [#### you ####][## partner ##]----------------   |
| o You $3,720 (60%)   o Partner $2,480 (40%)      |
| ------------------------------------------------ |
| Remaining $3,800   Paid out        Monthly share |
|                    $7,000                        |
|                    of $9,000 budgeted            |
|                    $800 more than saved         |
```

At 375px each card wraps exactly as in 189 (primary number and "of" line stack,
legend one entry per line, facts `grid-cols-2`).

### Per-state behaviour

| Goal state                                           | Primary                                                 | Chip                                                                    | Chart                                                                        | Facts                                                         |
| ---------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| No items, no contributions                           | Saved $0 of target, 0%                                  | `goalStatus` as today                                                   | placeholder "Add to the goal to start the chart"                             | Remaining, Monthly share                                      |
| Contributions only                                   | Saved (189)                                             | as today                                                                | Saved vs needed pace                                                         | Remaining, Monthly share                                      |
| Items, no contributions (payments only, or none yet) | Paid X of planned, `paidPct`, you/partner from payments | from items due dates (funded "Paid in full", behind, on-track, no-date) | Payments over time with Due-by-date steps; placeholder only when no payments | Left to pay, Saved, Monthly share                             |
| Contributions and payments                           | Saved (189)                                             | as today                                                                | Saved vs needed pace                                                         | Remaining, Paid out (+ "more than saved" hint), Monthly share |

### Masking rules

`useAmountVisibility().hidden` is true: the page must show no number, bar fill,
percent or state that reveals saved or paid amounts, and its layout height must
not change.

- Every new value goes through `mask(...)`: primary amount, "of {planned}",
  percent, legend text, Left to pay, Saved, hints ("of {target} target",
  "Over budget by", "more than saved"). Hints that exist only because of a state
  ("All paid", "Over budget", "more than saved", `text-gain`, `text-loss`) are
  not rendered while hidden, as "Target reached" is today.
- Bar: track only; no fills (as 189). The chip stays hidden (as 189).
- **The basis must not leak.** While hidden the card renders the saved-basis
  skeleton with neutral labels: primary label "Progress", facts "Remaining",
  "Paid out" (when items exist) and "Monthly share", all values masked. The
  paid-basis labels ("Paid", "Left to pay", "Saved") and the heading "Payments
  over time" appear only when `!hidden`. The legend row is always rendered
  while hidden (masked text), so its presence does not reveal whether anything
  was recorded.
- Chart: not mounted while hidden; placeholder "Chart hidden while amounts are
  hidden" at 220px for both bases (unchanged). Heading stays "Progress over
  time" while hidden.
- Deadline text keeps `dateOnly` while hidden, which also hides the paid-basis
  funded/overdue distinction.
- The goal card follows the same rules: its text line and chip are already
  masked or hidden; the paid-basis line below is masked identically.

### Goal card consistency (`goal-card.tsx`)

Minimal change, no layout change (plus the pace input from Q4): the chip already comes from `goalStatus`, so
it follows the paid basis for free; `funded` still triggers the border and
celebration (all items paid in full is a real completion). The text line at
`goal-card.tsx:143-155` is the only part that would contradict it ("$0 of
target / target to go / Goal reached"). In the paid basis it shows `Paid {paid}
of {planned}` left and `{leftToPay} left to pay` (or "All items paid" when 0)
right, masked exactly as the current strings. `ItemBreakdownBar` (paid shading)
and the over-committed line are unchanged. The card's "Behind"/"funded" chip
classes stay inline (189 Q5 stays no for the class duplication).

### Other places that assume contributions (checked)

- `goal-progress.ts` and `goal-actions.ts:219-221`: server-computed saved
  progress; unchanged (it is the saved basis' source of truth).
- `household-goal-series.ts`: a plan-level monthly series from the planner
  schedule, not per-goal contributions; unchanged.
- `goalPlanShare` / `monthlyPaceNeeded`: use `remaining`. In the paid basis the
  page and the card pass `remaining: leftToPay` so a fully paid goal never
  reads "Past target date" (Q4); the monthly number still comes from the plan.
- `breakdownSegments.overCommitted`, `summarizeBreakdown`, `recentActivity`:
  already payment-aware; unchanged.
- `goal-burn-up-chart-content.tsx`: gains the paid series and placeholder copy;
  saved path untouched.
- Known unchanged behaviour (not this spec): a dated goal with no contributions
  shows "Behind" from day 2 in the saved basis (`goalStatus`, expected > 0).

## Files to change

- `src/features/household/lib/goal-stats.ts`: `goalBasis`, `goalLeftToPay`
  helper (or inline `goalCommitted`), `plannedTotal`, `paidSeries`,
  paid-basis branch in `goalStatus` and `goalDeadline`; `Pick` types gain
  `items`.
- `src/features/household/components/goal-detail.tsx`: layout fix; compute
  `basis`; pass it to `GoalSummary`, `GoalStatusChip` and `GoalBurnUpChart`;
  heading text; paid-basis `goalPlanShare` input.
- `src/features/household/components/goal-summary.tsx`: basis-aware primary
  number, percent, bar and legend sources, facts per table, hints, masking
  rules.
- `src/features/household/components/goal-status-chip.tsx`: optional `basis`
  prop for the "Paid in full" label.
- `src/features/household/components/goal-burn-up-chart-content.tsx`: paid
  series, legend, tooltip names, placeholder copy.
- `src/features/household/components/goal-card.tsx`: paid-basis text line only.
- `src/features/household/components/goal-detail-skeleton.tsx`: right-column
  wrapper.
- `src/features/household/constants.ts`: `PAID_STATUS_LABEL` or the one string
  for "Paid in full".
- Not edited: `goal-actions.ts`, `goal-progress.ts`,
  `household-goal-series.ts`, `goal-burn-up-chart.tsx`, `item-breakdown-bar.tsx`,
  the route files, any migration or dependency file.

### Tests

- `test/features/household/goal-stats.test.ts` (or `goal-status.test.ts`):
  `goalBasis` (no items, items with contributions, items without, zero-budget
  items); paid-basis `goalStatus` (funded when all paid, behind when one item is
  past due and unpaid, item with null `dueDate` falling to the goal date, no
  dates, today is not overdue, cent comparison); saved basis unchanged;
  `goalDeadline` funded in the paid basis; `paidSeries` (cumulative by day,
  same-day merge, starts at 0, due steps end at `planned`, no due line without
  dates).
- `test/features/household/goal-detail.test.tsx` and `goal-detail-parts.test.tsx`:
  payments-only goal shows "Paid", the percent, you/partner legend and the
  three facts and no "Behind" when nothing is overdue; both-state goal still
  leads with Saved and shows the "more than saved" hint only when `paid >
contributed`; hidden state for a paid-basis goal shows labels "Progress" and
  "Remaining" (no "Paid", "Left to pay", "Payments over time", no chip, no
  percent, legend row present); section DOM order items, chart, activity.
- `test/features/household/goal-charts.test.tsx`: paid-basis chart renders with
  payments, shows the "Record a payment" placeholder without them, and is not
  mounted while hidden.
- `test/features/household/goal-card.test.tsx`: paid-basis line and chip;
  saved goals unchanged.
- Layout (class-level, since jsdom has no layout): the items section has no
  `lg:row-span-2` and the chart and activity share one wrapper element with
  `space-y-6`; the skeleton has the same structure.

## Out of scope

- No server action, schema, migration, RLS, crypto or dependency change. If the
  owner wants payments to count as contributions, or a payment to create one,
  that is a data-model change and needs its own spec (not proposed here).
- No change to `computeGoalProgress`, `goal.pct`, `goal.remaining`,
  `monthlyPaceNeeded`, the planner or the plan list.
- The "Behind from day 2" behaviour of the saved basis, the goal card layout,
  the editor Sheet and the contribution dialog.
- No re-theme; existing tokens (`fill-brand`, `fill-chart-4`, `--chart-2`,
  `bg-gain-subtle`, `text-loss`, `bg-warning-subtle`) and components only. No
  PRODUCT.md or DESIGN.md.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint` (max-warnings=0), `pnpm typecheck`,
      `pnpm test:ci`, `pnpm build` green
- [ ] No `any`, `console.log`, `@ts-ignore` or `eslint-disable`; no "Spec NNN"
      or narration comments
- [ ] Tests above added and passing
- [ ] Manual at `lg` (1280px) with the owner's long item list: no empty band
      between the chart box and Recent activity; they are 32px apart and
      top-aligned with the first item row
- [ ] Manual at 375px: no horizontal scroll on the whole page in both bases
      (the summary legend, the three facts, the item rows and the chart);
      stacking order is summary, items, chart, activity; the header actions do
      not squeeze the title; controls 44px on coarse pointers
- [ ] Manual in light mode (not verified in the production check): primary
      number, bar fills (`fill-brand`, `fill-chart-4`), both chart lines, the
      "On track" and "Behind" chips and hint colors are legible against the
      light card background; also dark mode as in 189
- [ ] Manual with "Hide amounts" on for the paid-basis goal: nothing numeric,
      no "Paid"/"Left to pay"/"Saved" label, no chip, no fill, no chart; layout
      height is the same as with amounts shown
- [ ] Manual states: no items, contributions only, payments only (the owner's
      goal), both, all items paid, an overdue unpaid item, overpaid item
- [ ] The goal card and the page show the same chip for the same goal in all
      four states
- [ ] Optional: `impeccable detect --json` over the changed components
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: the goal detail page, the goal card chip/text for items-first
  goals, and `goalStatus`/`goalDeadline` outputs for goals with items and no
  contributions. Risks: a masking leak through labels or hints (explicit rules
  and tests above); the headline flipping from Paid to Saved when the first
  contribution is added (intended, see Q1); a status regression for saved-basis
  goals (covered by keeping that branch untouched and tested).
- **Reversibility**: single git revert; no migration.
- **Backout plan**: revert the implementation commit; the spec stays as a record.

## Open questions

- [x] Q1 (resolved 2026-11-16: yes): Switch the headline to "Paid" for items-first goals (basis rule
      above), and switch back to "Saved" as soon as the first contribution
      exists? — Owner: Clarence — Recommended: yes. Alternative: never switch
      automatically and add a per-goal toggle (needs storage; out of scope).
- [x] Q2 (resolved 2026-11-16: yes): In the paid basis the chip means "no item is past its due date
      unpaid" and fully paid shows "Paid in full". Accept, or hide the chip in
      this basis? — Owner: Clarence — Recommended: show it; with no due dates it
      reads "No date", which is neutral.
- [x] Q3 (resolved 2026-11-16: yes): When `paid > contributed` (both exist), show the muted "{n} more than
      saved" hint on Paid out? — Owner: Clarence — Recommended: yes (hint only,
      no warning banner).
- [x] Q4 (resolved 2026-11-16: yes): Should the goal card's "Monthly share"/"Past target date" line also
      use `leftToPay` in the paid basis (as the page does)? — Owner: Clarence —
      Recommended: yes, same one-line change, so a fully paid goal never reads
      "Past target date" on either surface.
- [x] Q5 (resolved 2026-11-16: effective total): Denominator "budgeted": use the effective total (quote replaces the
      estimate, as item rows do) or `goal.budgeted` (estimates only)? — Owner:
      Clarence — Recommended: effective total; the two are equal until a quote
      is entered.
- [x] Q6 (resolved 2026-11-16: leave as is): Two files on main share the number 189
      (`189-household-goal-detail-redesign.md` and
      `189-statement-import-followups.md`). Renumber one? — Owner: Clarence —
      Recommended: leave as is; this spec is 190 and nothing here depends on the
      number.
