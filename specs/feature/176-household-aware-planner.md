---
id: '176'
slug: household-aware-planner
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-06
approved: 2026-11-06 # YYYY-MM-DD, set on approval
shipped: 2026-11-06 # YYYY-MM-DD, set on impl merge
impl_pr: none (direct to main); commits 61198d8, 9cb413d, a492b81, 31f35f4, 426b2ff, 3366cee, 0650649, 2d40584 # no PR (direct to main)
supersedes:
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

# Spec 176: Household-aware salary planner

## Problem

1. **Household commitments are invisible to the plan.** The "Plan income" tab
   sends everything left after expenses, insurance, tithe and allowance to
   savings and then investment. Part of that money already belongs to the
   household: dated joint goals (a wedding, a renovation) and the recurring
   household spending budgets. The investment line is overplanned, so the owner
   is told to invest money that is committed elsewhere.
2. **The expenses input is stale and diluted.** `SalaryPlanner` seeds
   `useState(Math.round(avgExpenses))` once
   (`src/features/assets/components/salary-planner.tsx:147`), so new expense data
   never updates it. The average itself, `calcAllTimeAvgExpense`
   (`src/features/assets/lib/salary-plan.ts:22-39`), averages every month ever
   logged, counting the current partial month and diluting recent spending.
3. **The planner is hard to find and hard to read.** It sits behind a separate
   "Plan income" tab (`src/app/dashboard/(overview)/dashboard-overview.tsx:142-148`)
   and presents a wall of inputs and results.

The two members split household costs by an agreed percentage, not by salary.
A salary-based split is impossible: personal vaults are zero-knowledge
(constitution §5.1), so the partner cannot read the owner's salary and the
household space must not learn it (§1.1).

## Constitution check

- Satisfies: `§1.1` (household stays household-scoped; personal vaults are not
  merged; the partner never sees salary or the personal plan), `§2.1` (the split
  is a financial payload and is encrypted), `§2.2`, `§2.3` (new household
  actions use `requireHouseholdContext()`, the third vault-gate exception),
  `§2.4` (pages compose from features; data comes from hooks), `§2.5` (the
  planner redesign extends existing client components; sheets and collapsibles
  need no new boundary beyond the ones the planner already has), `§2.6`, `§2.7`,
  `§3.1` and `§3.2` (no new dependency; existing shadcn/ui components only),
  `§3.4`, `§4.1` to `§4.4`, `§4.5` (the planner moves into the first tab, so it
  must not add a blocking fetch to initial render; see Planner UI), `§5.1` (the
  personal DEK path is untouched; only a computed monthly figure and a reserve
  figure cross from household to personal state, in the browser), `§5.1a` (the
  split blob is encrypted under `K_h`), `§5.2` (RLS on the new table), `§5.4`
  (nothing filters or sorts on an encrypted value), `§6.3` (forward-only,
  additive, idempotent migration).
- Household basis: `specs/governance/052-household-two-person.md`; builds on the
  goals, items, contributions and spending budgets of specs 171 and 175.
- Overrides: none. No `HARD` rule is touched and no `SOFT` rule is overridden.
- Dependencies: spec 175 is `approved`, not `shipped`. This spec reads
  `household_spending_budgets`, item `quote` and the goal item model that 175
  adds, so implementation of every slice waits until 175 is shipped and closed.
  Spec 177 (dividend card) also edits `dashboard-overview.tsx`; the two
  implementations must be sequenced, not run in parallel (see Slices).

## Solution shape

### Data model (one migration, slice S1)

Migration `supabase/migrations/20261106000176_household_planner_split.sql`:
additive, idempotent, forward-only (§6.3).

- New table `public.household_planner_settings`, one row per household:
  `household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE`,
  `split TEXT NOT NULL` (encrypted under `K_h`),
  `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`,
  `updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())`.
- Why a new table and not a column: the default split is household-level, so it
  needs a home that exists before any goal does. Per-goal overrides live inside
  the same encrypted blob keyed by goal id, so `household_goals` is unchanged.
  A column on `households` would mix an encrypted payload into the plaintext
  metadata table that `getHousehold` reads without `K_h`
  (`src/features/household/actions/household-actions.ts:80-105`).
