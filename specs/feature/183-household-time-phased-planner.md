---
id: '183'
slug: household-time-phased-planner
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-10
approved: 2026-11-10
shipped: 2026-11-10 # YYYY-MM-DD, set on impl merge
impl_pr: none (direct to main); commits 5f5719a..aa6a1af # no PR (direct to main)
supersedes: '176 (partial; see "Superseded parts of spec 176")'
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.3'
  - '§4.4'
  - '§4.5'
  - '§5.1'
  - '§5.1a'
  - '§5.2'
  - '§5.4'
  - '§6.3'
constitution_overrides:
---

# Spec 183: Time-phased household planning and a minimal household surface

## Problem

1. **A cliff at the horizon.** Today a dated household goal due within
   `household_horizon_months` (default 24) is a one-off "reserve" of the caller's
   full share, taken from current savings, and the plan pauses investing until
   that reserve is funded. A goal due one month later than the horizon is paced
   monthly and costs a small amount. The same goal moved by one month changes the
   plan from "invest nothing" to "invest almost everything"
   (`src/features/household/lib/household-commitment.ts:126-146`,
   `src/features/assets/lib/salary-plan.ts:183-201`). The owner wants goals that
   run two years or more, and goals whose spending comes in instalments (a
   wedding venue deposit now, the balance later), handled properly over time.
2. **No instalments.** A goal has one target date
   (`src/features/household/types.ts:61-76`). Its items carry a budget, a quote
   and payments but no date (`types.ts:47-59`), so the planner cannot tell a
   deposit due in two months from a balance due in eighteen.
3. **Too many ideas.** To read one planner line a member must understand the
   horizon, reserve versus pace, the excluded list, a default split, per-goal and
   per-budget overrides, quote versus budget and three screens. The household
   affects two people and each person's own plan; it should read as one number,
   one sentence and one tap for detail.

4. **Spare savings are spent twice.** `computeInvestmentBreakdown` treats savings
   above the emergency fund plus bonds above the war chest as cash to deploy into
   SG and US equity (`src/features/assets/lib/investment-math.ts:195-198`).
   Section 4 of this spec treats that same surplus as already set aside for
   household goals, so without a fix the Investments tab would tell the owner to
   invest money the planner says is earmarked. The gap exists today under spec
   176 as well: the deployable calculation takes only `emergencyFundGoal` and
   `warChestGoal` from the planner (`PlannerValues`,
   `salary-planner.tsx:49-54`; `investment-breakdown.tsx:142-159`), so the 176
   reserve is not subtracted from deployable cash either (it only pauses the
   monthly investment amount).

**Owner approval (2026-11-10).** Clarence wrote: "if you confirmation swep the
spec and you're confident, go ahead to implement." The orchestrator swept the
spec, found the two gaps above (deployable cash and shortfall horizon) and
amended it. With those fixed the spec is approved and every open question takes
its recommended default.

The two members split costs by an agreed percentage, not by salary, because
personal vaults are zero-knowledge (constitution §5.1) and the household space
must not learn either salary (§1.1). That does not change.

## Constitution check

- Satisfies: `§1.1` (household stays household-scoped; the partner never sees the
  caller's personal plan, savings or shortfall), `§2.1` (item due dates carry no
  amount; amounts stay encrypted under `K_h`), `§2.2`, `§2.3` (household actions
  keep `requireHouseholdContext()`, the third vault-gate exception), `§2.4`
  (pages compose features; data comes from hooks), `§2.5` (existing client
  components only; the per-year table and disclosures sit inside existing client
  boundaries), `§2.6`, `§2.7`, `§3.1` and `§3.2` (no new dependency; existing
  shadcn/ui and Recharts-free primitives), `§3.4`, `§4.1` to `§4.4`, `§4.5` (the
  commitment query stays non-blocking), `§5.1` (the personal DEK path is
  untouched; exactly one personal number, the savings surplus, enters the
  household math, in the browser, as a function argument; it is never sent to a
  server action, never stored in household tables), `§5.1a` (decryption stays in
  server actions under `K_h`), `§5.2` (no new table; the new column sits under the
  existing item RLS), `§5.4` (nothing filters or sorts on an encrypted value; see
  Storage decision), `§6.3` (additive, idempotent, forward-only migration, applied
  by the owner).
- Household basis: `specs/governance/052-household-two-person.md`; builds on
  specs 171, 175 and 176.
- Overrides: none. No `HARD` rule is touched and no `SOFT` rule is overridden.
- Dependency: spec 176 is shipped; this spec edits what it built and lists the
  superseded parts below. The items, quote and budget model of spec 175 is
  assumed shipped.

## Current behaviour (verified)

- `computeHouseholdCommitment`
  (`household-commitment.ts:95-171`): a goal with `targetDate === null` or
  `remaining <= 0` is excluded (`:111-123`, reasons `no-date` and `funded`); a
  dated goal with `monthsUntil` null (overdue) or `<= horizonMonths` goes to
  `reserve` = share x remaining (`:126-135`); a goal beyond the horizon goes to
  `pace` = share x remaining / months (`:136-146`); budgets add share x
  `monthlyAmount` to `monthlyDeduction` (`:149-154`).
- `computeSalaryPlan` (`salary-plan.ts:122-234`): `householdReserve` is read at
  `:139`; `savingsTarget = goalsNeeded + householdReserve` (`:183`);
  `reserveGap > 0` (`:186-189`) sends all surplus to savings (`:192-193`) and sets
  `investmentPaused` (`:229`); `planStateLine` (`:237-247`) words the pause;
  `householdShortfallAmt = max(0, -available)` (`:230`);
  `computeShortfallImpact` (`:267-278`) takes `monthsHorizon`.
- Data: `HouseholdGoal.remaining = max(0, target - contributions)`
  (`household/lib/goal-progress.ts:18`, `types.ts:69`). `GoalItem` has `budget`,
  `quote`, `payments`, `paid`, `remaining`, `over` and no date (`types.ts:47-59`).
  `effectiveAmount(item) = quote ?? budget` and
  `goalCommitted = sum(max(0, effective - paid))` (`goal-stats.ts:146-156`).
  `monthsUntil(targetDate, now)` returns null when overdue, else whole months
  rounded up, minimum 1 (`goal-stats.ts:16-23`).