- Decrypted `split` shape (Zod-validated on read and write):
  `{ members: Record<userId, pct>, goalOverrides: Record<goalId, Record<userId, pct>> }`.
  Each `pct` is an integer 0 to 100; each map holds exactly the two household
  member ids and sums to 100. Overrides for deleted goals are ignored on read and
  pruned on the next write (no FK is possible inside ciphertext).
- Default when no row exists: 50/50, returned with `isDefault: true` so the UI
  can tell "no split set" from "split set to 50/50".
- RLS and grants follow migration 175 and spec 160: `ENABLE ROW LEVEL SECURITY`;
  SELECT, INSERT and UPDATE policies gated by
  `public.is_household_member(household_id)` (INSERT also
  `created_by = auth.uid()`); no DELETE policy or grant, since the row is
  replaced, never removed, and cascades with the household. The same migration
  runs `GRANT SELECT, INSERT, UPDATE ON TABLE public.household_planner_settings
TO authenticated` so the 42501 trap fixed by
  `supabase/migrations/20261101000160_household_table_grants.sql` is not repeated.
- The same migration adds `household_horizon_months INTEGER NOT NULL DEFAULT 24`
  to the personal `public.planner_settings` table
  (`supabase/migrations/20260411150000_init.sql:21`), via
  `ADD COLUMN IF NOT EXISTS`, with a `CHECK` of 1 to 120. It is a non-sensitive
  integer like the existing `emergency_months` and `war_chest_months`, and it is a
  personal preference, so it lives with the personal planner settings, not in the
  shared household row. `plannerSettingsSchema`
  (`src/features/assets/schemas.ts:38-45`) and the settings action/hook
  (`src/features/assets/actions/planner-actions.ts`,
  `src/features/assets/hooks/use-planner-settings.ts`) gain the field with default 24.
- The expenses override (see "Expenses input") is not stored server-side: it is
  a plaintext financial amount, and the personal tables keep amounts encrypted
  (§2.1, §5.4). It is a per-browser convenience held in `localStorage`.
- Either member may edit the split; the UI states that the partner sees the
  change. See Q2.

### Household actions (slice S1 and S2; encryption-touching)

New file `src/features/household/actions/planner-actions.ts` (`'use server'`),
following `budget-actions.ts` (`decryptPayload` / `encryptPayload` with `ctx.kh`):

- `getPlannerSplit()` returns the decrypted split for the caller, with
  `isDefault`. Uses `requireHouseholdContext()`
  (`src/lib/action-guard.ts:52-61`), which throws when `K_h` is not in the
  `fynfo_household_kh` session.
- `setPlannerSplit(input: unknown)` Zod-validates (`parseOrThrow`, schema in
  `src/features/household/schemas.ts`), encrypts under `ctx.kh`, and upserts by
  `household_id` (household id read the way `budget-actions.ts` does).
- `getPlannerCommitment(input)` (read only, S2) takes the horizon in months and
  returns `{ state, reserve, monthlyDeduction, goals[], budgets, excluded[] }`.
  It reuses `getGoals()` (`goal-actions.ts:145`), `getSpendingBudgets()`
  (`budget-actions.ts`) and the split, then calls the pure function from S2.
  `K_h` decryption stays where it is today, in server actions using the session
  cookie; no new key handling is introduced and no household ciphertext reaches
  the client. The caller is resolved server-side (`ctx.userId`) and the response
  carries only the caller's own share.
- Exports go through `src/features/household/index.ts` (§2.6, §2.7).
- Errors use the existing `AppError` path and never leak Supabase text
  (AGENTS.md §4). The locked case is detected by the existing locked error
  (`src/lib/action-guard.ts:12-16`) and mapped to `state: 'locked'` in a thin
  wrapper, not a new error class.

### Household math (slice S2; pure, unit-tested)

New file `src/features/household/lib/household-commitment.ts`, pure, all inputs
passed in (including `now: Date` and `horizonMonths`). For each household goal:

- `myShare(goal)` is the caller's percentage from the goal override if present,
  else from the household default, as a fraction.
- `remaining(goal)` is `max(0, goal.remaining)`: target minus all contributions
  from both members (`src/features/household/lib/goal-progress.ts:19`, as
  `getGoals` returns it). See Q3 for the item `quote ?? budget` reading.
- `monthsLeft(goal)` reuses the whole-month rule of `monthlyPaceNeeded`
  (`src/features/household/lib/goal-stats.ts:16-26`): partial months round up,
  minimum 1. To avoid a second copy, S2 extracts it as an exported
  `monthsUntil(targetDate, now)` in `goal-stats.ts` and has `monthlyPaceNeeded`
  call it; behaviour and existing tests stay unchanged.
- Each dated goal falls into exactly one bucket, so nothing is counted twice:
  - **Reserve** (target date within `horizonMonths`, or already passed):
    contributes `myShare x remaining` to the household reserve. An overdue goal
    is therefore due now and is reserved in full, with no monthly spike.
  - **Pace** (target date beyond the horizon): contributes
    `myShare x remaining / monthsLeft` to the monthly deduction, so a house in
    ten years does not block investing for years.
  - **Excluded** (listed in the UI with the reason, never dropped silently):
    `no-date` and `funded` (remaining is 0).
- Spending budgets: `monthlyDeduction += myShareDefault x sum(monthly_amount)`.
  Budgets are monthly shared figures, so they use the household default split,
  never a per-goal override.
- Output: `{ reserve, monthlyDeduction, goals[], budgets, excluded[] }`, where
  `goals[]` carries each goal's bucket and its figure for the breakdown.
- Money stays unrounded in the math and is rounded for display only.

### Expenses input (slice S2 math, S3 UI)

- New pure `calcRecentAvgExpense(expenses, now, months = 6)` in
  `salary-plan.ts`: averages the user's own monthly expense (same shared-split
  rule and `isCountedInExpenseTotals` filter as today) over the last `months`
  full calendar months, excluding the current month, across the months in that
  window that have data. It returns the average and the count of months used, so
  the UI can say "avg of last 6 months" or "avg of last 4 months" when fewer have
  data; no data in the window returns 0 (the label stays "Est. Expenses").
  `calcAllTimeAvgExpense` is removed once nothing uses it (its only caller is
  `salary-planner.tsx:109`).
- N = 6. Three months is too easily moved by one irregular month; six smooths
  annual items (insurance premiums, travel) while still reflecting current
  spending. Open to the owner (Q5).
- Sync: the planner holds `expensesOverride: number | null`. The expense field
  shows the override when set, otherwise the live average, so it follows new
  data. Typing a value sets the override; a "Reset to average" control clears it.
  The override is saved in `localStorage` (try/catch around every access; the
  page renders correctly without it). The source line beside the field reads
  "avg of last 6 months" or "your own figure" with the reset control.
- This replaces the one-time seed at `salary-planner.tsx:147`; a regression
  test proves the field follows the average after expense data changes and
  stops following once overridden.

### Planner math (slice S2; pure)

`computeSalaryPlan` (inputs `src/features/assets/lib/salary-plan.ts:41-52`, math
`:83-105`) gains two optional inputs, both default 0:

- `householdMonthlyDeduction`: budget share plus long-dated goal pace, treated as
  an expense-like monthly deduction.
- `householdReserve`: the sum of `myShare x remaining` for goals within the
  horizon.

Order: net, expenses, insurance, tithe and allowance (as today), household
monthly deduction, savings target, investment.

- `savingsTarget = emergencyFundGoal + warChestGoal + householdReserve`.
  `savingsFunded = currentSavings + currentBonds` (as `goalsFunded` today).
  `reserveGap = max(0, householdReserve - max(0, savingsFunded - emergencyFundGoal - warChestGoal))`
  is the unfunded part of the reserve on top of the existing goals.
- `usedPct` gains `householdPct = householdMonthlyDeduction / netAfterCpf`.
- While `reserveGap > 0`, all surplus after the deductions goes to savings and
  investment is 0 ("invest only once the target is met"). With
  `householdReserve = 0` the existing 9-month spread rule is untouched and every
  existing output is identical. This discontinuity is intended; see Q1.
- New outputs: `householdPct`, `householdAmt`, `householdReserve`,
  `savingsTarget`, `savingsGap = max(0, savingsTarget - savingsFunded)`,
  `investmentPaused` (boolean), `householdShortfallAmt`.
- State line (`planStateLine`, pure, in `salary-plan.ts`): when investment is
  paused, "Investing paused: savings $X short of emergency + war chest +
  household reserve ($Y)" with `X = savingsGap` and `Y = savingsTarget`; when no
  household is involved the legacy goal wording applies; when investing, a short
  "Investing $Z a month" line. One line, always shown.