- Action and hook: `getPlannerCommitment` takes `{ horizonMonths }`
  (`household/actions/planner-actions.ts:305-355`); `usePlannerCommitment`
  (`household/hooks/use-planner-commitment.ts:22-28`) keys on the horizon; the
  planner reads `commitmentQuery` at `salary-planner.tsx:250`, feeds
  `householdMonthlyDeduction` and `householdReserve` (`:259-281`), builds the
  reserve target bar (`:390-398`), the shortfall impact over the horizon
  (`:402-413`) and the scenario payload (`:415-417`).
- Storage: goal `name` and `target_amount` are ciphertext, `target_date` is
  plaintext DATE (`supabase/migrations/20260627000000_add_household_goals.sql:11-19`).
  Items: `name` and `budget` ciphertext, `quote` ciphertext (added in
  `20261105000175_household_redesign.sql:12`); payment `date` is plaintext DATE
  (`20261023000149_household_project_items.sql:27`, header comment `:3-5`).
- Personal horizon: `planner_settings.household_horizon_months`
  (`20261106000176_household_planner_split.sql:39`, per spec 176), validated in
  `assets/schemas.ts:45`, edited in `planner-settings-sheet.tsx:38-82,148`,
  defaulted in `assets/constants.ts:87-89`, also referenced in
  `profile/lib/export-validation.ts:138`.
- Scenarios: `scenarioInputsSchema` accepts optional `householdMonthlyDeduction`
  and `householdReserve` (`assets/schemas.ts:61-62`).

## Solution shape

### Principle: one number, one sentence, one tap for detail

- Planner: one Household line, "Set aside $X this month". Tap to expand per-goal
  lines and the per-year table. No reserve bar, no horizon setting, no
  reserve/pace/excluded vocabulary anywhere in the UI.
- Household page: the same recommendation list at the top, both members see the
  same goals with their own share.
- Inputs: a goal needs a name, an amount and a date. Items, item dates and a
  different split are optional and live behind disclosures.
- Code: one pure module owns the schedule, the monthly figure and the
  recommendations. One action returns one shape; the planner and the household
  page both consume it.

### 1. Every dated goal is paced monthly

No horizon bucket. Investment is reduced by the monthly household figure, never
paused by a household reserve. The household horizon setting is retired from the
UI; the column stays, unused (no destructive migration, §6.3). Goals and
budgets whose caller share is 0% stay excluded silently, as today
(`household-commitment.ts:107`).

### 2. Schedule of what is due