- Shortfall: `available = netAfterCpf - expensesAmt - insuranceAmt - titheAmt - allowanceAmt - householdAmt`.
  When `available < 0`, savings and investment are 0 and
  `householdShortfallAmt = -available` per month. The UI labels it "drawn from
  savings per month".
- Emergency-fund impact, a separate pure helper in the same file:
  `computeShortfallImpact({ shortfallPerMonth, monthsHorizon, currentSavings, expenses, emergencyMonths })`.
  `projectedSavings = currentSavings - shortfall x monthsHorizon`;
  `monthsCovered = expenses > 0 ? max(0, projectedSavings) / expenses : 0`; the UI
  shows "leaves 3.2 of 6 months". `monthsHorizon` is the household horizon (24
  by default). Only the savings category is drawn, not bonds, matching how the
  planner keeps `currentSavings` and `currentBonds` apart
  (`salary-planner.tsx:211-243`).
- Scenarios use the same function (`scenario-actions.ts:39`,
  `scenario-dialog.tsx:79`). `scenarioInputsSchema`
  (`src/features/assets/schemas.ts:48-59`) gets optional
  `householdMonthlyDeduction` and `householdReserve`
  (`z.number().min(0).max(1e9).optional()`); stored payloads without them parse
  unchanged, so `schemaVersion` stays 1 and results are identical.

### Layout and planner UI (slice S3)

- **Move to Overview.** `SalaryPlanner` moves into the "Overview" view, directly
  below `LatestRecords` (the overview cards) and above `DividendSummary`
  (`dashboard-overview.tsx:100-140`). The remaining view keeps
  `InvestmentBreakdown` and `InvestmentAllocation` (and the dividend card if spec
  177 puts it there) and is renamed "Investments" (owner decision, 2026-11-06). The lifted
  `plannerValues` state and `handlePlannerValuesChange` stay in the page, so
  `InvestmentBreakdown` still receives `investmentAmount`, `emergencyFundGoal`
  and `warChestGoal`. Because the planner now mounts with the default tab,
  `InvestmentBreakdown` no longer waits for the user to open the plan tab.
  Risk and mitigation: see Risk.
- **Household data on the first tab.** The commitment hook is a normal React
  Query query that does not block the planner: while it loads or fails, the
  planner renders with commitment 0 and a "household loading" or "not included"
  note (§4.5).
- **Flow bar.** One horizontal stacked bar, net to
  expenses, insurance, tithe/allowance, household, savings, investment, as a
  waterfall of the month's take-home, with the amounts in a legend table below.
  Built from existing Tailwind and shadcn/ui primitives; no chart dependency.
  Segments keep a minimum visible width and the legend carries the values.
- **Target progress.** Three progress bars (shadcn `Progress`): emergency fund,
  war chest, household reserve, each with funded of target. The reserve bar
  appears only when a household contributes.
- **State line.** The `planStateLine` text sits directly under the flow bar.
- **Settings area.** The input wall collapses into a compact summary row (salary,
  expenses with source, months, tithe/allowance) with an "Adjust" button opening a
  shadcn `Sheet` (a `Collapsible` on desktop is acceptable). Fields are grouped:
  Income and expenses, Savings targets (incl. household horizon), Giving. The
  expenses field shows its source and the reset-to-average control.
- **Household row and breakdown.** A "Household" line in the flow legend expands
  to: reserve (per goal, my share), monthly deduction (budgets and long-dated
  goals), and the Excluded list (undated, funded) linking to the goal.
- **States:** no household (row hidden, plan unchanged); household locked (row
  reads "Unlock your household to include shared commitments" with a link, the
  commitment counts as 0, and a "household not included" note stops the
  investment figure being mistaken for final); no split set (`isDefault`: uses
  50/50 and links to the split editor); shortfall (savings and investment show 0,
  warning with the monthly gap and "leaves X of N months of emergency fund").
- **Split editor** lives in the household feature (members' percentages on the
  household overview; per-goal override on the goal editor sheet).
- **Responsive and theming:** works at 375px (stacked legend, bar remains
  readable, Sheet full width) and in dark mode using the existing design tokens.
  Amounts honour the app's masking: new amount text goes through
  `useAmountVisibility()` (`mask`), as `asset-bar-chart-content.tsx:89` does.
- Cross-feature imports use feature barrels only (§2.6); the page passes the
  commitment into the planner as a prop (§2.4).

### Double-count guidance (copy only)

Household spending never enters personal Expenses (already true: it lives in
`household_spending`, not the expense data the planner averages). The planner
copy tells the user not to also log their share of a household goal or budget as
a personal expense, or it is counted twice. No code enforces this. See Q4.

## Slices

Each slice ships directly to `main` (no PR, solo workflow) with all five gates
green: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
`pnpm build`. All slices start only after spec 175 is shipped. S1 and S2 do not
share files and can run in parallel; S3 needs both. S3 edits
`dashboard-overview.tsx`, as does spec 177: S3 and 177's implementation must run
one after the other, in either order, never in parallel.

### Slice S1: split setting, horizon setting, migration, actions

- Migration `20261106000176_household_planner_split.sql`: split table, RLS,
  grants, and `planner_settings.household_horizon_months`.
- `planner-actions.ts` (`getPlannerSplit`, `setPlannerSplit`), Zod schema, types,
  hook, barrel exports; `plannerSettingsSchema` and the personal settings
  action/hook carry the horizon.
- Split editor in the household feature (default 50/50) and the per-goal override
  field in the goal editor sheet.
- Tests: schema (sums to 100, exactly two members, integer pct), default when no
  row, input validation, override pruning, horizon bounds and default.

### Slice S2: pure math (reserve, pace, recent-average expenses, planner)

- `household-commitment.ts` with the reserve / pace / excluded bucketing and the
  budget share; extract `monthsUntil` from `monthlyPaceNeeded` (existing tests
  unchanged).
- `calcRecentAvgExpense` with window, current-month exclusion, shared splits and
  months-used count; replace `calcAllTimeAvgExpense`.
- `computeSalaryPlan` new inputs and outputs, `planStateLine`,
  `computeShortfallImpact`, optional scenario schema fields.
- `getPlannerCommitment()` action wiring the split, goals and budgets.
- Tests: with both new inputs 0 or omitted the plan is deep-equal to today's
  across a table of existing inputs; reserve vs pace bucketing at the horizon
  edge (within, exactly at, beyond); overdue goes to reserve; no double count;
  undated and funded excluded; override 100/0; budgets use the default split;
  investment paused until the target is met then resumes; shortfall and
  emergency-months impact; state line wording; expenses average excludes the
  current month, uses the last 6 full months, handles fewer months and shared
  splits; a scenario payload without the new fields still validates.

### Slice S3: planner UI redesign and move to Overview

- Move `SalaryPlanner` into the Overview view below `LatestRecords`; rename the
  remaining view; keep `plannerValues` wiring.
- Flow bar, target progress bars, state line, settings Sheet, household
  breakdown, expenses source and reset control (override in `localStorage`).
- `use-planner-commitment.ts` hook and the states (none, locked, no split,
  loading, shortfall).