The caller's schedule is a list of due entries `{ goalId, itemId | null, label,
date, amount }` where `amount` is the caller's share of the unpaid cost.

Notation per goal: `T` target amount, `c` contributions (`goal.contributed`),
`R = max(0, T - c)` (`goal.remaining`), per item `u = max(0, (quote ?? budget) -
paid)` (unpaid), `E` the sum of `(quote ?? budget)` over items and `P` the sum of
`paid`. Contributions are money already raised and are household money, so they
pay the **earliest** bills first. Placement therefore runs from the latest date
backwards:

- **`goal.remaining` is the total to raise** (target minus contributions, owner
  decision Q3 of spec 176), so contributions are counted exactly once.
- **Entries.** Each item with `u > 0` is an entry on
  `item.dueDate ?? goal.targetDate`. If `T > E` (target above the item total, or
  no items), the rest `T - E` is one more entry on `goal.targetDate` and orders
  with the items by date. An item with no date on a goal with no target date is
  skipped.
- **Latest first.** Sort entries by date, latest first, and give each
  `min(amount, left)`, where `left` starts at `R` and falls by what has been
  placed. Entries that get nothing are dropped. The earliest entries are the
  ones the pot already covers (or that are trimmed); the latest carry what is
  still to be raised.
- **Same thing as funds on hand.** Let `total` be the sum of entry amounts and
  `F = max(0, total - R)` the funds on hand. The still-to-raise cumulative by
  date `d` is `max(0, cumulative entries by d - F)`. In the ordinary case
  (`T >= E`, `c >= P`) `F = c - P`: contributions not yet spent on payments. The
  implementation is the latest-first loop; `F` is only the explanation.
- All amounts are multiplied by the caller's goal share (`goalShare`,
  `household-commitment.ts:65-74`) after placement.
- A goal with no `targetDate` and no dated items is not planned and is listed as
  "no date" (see recommendations).
- A funded goal (`R = 0`) has an empty schedule and says nothing.
- If the unpaid items exceed `R` (items above the target, or contributions
  beyond the target), the earliest items are trimmed: the target wins (Q2).

Example. Target 46,000, contributions 10,000, nothing paid, deposit 10,000 due
in 2 months, balance 36,000 due in 18 months. `R = 36,000`. Latest first: the
balance takes 36,000 and the deposit takes 0. The deposit is covered by the pot;
the schedule is 36,000 at 18 months. With contributions 5,000 instead, `R =
41,000`: the balance takes 36,000 and the deposit 5,000. With contributions
10,000 and the deposit paid (`u = 0`) the schedule is again 36,000 at 18 months.

Known limitation, accepted for this draft (Q6): a payment recorded without a
matching contribution (someone paid the deposit and logged only the payment).
The payment lowers that item's `u`, so the schedule drops it, but `goal.remaining`
(target minus contributions, shown on the goal card) does not drop. Exact effect:
the schedule total is `min(R, total)`, smaller than `R` by `max(0, P - c)` and
never larger. The planner treats the paid item as paid while the goal card still
lists that amount as remaining. The reverse case (a contribution logged without
the payment) is correct: `F = c` covers the earliest unpaid items. See Q1 and Q6.

### 3. Required monthly amount: tightest upcoming deadline

Pure function `computeHouseholdPlan(commitment, { surplus, now })`. With the
schedule sorted by date, let `due_k` be the entry on its `k`-th distinct date
`d_k`, `C_k` the cumulative caller-share due by `d_k`, `S` the amount already
set aside (item 4) and `m_k = monthsUntil(d_k, now)` (overdue dates use 1).

```
goalsMonthly = max(0, max over k of (C_k - S) / m_k)
monthly      = goalsMonthly + budgetsMonthly
```

Budgets stay a flat monthly share (item 7, `household-commitment.ts:149-154`
unchanged). `now` is an argument; the function is pure and unrounded, rounded for
display only.

Worked example. Caller share 50%. Deposit $10,000 due in 2 months, balance
$36,000 due in 18 months, no contributions yet (`R = 46,000`). Caller shares: $5,000 at 2 months, $18,000 at 18
months, so `C = 5,000` then `23,000`.

- `S = 0`: `5,000 / 2 = 2,500`; `23,000 / 18 = 1,277.78`; monthly goals figure
  `2,500` (the deposit is the tightest deadline). Two months later with the
  deposit paid and `C = 18,000` over 16 months, the figure falls to `1,125`.
- `S = 3,000`: `(5,000 - 3,000) / 2 = 1,000`; `(23,000 - 3,000) / 18 = 1,111.11`;
  figure `1,111.11`; the balance is now the tightest deadline.

With contributions of 10,000 (the example in section 2) the schedule is only the
balance: caller share 18,000 at 18 months, `S = 0` gives 1,000 a month and no
deposit payment is due.

This is the continuity fix: a goal due in 23 months and the same goal due in 25
months give the same kind of figure, differing only by the months divisor.

### 4. Existing savings count first

- `surplus = max(0, goalsFunded - goalsNeeded)`, that is savings and bonds above
  emergency fund and war chest (`salary-plan.ts:180-181`, the same quantity as
  the `goalsFunded - goalsNeeded` term at `:188`). It is treated as already set
  aside and applied to the earliest due amounts first, which is exactly the
  `- S` in the formula.
- Where it lives: `computeHouseholdPlan` is a pure function in a new file,
  `src/features/household/lib/household-plan.ts`. It takes `surplus` as a plain
  number argument and imports nothing from `assets`; it reads the existing share
  helpers (`goalShare`, `budgetShare`, `defaultShare`) and `monthsUntil` without
  editing their files. `SalaryPlanner` computes the surplus from its own state
  and passes it in, in the browser.
- The surplus is applied earliest-first across the caller's whole schedule (all
  goals, by date, ties by goal id), giving an offset schedule and `surplusUsed`
  per goal; the cumulative remainder `max(0, C_k - S)` equals the formula above.
- **Earmark for the Investments tab.** The total of the surplus consumed by the
  schedule is returned as `surplusUsed` (never above `S`). It is the household
  earmark: `BreakdownInput` in `investment-math.ts:126` gains an optional
  `householdEarmark` (default 0), and `totalDeployable` becomes
  `floorH(max(0, fromSavings + bondsSurplus - householdEarmark))` (today
  `floorH(fromSavings + bondsSurplus)`, `:198`). With 0 or omitted the result is
  deep-equal to today's. The planner publishes the earmark with the other planner
  values: `PlannerValues` (`salary-planner.tsx:49-54`) gains `householdEarmark`,
  which `onPlannerValuesChange` already carries (`:287`) into the
  `plannerValues` state in `dashboard-overview.tsx:54-67`; the page passes it as
  a prop next to `emergencyFundGoal` and `warChestGoal`
  (`dashboard-overview.tsx:160-166`), `investment-breakdown.tsx` (props `:41-44`)
  forwards it into `computeInvestmentBreakdown` (`:142-159`) and shows it. When
  the earmark is above 0 the Investments view shows one masked line: "$X of your
  spare savings is set aside for household goals". The earmark stays in the
  browser (§5.1, §5.1a).
- The server never receives the surplus. The plan-input action returns household
  data a member can already read through `getGoals()` plus the caller's shares;
  the browser applies `S`.
  The household page calls the same function with `surplus = 0`, and says so
  ("before your savings"). The partner never sees the caller's surplus,
  monthly figure after offset, shortfall or "covered" notices (§1.1, §5.1).
- Circularity check: surplus depends on current savings, bonds and expenses
  (through `emergencyFundGoal`), none of which depend on the household figure.

### 5. Overdue and due this month are due now

Overdue entries and entries dated within the current calendar month are due
now. They use `m = 1`, so their unfunded part (after `S`) lands in this month's
figure. If that exceeds what is left after expenses, insurance, giving and
budgets, the existing shortfall path displays it as "drawn from savings"
(`householdShortfallAmt`, `salary-plan.ts:230`; `computeShortfallImpact`,
`:267-278`). No separate "reserve" path exists.
`computeShortfallImpact` loses its `monthsHorizon` parameter's link to the
setting. A shortfall caused by a deadline two months away does not recur for
twelve months, so a fixed 12 would overstate "leaves X of N months".
`computeHouseholdPlan` therefore also returns `bindingMonths`, the `m_k` of the
deadline that sets `goalsMonthly` (null when `goalsMonthly` is 0), and the
planner projects the shortfall over `min(bindingMonths ?? SHORTFALL_IMPACT_MONTHS,
SHORTFALL_IMPACT_MONTHS)` months. `SHORTFALL_IMPACT_MONTHS = 12` in
`assets/constants.ts` stays as the cap (replacing `salary-planner.tsx:405-407`).

### 6. Per-year view (display only)

Under the Household row: a small table of the caller's share due per calendar
year (sum of the schedule by `date` year), expandable per goal. Amounts go
through `useAmountVisibility` `mask` (`@/features/privacy`, as
`planner-settings-sheet.tsx:3,89`). The math stays monthly; the table never feeds
the plan.

### 7. Spending budgets unchanged

Flat monthly share per budget with its override or the default split, as today.

### 8. States

No household, locked household, loading and error behave as today: commitment
counts as 0 with the existing notes (`planner-household.tsx:118-153`). With no
household the plan output is deep-equal to today's for every retained field
(see Tests).

### 9. Scenarios

`householdReserve` stays accepted by `scenarioInputsSchema`
(`assets/schemas.ts:62`), optional, `schemaVersion` unchanged. A stored value is
ignored by `computeSalaryPlan` (it no longer pauses investing and no longer
adds to the savings target). Old payloads parse and compute; a payload saved
with a positive reserve now shows more investment than it did when saved. See Q7.
Scenario creation stops writing `householdReserve`
(`salary-planner.tsx:415-417`) and writes only `householdMonthlyDeduction`.

### Storage decision: item due date

New nullable column `due_date DATE` on `public.household_goal_items`,
**plaintext**. Reasons:

- It matches the existing split in this schema: goal `target_date` and payment
  `date` are plaintext coarse metadata, amounts and names are ciphertext
  (`20260627000000_add_household_goals.sql:5,16`,
  `20261023000149_household_project_items.sql:3-5`). A due date adds no amount
  and no name; Supabase learns only that something is due on a date, which it
  already learns from the goal date.
- §5.4 is satisfied either way (no SQL filters or sorts on it; the schedule is
  built client-side after decrypt); plaintext keeps date handling identical to
  the other two date columns and avoids a second encrypted-date decode path.
- §6.3: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, nullable, no default, no
  backfill, safe to re-run, forward-only, applied by the owner. Existing item
  RLS and the UPDATE grant from `20261105000175_household_redesign.sql:53-57`
  already cover the column (it is not a new table, so no new policy).

### Recommendations (pure, rule-based)

`householdRecommendations(plan, options)` in the same module returns an ordered
list of typed items; the UI renders each as a plain sentence. No AI, no new
dependency. Each item is `{ kind, goalId | null, amounts, dates }`; copy is
produced by one small formatter in the UI slice, so wording changes never touch
the math. Inputs are the commitment, the plan, `now`, and the optional personal
inputs `surplus` and `shortfallPerMonth` (planner only).

| Kind           | Trigger                                                                                                                                                                                                             | Copy (amounts masked)                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `shortfall`    | planner only: `householdShortfallAmt > 0`                                                                                                                                                                           | This month's household share exceeds what's left by $X; it comes from savings. |
| `next-payment` | per goal, the earliest entry of the offset schedule with amount > 0 dated within 90 days or overdue                                                                                                                 | Venue deposit $5,000 due in 2 months; your share $2,500.                       |
| `behind`       | goal dated in the future or overdue and `goalStatus === 'behind'` (`goal-stats.ts:166-188`); `behindShare = (expected - contributed) x caller share` minus that goal's `surplusUsed`, emitted only if still above 0 | Renovation is $800 behind; $150 more a month catches up.                       |
| `monthly-pace` | goal with a positive own-schedule monthly figure (see below, after the offset) that did not emit `behind`                                                                                                           | Wedding: $1,200 a month keeps you on track for Dec 2027.                       |
| `covered`      | planner only: the goal's schedule total is above 0 before the surplus offset and 0 after it                                                                                                                         | Your savings already cover Honeymoon.                                          |
| `missing-data` | one item when N >= 1 goals are undated (no `targetDate`, no dated item), caller share > 0, and not funded                                                                                                           | 2 goals have no date, so they aren't planned.                                  |

- "Catch-up per month" in `behind` is `behindShare / monthsUntil(target)`, with
  overdue goals using 1, where `behindShare` is already after the surplus offset.
- Exclusivity per goal: a covered goal emits only `covered` (no `behind`,
  `monthly-pace` or `next-payment`). A goal that is not covered emits at most one
  of `behind` and `monthly-pace`, and may also emit `next-payment`. On the
  household page `surplus = 0`, so `covered` never appears and `behind` amounts
  are not offset.
- "Own-schedule monthly figure" for `monthly-pace` and `behind` is the formula in
  section 3 applied to that goal's entries alone. Per-goal figures can sum to
  more than the headline because deadlines of different goals are staggered
  (max of sums is at most sum of maxes), so the UI never sums them and the
  headline is always the combined figure.
- Order: `shortfall`, then `next-payment` by date ascending, then `behind` by
  amount descending, then `monthly-pace` by goal date ascending, then `covered`,
  then `missing-data`. At most 3 are shown with a "Show all" link (Q9). Ties
  break by goal id for stable output.
- Privacy: each recommendation carries only the caller's own share. Household
  inputs are shared by construction; `shortfall` and `covered` use personal
  inputs and exist only in the planner. No kind reveals the partner's personal
  figures (§1.1, §5.1). Amounts use `mask`.
- Derived state: recommendations are recomputed on every render and are not
  stored or dismissible (Q10).

### One shape for planner and household page

A new action `getHouseholdPlanInput()` (new file `actions/plan-actions.ts`, same
guards as `getPlannerCommitment`) returns `HouseholdPlanInput = { state: 'none' |
'locked' | 'ready', isDefaultSplit, callerShares, goals: { id, name,
targetDate, createdAt, targetAmount, contributed, remaining, share, items: { id,
name, effective, paid, dueDate }[] }[], budgets: { id, monthlyAmount, share }[]
}`. It carries only household data the member can already read via `getGoals()`
and the caller's own shares, never the surplus (§5.1, §5.1a). The pure
`computeHouseholdPlan` and `householdRecommendations` run in the browser with
`now` and `surplus`. A new hook `useHouseholdPlan()` uses a key under the
existing `PLANNER_COMMITMENT_KEY` prefix, so the `refreshPlannerCommitment`
invalidations from goal, split and budget mutations keep working with no edits.
The old `getPlannerCommitment` and `usePlannerCommitment` stay until the planner
is switched (S4a) and are deleted in S4b. The planner calls
`computeHouseholdPlan` with its surplus; the household page calls it with 0, and
again at share 1 for the shared total.

Shared total on the household page: "Together $2,400 a month", derived only from
household data and the split's presence (the schedule computed at share 1 plus the
budgets' monthly total), before any personal offset, labelled "before your
savings". It reveals nothing personal: both members can already see every goal,
item, budget and the split. The per-member share on the page equals the
caller's `computeHouseholdPlan(..., surplus 0)` figure.

### Inventory: what a member must understand today, and the proposal

| Input or setting                        | Surfaces today (file:line)                                                                                                                                                        | Proposal                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Goal name, target amount, target date   | `goal-editor-sheet.tsx:51-59` (form values), `:351` (date field); card `goal-card.tsx`; detail `goal-detail.tsx`                                                                  | Keep. The three fields shown first; date made prominent because the plan needs it.         |
| Item budget                             | `goal-editor-sheet.tsx:51,80,100`; `add-goal-item-dialog.tsx`; `goal-item-list.tsx` (`goal-detail.tsx:351`)                                                                       | Hide behind disclosure "Break down the cost".                                              |
| Item quote                              | `goal-editor-sheet.tsx:52,81,101`                                                                                                                                                 | Hide behind "Got a final quote?" on the item row; storage unchanged.                       |
| Item due date (new)                     | n/a                                                                                                                                                                               | Add behind disclosure "Add payment dates" (optional).                                      |
| Item payments                           | `edit-payment-dialog.tsx`; `goal-detail.tsx` item list                                                                                                                            | Keep on goal detail only.                                                                  |
| Goal contributions                      | `add-contribution-dialog.tsx`; `goal-detail.tsx:165-166` (edit state), burn-up `goal-detail.tsx:314`                                                                              | Keep on goal detail only.                                                                  |
| Spending budgets (monthly per category) | `budget-field.tsx:35`, `category-budget-bars.tsx:20`                                                                                                                              | Keep; flat monthly share.                                                                  |
| Per-budget split                        | `budget-field.tsx:192` (`SplitPicker`)                                                                                                                                            | Hide behind "Different split".                                                             |
| Shared spaces and trip spending         | `household-overview.tsx:115,159-171`, `shared-spending.tsx`                                                                                                                       | Keep; does not feed the planner (only `household_spending_budgets` does), so out of scope. |
| Default split                           | `planner-split-editor.tsx` (rendered `household-overview.tsx:143`)                                                                                                                | Merge into a one-line summary ("You pay 50%") that opens the editor on tap.                |
| Per-goal split override                 | `goal-split-override.tsx:6` (used from `goal-editor-sheet.tsx`)                                                                                                                   | Hide behind "Different split"; stored overrides keep working.                              |
| Horizon months                          | `planner-settings-sheet.tsx:38-82,148`; `salary-planner.tsx:69,181-193,235-250,407`; `assets/constants.ts:87-89`; `assets/schemas.ts:45`                                          | Remove from UI and state; column and optional schema field stay (export compatibility).    |
| Reserve versus pace                     | `household-commitment.ts:31,126-146`; `planner-household.tsx:20-100`; reserve bar `salary-planner.tsx:390-398`; `planner-targets.tsx:43-52`; paused line `salary-plan.ts:237-240` | Remove. One monthly figure replaces both.                                                  |
| Excluded list                           | `household-commitment.ts:111-123`; `planner-household.tsx:91-100`                                                                                                                 | Replace with the `missing-data` recommendation; funded goals disappear silently.           |
| Shortfall display                       | `salary-planner.tsx:402-413,496-510`                                                                                                                                              | Keep, reworded with the `shortfall` recommendation.                                        |

Collapse proposal for inputs, keeping stored data compatible: the goal editor's
default state shows name, amount and date. Two disclosures, collapsed by
default, open automatically when the goal already has the data they edit:
"Break down the cost" (items with budget, optional quote, optional due date)
and "Different split" (the existing preset control). Nothing is migrated or
deleted; overrides, quotes and items already stored render as before.

### Code simplicity and net size

Removed: the `reserve` and `pace` buckets and `GoalBucket` (`household-commitment.ts:31`),
`ExcludedReason 'funded'`, `horizonMonths` (input type `:27`, action schema
`plannerCommitmentInputSchema` at `household/schemas.ts:190`, hook argument and key),
`PlannerCommitment.reserve`, `SalaryPlan.householdReserve` and
`investmentPaused`, `reserveGap` (`salary-plan.ts:186-189,192-193,229`), the
paused branch of `planStateLine` (`:238-240`), `HouseholdBreakdown` reserve and
excluded sections (`planner-household.tsx:20-100`), `HorizonField`
(`planner-settings-sheet.tsx:38-82,148-155`), the reserve target bar
(`salary-planner.tsx:390-398`), `DEFAULT_HOUSEHOLD_HORIZON_MONTHS`, `HORIZON_MIN`
and `HORIZON_MAX` usage in UI.

Estimate (to be confirmed at implementation): about 300 source lines removed
(commitment buckets ~70, planner household breakdown ~100, horizon plumbing and
setting ~80, reserve and pause path ~35, action/schema ~15) and about 480
source lines added, about 520 with the earmark work (schedule, plan and recommendations module ~250, household
page card and per-year table ~140, goal editor date and disclosures ~70,
migration ~10, action ~10, earmark and `bindingMonths` plumbing and the
Investments line ~40), plus about 450 test lines. Net production code is
roughly +220 lines, but the vocabulary a member must learn drops from eleven
concepts to three (goal, date, share).

## Superseded parts of spec 176

Spec 176 stays `shipped`; these parts are replaced by this spec when it ships.
Everything not listed (planner split, per-goal and per-budget split A5, expense
average and override, expense buffer, donut, salary derivation, layout move) is
unchanged.

- "Household math": the reserve / pace / excluded bucketing and the
  within-horizon rule (176 lines 163-192).
- "Planner math": `householdReserve` input and `savingsTarget` including it,
  `reserveGap`, "while `reserveGap > 0` all surplus goes to savings", the
  `investmentPaused` output and the paused state line (176 lines 218-242).
- `computeShortfallImpact`'s horizon basis (176 lines 253-258).
- The household horizon setting, its column use and UI (176 lines 121-130, Q6 at
  449-451, "Settings area" 295) and `getPlannerCommitment(input)` taking the
  horizon (176 lines 149-150).
- The reserve progress bar in "Target progress" and the reserve / monthly /
  excluded breakdown, both in the "Layout and planner UI" section (176 lines
  267-314).
- Scenario optional `householdReserve` semantics (176 lines 259-265): the field
  is still accepted but ignored.
- Q1 pause rule (176 lines 428-436): the "strict all-to-savings while a reserve
  gap exists" rule is retired; the 9-month emergency and war-chest spread
  (`salary-plan.ts:194-199`) applies unchanged in every case.

## Slices

Each slice ships with all five gates green (`pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test:ci`, `pnpm build`) on its own: S1 to S3 only add
code, and S4a switches callers before S4b deletes what they used.

### Slice S1: pure schedule, plan and recommendations (additive, new files only)

- `src/features/household/lib/household-plan.ts` (new): input types, schedule
  builder (latest-first placement), `computeHouseholdPlan`,
  `householdRecommendations`. Imports `goalShare`, `budgetShare`, `defaultShare`
  and `CommitmentSplit` from `household-commitment.ts` and `monthsUntil` from
  `goal-stats.ts` without editing either file. `computeHouseholdPlan` returns
  `{ monthly, goalsMonthly, budgetsMonthly, bindingMonths, surplusUsed,
schedule, perGoal }`: `monthly = goalsMonthly + budgetsMonthly`;
  `bindingMonths` is the `m_k` of the deadline that sets `goalsMonthly` (null when
  `goalsMonthly` is 0); `surplusUsed` is the total surplus consumed by the
  schedule, never above `surplus`; `schedule` is the offset schedule of
  `{ goalId, itemId | null, label, date, amount }`; `perGoal` is `{ goalId,
scheduleTotal, surplusUsed, monthly }[]`.
- `src/features/household/lib/household-plan.test.ts` (new): see Tests; one
  describe block per recommendation kind plus ordering, cap, the covered and
  behind interactions, `surplusUsed` (never above surplus, equals the schedule
  total when the surplus covers it) and `bindingMonths` (deposit-binding and
  balance-binding cases, null when `goalsMonthly` is 0).

No existing file is edited, so the slice cannot break anything.

### Slice S2: migration and item due date (owner applies the migration first)

- `supabase/migrations/20261110000183_household_item_due_date.sql` (new):
  `ALTER TABLE public.household_goal_items ADD COLUMN IF NOT EXISTS due_date DATE;`
- `src/features/household/actions/goal-actions.ts`: select, write and diff
  `due_date` with the item (selects at `:83` and `:500`, item write
  `:519-552`).
- `src/features/household/types.ts`: `GoalItem.dueDate: string | null` only.
- `src/features/household/schemas.ts`: optional ISO date on the item schema only
  (item schemas at `:39` and `:52-53`).
- `src/features/household/components/goal-editor-sheet.tsx`,
  `add-goal-item-dialog.tsx`, `goal-split-override.tsx`: the disclosures
  "Break down the cost" (with "Add payment dates" and "Got a final quote?") and
  "Different split"; auto-open when the goal already has the data.
- Tests and fixtures that build a `GoalItem` gain `dueDate: null`; action schema
  (date optional, rejects non-dates), editor disclosure states, existing goals
  without dates round-trip.

Order gate: the goal reads select `due_date`, so shipping this code before the
column exists breaks every goal read in production (`main` deploys to Vercel).
The migration is additive and idempotent, so the owner applies it BEFORE the S2
code lands. S2, and every slice after it, is not pushed to `main` until the
owner confirms the migration is applied. S1 has no such dependency.

### Slice S3: plan input action, hook, household overview UI

- `src/features/household/actions/plan-actions.ts` (new): `getHouseholdPlanInput()`.
- `src/features/household/hooks/use-household-plan.ts` (new): `useHouseholdPlan()`
  under the `PLANNER_COMMITMENT_KEY` prefix imported from the existing hook file.
- `src/features/household/lib/household-recommendation-copy.ts` (new): the one
  formatter that turns a typed recommendation into a plain sentence.
- `src/features/household/components/household-recommendations.tsx` (new): the
  list, 3 shown, "Show all", `mask` on every amount.
- `src/features/household/components/household-year-table.tsx` (new): the
  per-year table with per-goal expansion, reused by the planner in S4a.
- `src/features/household/components/household-overview.tsx`: list at the top,
  shared "Together $X a month, before your savings" line, one-line split summary.
- `src/features/household/components/planner-split-editor.tsx`: collapse behind
  the one-line summary.
- `src/features/household/index.ts`: additive exports only.
- Tests: copy formatter per kind, component states (none, locked, ready, no
  recommendations, over 3, masked).

### Slice S4a: switch the planner and drop the old planner path

- `src/features/assets/components/salary-planner.tsx`, `planner-household.tsx`,
  `planner-targets.tsx`, `planner-settings-sheet.tsx`: single "Set aside $X this
  month" Household line, expand to per-goal lines and the year table,
  recommendation list (max 3), shortfall copy, remove the reserve bar and
  `HorizonField`, pass `surplus` into `computeHouseholdPlan`, stop writing
  `householdReserve` to scenarios.
- `src/features/assets/lib/salary-plan.ts` and its test: remove the reserve and
  pause path, accept and ignore `householdReserve`, `computeShortfallImpact`
  without horizon coupling, projected over `min(bindingMonths ?? 12, 12)` months.
- `src/features/assets/lib/investment-math.ts` and its test: optional
  `householdEarmark` on `BreakdownInput`, subtracted before `totalDeployable` is
  floored.
- `src/features/assets/components/investment-breakdown.tsx`: new
  `householdEarmark` prop forwarded to `computeInvestmentBreakdown`, one masked
  line "$X of your spare savings is set aside for household goals" when above 0.
- `src/app/dashboard/(overview)/dashboard-overview.tsx`: pass
  `plannerValues.householdEarmark` to `InvestmentBreakdown`; the initial
  `plannerValues` state gains `householdEarmark: 0`. `PlannerValues`
  (`salary-planner.tsx`, already in S4a) gains the field.
- `src/features/assets/schemas.ts`, `src/features/assets/constants.ts`
  (`SHORTFALL_IMPACT_MONTHS`): scenario field kept optional and documented as
  ignored; `householdHorizonMonths` stays an optional accepted field in
  `assets/schemas.ts:45` and `profile/lib/export-validation.ts:138` for export
  compatibility.
- Tests: states (none, locked, loading, error, ready, shortfall), masked
  amounts, no horizon field, no-household deep-equal.
- Manual: 375px width, light and dark mode.

After S4a nothing calls `getPlannerCommitment`, `usePlannerCommitment` or the
reserve and pace types.

### Slice S4b: delete the dead household code

- `src/features/household/lib/household-commitment.ts`: remove
  `computeHouseholdCommitment` and the bucket types; keep the share helpers and
  `CommitmentSplit`.
- `src/features/household/types.ts`: remove `PlannerCommitment*`.
- `src/features/household/schemas.ts`: remove `plannerCommitmentInputSchema`
  (`:190`).
- `src/features/household/actions/planner-actions.ts`: remove
  `getPlannerCommitment` and `emptyCommitment` (`:288`).
- `src/features/household/hooks/use-planner-commitment.ts`: delete; move
  `PLANNER_COMMITMENT_KEY` and `refreshPlannerCommitment` into
  `use-household-plan.ts`; update the imports in `use-household.ts`,
  `use-planner-split.ts` and `use-spending-budgets.ts`.
- `src/features/household/index.ts`: remove the old exports (`:22`, `:38`,
  `:51-53`).
- Delete or trim the tests of the removed code.

### Slice, file and order table

| Slice | Files it owns                                                                                                                                                                                                                  | Needs                             | Parallel with |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------- |
| S1    | `lib/household-plan.ts` and its test (both new)                                                                                                                                                                                | nothing                           | S2            |
| S2    | migration (new), `goal-actions.ts`, `types.ts` (GoalItem), `schemas.ts` (item), `goal-editor-sheet.tsx`, `add-goal-item-dialog.tsx`, `goal-split-override.tsx`                                                                 | owner applies the migration first | S1            |
| S3    | `plan-actions.ts`, `use-household-plan.ts`, `household-recommendation-copy.ts`, `household-recommendations.tsx`, `household-year-table.tsx` (new); `household-overview.tsx`, `planner-split-editor.tsx`, `index.ts` (additive) | S1 and S2                         | none          |
| S4a   | the four planner components, `salary-plan.ts`, `assets/schemas.ts`, `assets/constants.ts`, `investment-math.ts`, `investment-breakdown.tsx`, `dashboard-overview.tsx`, their tests                                             | S1 and S3 (hook, copy, table)     | none          |
| S4b   | `household-commitment.ts`, `types.ts`, `schemas.ts`, `planner-actions.ts`, old hook, three hook import edits, `index.ts` (removals)                                                                                            | S4a                               | none          |

Three files are edited by more than one slice: `types.ts` and `schemas.ts` (S2
adds a field, S4b removes the old types) and `index.ts` (S3 adds exports, S4b
removes them). They are sequenced S2 before S4b and S3 before S4b, never in
parallel. Only S1 and S2 can run in parallel. S3 needs S1 (the plan types and
functions it calls) and S2 (the `dueDate` field its action returns). S4a needs
S3 because it consumes the hook, the copy formatter and the year table. S4b is
last.

## Tests to add

- Horizon cliff gone: the same goal due in 23 months and in 25 months produce
  continuous results (ratio of figures within the months divisor, no jump to
  zero investing).
- Tightest deadline: the deposit/balance example above for `S = 0` and
  `S = 3,000` (2,500 and 1,111.11), plus the monthly figure falling after the
  deposit is paid.
- Surplus applied earliest first: a surplus that covers the first entry but not
  the second changes which deadline is tightest.
- Overdue and due-this-month entries use one month and appear as a draw
  through the shortfall path.
- Latest-first placement: target 46,000, contributions 10,000, nothing paid,
  deposit 10,000 at 2 months, balance 36,000 at 18 months gives a schedule of
  36,000 at 18 months only (deposit covered, no next payment); contributions
  5,000 gives 5,000 on the deposit and 36,000 on the balance; contributions
  10,000 with the deposit paid gives the same as the first case.
- Item without a date falls back to the goal target date; goal with no items
  places everything on the target date; target above the item total puts the
  rest on the goal date and it orders with the items by date; items above
  `remaining` trim the earliest items.
- Payment without a contribution: the schedule total is `R - max(0, P - c)` and
  never above `R`.
- No double count: contributions reduce `remaining` once; for `T >= E` and
  `c >= P` the schedule total equals `remaining x share`.
- Undated goal with no dated items is listed as missing data and contributes 0;
  funded goal is silent.
- No household: `computeSalaryPlan` output is deep-equal to today's for every
  retained field across a table of existing inputs (the removed
  `householdReserve` and `investmentPaused` are compared as 0 and false), and the
  planner renders unchanged.
- Old scenario payload with `householdReserve` and with
  `householdMonthlyDeduction` parses and computes; reserve is ignored.
- Recommendations, per kind: trigger boundary (90 days), copy fields,
  partner-safety (output contains no field derived from the other member's
  share beyond the shared goal data), ordering across mixed kinds, cap at 3 and
  show-all, stable tie-break.
- Behind and covered together (planner): a goal behind by contributions but
  fully covered by the surplus emits only `covered`; a partly covered goal emits
  `behind` with amount and catch-up computed after the offset; a goal whose
  behind amount the surplus fully absorbs emits no `behind`; at most one of
  `behind` and `monthly-pace` per goal; on the household page (surplus 0) no
  `covered` appears and `behind` is unoffset.
- Shortfall horizon: `bindingMonths` is 2 when the deposit sets `goalsMonthly`
  and 18 when the balance does, null when `goalsMonthly` is 0; the projection
  uses `min(bindingMonths ?? 12, 12)` months (2, 12 and 12 in those cases).
- Earmark: `computeInvestmentBreakdown` with `householdEarmark` 0 or omitted is
  deep-equal to today's for a table of inputs; an earmark below the surplus
  lowers `totalDeployable` by exactly that amount (and the SG/US cash split with
  it); an earmark above the surplus floors `totalDeployable` at 0. The
  Investments line renders only when the earmark is above 0 and is masked.
- Together total equals the schedule at share 1 and excludes the surplus.
- Migration applied twice is a no-op (manual SQL check by the owner).

## Out of scope

- Income-proportional or salary-based split; reading either member's salary in
  the household space.
- Reading the partner's personal vault, or showing the partner the caller's
  plan, savings, surplus or shortfall.
- Changing spending budgets (stay flat monthly) or the 9-month emergency and
  war-chest spread rule.
- New dependencies or a chart library.
- Dropping `planner_settings.household_horizon_months` (a later forward
  migration, Q5).
- Spaces and trip spending, the goal burn-up chart, contribution and payment
  editing flows, other than the editor changes listed.
- Dismissible or stored recommendations; AI or free-text advice.
- Auto-logging contributions or payments, or inferring that savings hold goal
  money (Q1 offers a later toggle).

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green for each slice
- [ ] Migration applies cleanly twice, is nullable and forward-only; existing item RLS covers `due_date` for a member and denies a non-member
- [ ] The owner confirmed the migration is applied before S2 (and S3, S4a, S4b) reach `main`
- [ ] Deployable cash on the Investments tab no longer double-uses the surplus: `householdEarmark` is subtracted before the floor, 0 is deep-equal to today's, and the masked "set aside for household goals" line shows only when above 0
- [ ] The shortfall projection uses `min(bindingMonths ?? 12, 12)` months
- [ ] Contributions pay the earliest items first: the 46,000 / 10,000 example schedules only the 36,000 balance
- [ ] Every slice is green alone; S1 edits no existing file; S4a switches callers before S4b deletes
- [ ] A goal due in 23 months and in 25 months give continuous plans; no horizon bucket, `reserveGap` or `investmentPaused` path remains
- [ ] Tightest-deadline function matches the worked example; `now` is an argument; surplus applies earliest first
- [ ] Overdue and due-this-month amounts are due now and surface through the shortfall display
- [ ] With no household the plan is deep-equal to today's (retained fields); locked, loading and error states unchanged
- [ ] Old scenario payloads parse and compute; `householdReserve` ignored; new scenarios stop writing it
- [ ] Inventory (A): every row of the inventory table is implemented as keep, merge, hide or remove; no reserve, pace, horizon or excluded wording in any UI string
- [ ] Planner shows one "Set aside $X this month" line; expand shows per-goal lines and a per-year table; all amounts masked via `useAmountVisibility`
- [ ] Household page shows the same recommendation list, the caller's share and a "Together $X a month, before your savings" line derived without any personal input
- [ ] Recommendations (B): all six kinds with the stated triggers and copy, max 3 shown, "Show all", partner-safe, no AI, no dependency; a covered goal emits only `covered`, behind amounts are computed after the surplus offset, at most one of `behind` and `monthly-pace` per goal
- [ ] Goal editor shows name, amount and date by default; items, due dates, quotes and different split are behind disclosures that open when data exists; existing overrides, quotes and items still render
- [ ] Net line estimate stated in the implementation PR and reconciled with the actual diff
- [ ] No `any`, no `console.log`, no `@ts-ignore`, no `eslint-disable`
- [ ] Manual: 375px, dark mode, masked amounts, no household, locked household
- [ ] Spec hash matches at impl time; frontmatter updated to `shipped` after the last slice lands

## Risk & reversibility

- **Blast radius**: the Overview planner, the household overview, saved
  scenarios, and the household item table (one nullable column). Users without a
  household are unchanged by construction.
- **Behaviour change**: investing no longer pauses for a household reserve. A
  goal due soon now raises the monthly figure sharply (the tightest-deadline
  rule front-loads) instead of showing a pause; the shortfall display carries
  the "draws from savings" case. Saved scenarios with a positive reserve will
  show more investment than when saved (Q7).
- **Double count in the caller's favour**: contributions logged against a goal
  that still sit in personal savings are counted in `remaining` (so excluded from
  what is owed) and in the surplus (so applied again). Mitigated by copy
  guidance only, per Q1.
- **Reversibility**: code is a git revert. The migration is additive and
  forward-only (§6.3); the column can stay unused after a revert.
- **Migration order**: the owner applies the additive migration before the S2
  code lands, and S2 is not pushed until the owner confirms; otherwise goal reads
  that select `due_date` fail in production.
- **Backout plan**: revert S4b, S4a, S3, S2, S1 in reverse order; leave the
  schema in place. Reverting S4a alone restores the old planner because S4b has
  not yet deleted its code; reverting S4b needs S4a reverted first. The horizon column and schema field are untouched throughout, so a
  revert restores the old behaviour without data loss.
- **Privacy**: the surplus exists only in the owner's browser as a function
  argument; no action or table receives it. The shared total uses household data
  only.

## Open questions

Each has an owner (Clarence) and a recommended default; none is resolved yet.

- [x] Q1: Contributions already logged against a goal. If that money still sits in
      the caller's personal savings it is counted twice in the caller's favour
      (`remaining` excludes it, savings surplus includes it). Options: copy
      guidance only, or a per-goal "held in my savings" toggle. Default: copy
      guidance only. Owner: Clarence. A: copy guidance only. (owner,
      2026-11-10, recommended default)
- [x] Q2: When the goal target amount and the committed item total (`quote ??
budget`) differ, which wins? Default: the goal target is authoritative
      (`goal.remaining`), items only decide timing, contributions pay the earliest
      items first, and when items exceed the remainder the earliest items are
      trimmed (the pot covers them). Owner: Clarence. A: goal target is
      authoritative, earliest items trimmed. (owner, 2026-11-10, recommended
      default)
- [x] Q3: Undated goals. Keep them excluded and listed through the `missing-data`
      recommendation, or require a date on every goal? Default: keep excluded and
      listed. Owner: Clarence. A: keep excluded and listed. (owner, 2026-11-10,
      recommended default)
- [x] Q4: Does the emergency and war-chest 9-month spread rule
      (`salary-plan.ts:194-199`) stay as is? Default: unchanged. Owner: Clarence. A: unchanged. (owner, 2026-11-10,
      recommended default)
- [x] Q5: Drop `household_horizon_months` later via a separate forward
      migration? Default: leave the column. Owner: Clarence. A: leave the column. (owner, 2026-11-10,
      recommended default)
- [x] Q6: A payment recorded without a matching contribution lowers the item's
      unpaid amount but not `goal.remaining`, so the schedule total falls below
      `remaining` by `max(0, P - c)` while the goal card still shows it. Should
      payments also lower `goal.remaining`? Default: no, `remaining` stays target
      minus contributions and the planner treats the item as paid; revisit with
      Q1. Owner: Clarence. A: no; `remaining` stays target minus contributions.
      (owner, 2026-11-10, recommended default)
- [x] Q7: A stored scenario with `householdReserve > 0` now shows more
      investment than when saved. Proposed: ignore the field, leave
      `schemaVersion` at 1. Alternative: bump `schemaVersion` and label old
      scenarios "saved under the old household rule". Default: ignore, no bump.
      Owner: Clarence. A: ignore, no bump. (owner, 2026-11-10, recommended
      default)
- [x] Q8: Show the shared total ("Together $2,400 a month, before your savings")
      on the household page? Default: yes. Owner: Clarence. A: yes. (owner, 2026-11-10, recommended
      default)
- [x] Q9: Cap of 3 recommendations with a "Show all" link? Default: 3. Owner:
      Clarence. A: 3 with "Show all". (owner, 2026-11-10, recommended default)
- [x] Q10: Are dismissible recommendations needed? Default: no; they are derived
      state and disappear when the cause does. Owner: Clarence. A: no. (owner, 2026-11-10,
      recommended default)