- Component tests for each state (jsdom per file, as the repo's test setup does),
  including the expenses field following new data until overridden.
- Manual: 375px width, light and dark mode, masked amounts.

## Out of scope

- Salary-based or income-proportional splits, and anything that reads either
  member's salary from the household space.
- Reading the partner's personal vault, or showing the partner the owner's plan.
- Changing how household goals, budgets or contributions are stored or edited,
  beyond the per-goal override field in the goal editor.
- Auto-logging household contributions as personal expenses.
- Changing the 20% CPF rule, 5% insurance, or the emergency/war-chest goal
  formula (`salary-plan.ts:83-105`). Tithe/allowance logic is unchanged.
- The dividend card itself (spec 177) and any other dashboard change.
- New dependencies or a new chart library.
- Server-side persistence of the expenses override.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green for each slice
- [ ] Migration applies cleanly twice (idempotent) and is forward-only; RLS and grants verified for a member and a non-member
- [ ] `computeSalaryPlan` with the household inputs 0 or omitted returns output deep-equal to today's for every existing test input
- [ ] Goals within the horizon feed the reserve, goals beyond it feed the monthly pace, and no goal is in both
- [ ] Investment is 0 while `savingsGap > 0` with a household reserve, and resumes when the target is met; the state line shows the gap and target
- [ ] Shortfall sets savings and investment to 0 and reports the monthly gap and emergency-fund months left
- [ ] Expenses default to the last 6 full months, exclude the current month, follow new data until overridden, and reset to the average
- [ ] Planner renders below the overview cards on the Overview view; the other view is renamed and still receives planner values
- [ ] Existing scenarios load and compute identically
- [ ] No `any`, no `console.log`, no `@ts-ignore`, no `eslint-disable`
- [ ] Manual: no-household, locked and no-split states; 375px; dark mode; masked amounts
- [ ] Spec hash matches at impl time; frontmatter updated to `shipped` after the last slice lands

## Risk & reversibility

- **Blast radius**: the dashboard Overview and "Plan income" tabs, saved
  scenarios and the planner settings row. Users without a household are
  unchanged in math by construction.
- **Reversibility**: code is a plain git revert. Migrations are additive and
  forward-only (§6.3); the table and column can stay unused after a revert.
  Dropping them needs a new forward migration.
- **Backout plan**: revert the slice commits and leave the schema in place. A
  revert of S2 must keep the optional scenario fields allowed, or scenarios saved
  with them become unavailable; the S2 commit message calls this out.
- **Layout risk**: `plannerValues` is lifted state fed by the planner. If the
  tab view unmounts inactive content, a user who opens "Investments" before the
  planner has mounted would see empty values; the default view is Overview, so
  the planner mounts first. S3 verifies this and falls back to computing
  `plannerValues` from the lifted inputs if not.
- **Data risk**: a wrong split or horizon changes the investing advice silently.
  Mitigated by the visible breakdown, the one-line state, the "using 50/50" note
  and the excluded list.
- **Privacy**: the split is ciphertext under `K_h`; Supabase sees only that a row
  exists (§5.4). Reserve and deduction reach the personal planner as numbers in
  the owner's browser and are never stored in the personal vault.

## Open questions

- [x] Q1: Investment-pause rule. The owner's wording ("while savings < target, all
      surplus goes to savings") differs from today's rule, which spreads the
      remaining emergency/war-chest need over 9 months and lets the rest flow to
      investment. To keep results identical with no household, proposed default:
      the strict "all surplus to savings" rule applies only while a household
      reserve gap exists; with no reserve the existing 9-month rule is kept. This
      makes investment pause as soon as any reserve gap appears. Should the strict
      rule also replace the 9-month rule for emergency and war chest (changing
      today's results)? Owner: Clarence. A: Strict "all surplus to savings" applies only while a household reserve gap exists. With no reserve, the existing 9-month emergency/war-chest rule is kept, so results are unchanged without a household. (owner, 2026-11-06, recommended default).
- [x] Q2: May either member edit the split, or only the household owner?
      Proposed default: either member, since it is a mutual agreement and RLS
      treats members alike. Owner: Clarence. A: Either member may edit the split. (owner, 2026-11-06, recommended default).
- [x] Q3: For project goals with items, is `remaining` simply target minus
      contributions (`goal.remaining`), or the committed amount (`quote ?? budget`
      per item, `goalCommitted`, `goal-stats.ts:141-146`)? Proposed default:
      `goal.remaining`, which matches the pace line and burn-up. Owner: Clarence.
      A: Use `goal.remaining` (target minus contributions). (owner, 2026-11-06, recommended default).
- [x] Q4: Should the planner warn when personal Expenses look like they already
      include a household cost? Proposed default: copy guidance only, no
      detection. Owner: Clarence. A: Copy guidance only, no detection. (owner, 2026-11-06, recommended default).
- [x] Q5: Expenses window N = 6 full months (proposed) or 3? Owner: Clarence. A: N = 6 full months. (owner, 2026-11-06, recommended default).
- [x] Q6: Horizon default 24 months, configurable 1 to 120, stored in
      `planner_settings`. Is a personal (not shared) horizon right? Proposed
      default: personal. Owner: Clarence. A: Personal horizon, default 24, range 1 to 120, stored in `planner_settings`. (owner, 2026-11-06, recommended default).
- [x] Q7: Persist the expenses override only per browser (`localStorage`,
      proposed) or per account (would need an encrypted column and a migration)?
      Owner: Clarence. A: `localStorage` only, per browser. (owner, 2026-11-06, recommended default).
- [x] Q8: Should a budget in a category whose goal already exists be netted out?
      Proposed default: no, goals and budgets are independent lines. Owner:
      Clarence. A: No netting; goals and budgets are independent lines. (owner, 2026-11-06, recommended default).

## Amendment 2026-11-06 (round 2)

Owner (Clarence) approved this amendment in chat on 2026-11-06 ("Yes, go ahead").
Status stays `approved`. Sections above stay as written; where this amendment
changes them, the superseded text is listed here and wins over the older text.

### Superseded by this amendment

- Expenses window of 6 full months (Problem 2, Acceptance, Q5): now 12 full
  months. The current partial month is still excluded.
- Planner breakdown as one stacked `ProgressBar` (`planner-flow.tsx:3,48`): now a
  donut chart.
- Gross salary seeded once into `useState` (`salary-planner.tsx:163`): now derived.
- The household-wide split applying to every goal and budget (`defaultShare`,
  `household-commitment.ts:54-56,130`): now only the default for new items.

### A1. Planner breakdown donut

- Replace the stacked bar in `PlannerFlow` with a Recharts donut (`PieChart` +
  `Pie` with `innerRadius`, one `Cell` per segment, `fill` from
  `FlowSegment.color`, which is already `chartColor(n)` = `var(--cat-n)`).
  Recharts is already a dependency and is re-exported from `src/lib/recharts.tsx`;
  copy the existing donut in `planner-results-content.tsx:80-115`. No inline
  `style` props (`§3.2`); colours go through the `fill` prop.
- Keep the legend list with amounts, percentages and the expandable details
  unchanged. The legend is the text equivalent of the chart.
- Accessibility: the chart wrapper has `role="img"` and an `aria-label` that
  summarises the split (for example "Take-home split: expenses 42%, savings 30%,
  investment 28%"). The label carries percentages only, never amounts, so it is
  safe when amounts are masked.
- The donut centre shows net take-home (masked). No tooltip is required; the
  legend carries the detail, which keeps it usable on touch.

### A2. Expense average of 12 months

`calcRecentAvgExpense(expenses, new Date(), 12)` at `salary-planner.tsx:126`.
Copy that names the window ("6 months") changes to 12. Only months in the window
that have data are averaged (unchanged helper behaviour).

### A3. Gross salary derived from the latest salary record

- Decision: the planner shows gross salary as a read-only display derived from
  the latest salary record (`salaryRecords[last].salary`), with a link to the
  Salary page. The editable input and the seed-once `useState(initialSalary)`
  (`salary-planner.tsx:163`) are removed; the input in
  `planner-inputs.tsx:47-59` becomes a display row. Scenarios remain the place
  for what-if salaries, so no temporary override with reset is added. Rationale:
  two sources of truth for salary is the same staleness problem fixed for
  expenses.
- Salary is derived on every render from the query data, so a new salary record
  updates the plan without a remount. With no salary record the plan shows 0 and
  prompts to add one on the Salary page.
- Saved scenarios keep their own stored salary and still load and compute
  identically.

### A4. Optional expense buffer

- A percentage (0 to 100, default 0) that adds a planning cushion on top of the
  expenses figure. It is not baked into the average and does not alter the
  override. When greater than 0 the planner shows its own line "Buffer N% · $X"
  (X = expenses figure times N%, masked), counted as part of expenses in
  `computeSalaryPlan`. At 0 nothing is shown and results are identical to today.
- Storage: `planner_settings` holds the other planner settings as plaintext
  columns (`household_horizon_months`, added at
  `supabase/migrations/20261106000176_household_planner_split.sql:39`), so the
  buffer follows suit. A new migration adds
  `planner_settings.expense_buffer_pct NUMERIC NOT NULL DEFAULT 0` with a 0 to
  100 check, idempotent and forward-only like the 176 S1 migration. The owner
  applies it. Matching edits: `PlannerSettingsData` (`assets/types.ts:52`),
  `plannerSettingsSchema` (`assets/schemas.ts:38`, optional so older payloads
  still validate), `PlannerSettingsValues` and the sheet
  (`planner-settings-sheet.tsx:20`), and the debounced save in
  `salary-planner.tsx`.
- Not stored per browser: unlike the expenses override it is a setting the owner
  expects on every device.

### A5. Per-goal and per-budget split

- Each household goal and each household spending budget carries its own split.
  Presets: 50/50, Custom % (my share, partner gets the rest), Just me (100/0),
  Just partner (0/100). The household-wide split (`PlannerSplit.members`)
  becomes only the default that pre-fills a new goal or budget; changing it later
  does not rewrite items that already have a split.
- Items where my share is 0% are excluded from my commitment (a share of 0
  contributes 0 and is listed under "excluded").
- What exists today:
  - Goal overrides: `PlannerSplit.goalOverrides`, keyed by goal id then member
    id (`household/types.ts:117-121`), validated by `plannerSplitSchema`
    (`schemas.ts:147-167`, cap `MAX_GOAL_OVERRIDES = 500` at `:134`), edited via
    `setPlannerSplit({ goalId, override })` (`schemas.ts:173-178`,
    `actions/planner-actions.ts:147`) and the UI in
    `household/components/goal-split-override.tsx` (used from
    `goal-editor-sheet.tsx`). `goalShare` reads the override, else the default
    (`lib/household-commitment.ts:59-68`).
  - Budgets have no override. All budgets share `defaultShare` as one
    `budgetShare` (`household-commitment.ts:130-133`), and `SpendingBudget` is
    `{ id, category, monthlyAmount }` (`household/types.ts:111`).
- Storage decision: no migration. The split is one encrypted JSON blob
  (`household_planner_settings.split`, ciphertext under `K_h`; migration
  `20261106000176_household_planner_split.sql:12-16`) validated only by Zod. Add
  `budgetOverrides: Record<budgetId, Record<memberId, number>>` to
  `PlannerSplit` and `plannerSplitSchema` (default `{}` so stored blobs without it
  still parse), extend `plannerSplitUpdateSchema` with `{ budgetId, override }`,
  extend `pruneOverrides` to drop overrides for deleted budgets, and extend
  `setPlannerSplit` to merge the budget key server-side like goal edits. Budget
  overrides count toward the same 500-entry cap.
- `computeHouseholdCommitment` computes each budget's share individually instead
  of one aggregate; the `budgets` output keeps `monthlyTotal` and `monthlyShare`
  as sums and adds a per-budget line list so the UI can show each. With no budget
  overrides the sums equal today's values.
- UI: extract a shared split-preset control from `goal-split-override.tsx`, used
  by the goal editor and by a new control on each budget row. Either member may
  edit (Q2). Both members see the same per-item split.
- Out of scope: income-proportional automatic split. It needs both salaries, and
  personal vaults are zero-knowledge, so the partner cannot read the owner's
  salary and the household space must not learn it (`§1.1`, `§5.1`). Members type
  the agreed percentage instead.
- Rationale: couples split costs 50/50, proportionally to income, or by
  yours/mine/ours, with hybrids that differ per category. A per-item choice
  covers all of these without the app needing income data.

### Constitution check (amendment)

- Satisfies: `§1.1`, `§2.1` (budget overrides stay inside the encrypted blob),
  `§2.3` (`setPlannerSplit` keeps `requireHouseholdContext()`), `§2.4`, `§2.5`
  (the donut is a client component under the existing planner boundary), `§3.1`
  and `§3.2` (Recharts already present; no inline styles; no new dependency),
  `§5.1`, `§5.1a`.
- Overrides: none. The only migration (`expense_buffer_pct`) is additive,
  idempotent and applied by the owner.

### Acceptance (amendment)

- [ ] Donut renders every non-zero segment with `chartColor` fills; legend, amounts, percentages and expansion unchanged; chart has an `aria-label`; masked amounts never appear in the chart or its label
- [ ] Expense average uses 12 full months and excludes the current month
- [ ] Gross salary tracks the latest salary record with no editable input; scenarios unchanged
- [ ] Buffer 0 gives output deep-equal to today's; N above 0 adds the "Buffer N% · $X" line and raises expenses by N%
- [ ] Each goal and budget can be set to 50/50, custom, just me or just partner; 0% share items are excluded; stored blobs without `budgetOverrides` still parse; a deleted budget's override is pruned
- [ ] With no budget overrides the commitment output equals today's
- [ ] Tests cover the new Zod fields, the server-side merge in `setPlannerSplit`, per-budget commitment and the buffer in `computeSalaryPlan`

### Open questions (amendment)

- [x] Q8: Keep gross salary as a what-if override with reset, or read-only? A: Read-only display linking to Salary. (owner, 2026-11-06, recommended default).
- [x] Q9: Buffer stored in the database or per browser? A: Database column `expense_buffer_pct`; the owner applies the migration. (owner, 2026-11-06, recommended default).
