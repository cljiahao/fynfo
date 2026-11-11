---
id: '184'
slug: freedom-projection
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-10
approved: 2026-11-11 # owner-authorized in chat 2026-11-11 ("Approve and land"), after review of commit 0290193
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # no PR (direct to main), set on shipped
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.4'
  - '§2.5'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§5.1'
  - '§5.4'
  - '§6.3'
constitution_overrides: []
---

# Spec 184: Freedom projection (when can the portfolio cover living costs)

Builds on spec 183 (household time-phased planner, shipped) for the household goal schedule and `budgetsMonthly`, and on specs 185 and 187 for the household plan as the planner now consumes it. Slice S1 does not use household code.

## Problem

Fynfo already tracks each step of the money chain separately: salary, expenses (with a 12-month average), household commitments, emergency fund and war chest, the monthly investing amount, and the invested portfolio. Nothing ties them together into the one question the owner is working towards: "at this pace, when can my portfolio cover my living costs?"

The owner wants a financial independence ("freedom") projection that runs income -> expenses -> household commitments -> safety savings -> monthly investing -> portfolio -> a projected date. It must be honest: a range, not a promise; every date shown beside the assumptions that produced it; and no advice on what to buy.

## Constitution check

- §1.1 and §5.1: the projection is personal-only. It reads personal data and renders only for the signed-in owner. The partner (household member) never receives it. Nothing here is written into household-scoped data. Sharing a progress percentage with the partner is out of scope (Q9).
- §2.1: amounts, tickers and salary are encrypted. The projection reads them only after the vault DEK is available (existing hooks) and computes client-side. The three stored assumptions are a percentage, a percentage and a calendar year, not amounts, and are stored plaintext on `planner_settings`, exactly like `tithe_pct` and `expense_buffer_pct`. §2.1 does not list percentages as encrypted.
- §5.4: no SQL ever filters or aggregates encrypted columns. The new columns are plaintext numbers that nothing queries; all maths is in TypeScript.
- §6.3: the migration is forward-only, additive and idempotent (`ADD COLUMN IF NOT EXISTS`, constraints in a guarded DO block). No data is rewritten.
- §2.4: the Overview page composes features; the card lives in `src/features/assets/components/` and is imported through the assets barrel.
- §2.5: Server Components by default. The card and detail use `'use client'` because they read client-only state (`useAmountVisibility`, planner values, TanStack Query hooks). Justification matches the existing `SalaryPlanner`, which already owns that data.
- §3.1 and §3.2: no new dependency. If a chart is wanted, Recharts is already installed (see Solution shape, UI).
- §4.1 and §4.2: all five gates, with tests for every pure branch.

No SOFT override is requested.

## Current behaviour (verified)

Planner and income:

- `src/features/assets/lib/salary-plan.ts` `computeSalaryPlan` (:119-216) derives `netAfterCpf = salary * 0.8` (:139), `bufferAmt = expenses * bufferInputPct / 100` (:137), `insurancePct = 0.05` (:142), `emergencyFundGoal` and `warChestGoal` rounded up to thousands (:146-147), `goalsNeeded` and `goalsFunded = currentSavings + currentBonds` (:176-177), a 9-month spread of the remaining shortfall (:179-184), `investmentAmt = netAfterCpf * investmentPct` (:207), `savingsAmt` (:204), `householdAmt` (:211) and `householdShortfallAmt` (:212). Inputs are `SalaryPlanInput` (:66-83); output is `SalaryPlan` (:85-111).
- `calcRecentAvgExpense(expenses, now, months = 12)` (:38-64) returns `{average, monthsUsed}`. It excludes the current month and counts only the user's own share of shared expenses.
- `householdMonthlyDeduction` is the planner's single household input. `SalaryPlanInput.householdReserve` (:80) is accepted for old scenario payloads and ignored; there is no `investmentPaused`.

Planner UI:

- `src/features/assets/components/salary-planner.tsx`: `PlannerValues` (:58-64: `investmentAmount`, `emergencyFundGoal`, `warChestGoal`, `householdEarmark`, `expenses`) is the existing bridge to the dashboard. Salary comes from `latestSalary?.recurring` (:136, passed at :154). `expenses = expensesOverride ?? averageExpenses`, where `averageExpenses = Math.round(recentAvg.average)` (:187-190); the override lives in localStorage key `fynfo:planner-expenses-override` (`use-expenses-override.ts:5`). Settings state is at :192-200 with an 800 ms debounced autosave (:212-256). `useHouseholdPlan()` is called at :258 and the plan is computed only when its input `state === 'ready'`. Savings and bonds sums are at :268-271. `surplus = derivePersonalSurplus(...) ?? 0` (:288-294, from `lib/personal-surplus.ts`) feeds `computeHouseholdPlan(readyInput, { surplus, now })` (:295-297), `householdMonthlyDeduction = householdPlan.monthly` (goals plus budgets, :298), and `computeSalaryPlan({ ...planBase, householdMonthlyDeduction })` (:300). `householdEarmark = householdPlan.surplusUsed` (:302) is the spare savings the household plan already counts on. The `onPlannerValuesChange` effect is at :312-328.
- `householdMonthlyDeduction` mixes goal set-asides and budgets in one number. Living cost needs the budgets share on its own, which `HouseholdPlan.budgetsMonthly` provides (`src/features/household/lib/household-plan.ts`: `HouseholdPlan` :61-70, `computeHouseholdPlan` :186-249; `monthly = goalsMonthly + budgetsMonthly`).
- `computeHouseholdPlan(input, { surplus, now })` offsets the caller's goal schedule by `surplus` (savings above emergency fund and war chest, treated as already set aside). `ScheduleEntry.amount` is the caller's share after that offset and `surplusUsed` is the part consumed. The planner and the household page both read the plan input through `useHouseholdPlan` (`@/features/household`), whose `HouseholdPlanInput.state` is `'none' | 'locked' | 'ready'`.
- `src/app/dashboard/(overview)/dashboard-overview.tsx`: the Overview tab renders `LatestRecords` then `SalaryPlanner` (:116-142) and passes `snapshot={latest}` and `onPlannerValuesChange={handlePlannerValuesChange}` (:138-142). `DividendSummary monthlyExpenses={plannerValues.expenses}` (:173) and `InvestmentBreakdown householdEarmark={plannerValues.householdEarmark}` (:162-166) are on the Investments tab, which is the precedent for handing planner values to another card.

Portfolio:

- `src/features/assets/types.ts`: `AssetCategory` is `savings | bonds | stocks | etf | non_equity | crypto | pension` (:1-8); `SnapshotData` is `{id: 'YYYY-MM', entries: [{category, account, amount}]}` (:16-20).
- `src/features/assets/constants.ts` `INVESTMENT_CATEGORIES` = stocks, etf, non_equity, crypto (:38-43). `src/features/assets/hooks/use-chart-data.ts:48-51` sets `total_investment = sumByCategories(entries, INVESTMENT_CATEGORIES)`.
- `src/features/assets/lib/investment-math.ts`: `computeMarketEquity` (:75-104) values live equity from trades, returning null when prices or FX are missing. `computeInvestmentBreakdown` (:174-259) works out quarterly budgets and `totalDeployable = floorH(max(0, fromSavings + bondsSurplus - householdEarmark))` (:203-205); the household earmark is spare savings already set aside for shared goals and is not deployable. RSP is only a monthly allocation ratio there; no RSP balance exists in code.
- `src/features/assets/components/investment-breakdown.tsx`: equity market value comes from trades (`computeHoldings`, `useStockPrices`, `useExchangeRate`, :65-72); `currentSavings` and `currentBonds` come from the snapshot (:120-121); it receives `householdEarmark` (:45, :57).
- `src/features/assets/components/category-breakdown-content.tsx`: `CPF_ACCOUNTS = ['OA','SA','MA','SRS']` (:44) read from the `pension` category (:67-72). Those snapshot entries are the only CPF balances in the app.
- `src/features/salary/lib/cpf-estimate.ts` and `tax-cpf.ts` model employee contributions and tax (`calculateMonthlyCpf` :84, `calculateAnnualCpf` :93). There is no CPF balance projection and no payout code.

Dividends:

- `src/features/equity/lib/dividend-breakdown.ts`: `averageMonthlyTTM(ttm) = ttm / 12` (:88-90); `expenseCoverage(avgMonthly, monthlyExpenses)` (:185-198) returns a fraction, or null when expenses are not positive and finite. `dividend-summary.tsx` takes `monthlyExpenses` (:32) and computes `coverage` at :102-103 from `dividendSummary(...).trailing12m` (:93).

Settings storage and scenarios:

- `src/features/assets/schemas.ts`: `plannerSettingsSchema` (:38-48; `householdHorizonMonths`, retired from the planner but still accepted so older exports import, and `expenseBufferPct` optional); `scenarioInputsSchema` is a strictObject (:51-64) with salary, expenses, months, tithe, allowance, currentSavings, currentBonds, optional `householdMonthlyDeduction` and the ignored optional `householdReserve`. It has no `expenseBufferPct` and no portfolio.
- `src/features/assets/actions/planner-actions.ts`: `getPlannerSettings` (:21-57) and `upsertPlannerSettings` (:59-95). A missing-column error (`isMissingColumn`, code 42703, :15-19, :30-36, :88-92) falls back to the old column set, and optional fields are omitted from the upsert when undefined so an autosave never resets them (:74-77, :81-84).
- `src/features/assets/components/scenario-dialog.tsx` calls `computeSalaryPlan(payload.inputs)` (:79) and masks amounts with `useAmountVisibility` (:42); `scenario-actions.ts:39` also runs it to reject non-finite plans. `planning-scenarios.tsx` is the list and save UI.
- Migrations: `supabase/migrations/20260411150000_init.sql` creates `planner_settings` (:21-32) with own-row RLS policies (:136-140). `20261106120000_planner_expense_buffer.sql` is the precedent for `ADD COLUMN IF NOT EXISTS` plus a DO-block CHECK; `20261106000176_household_planner_split.sql:39` adds `household_horizon_months`.
- `src/features/profile/lib/export-validation.ts:131-139`: the planner strictObject. `src/features/profile/lib/export-data.ts:28` includes `plannerSettings: PlannerSettingsData | null`, so the export carries planner settings and the validator must accept any new field (optional).

Privacy and glance:

- `useAmountVisibility` (`src/features/privacy/components/amount-visibility-provider.tsx:96`) returns `{hidden, mask, canReveal, getHideEpoch, showAmounts, hideAmounts}` (`AmountVisibility`, :15-22).
- `src/features/overview/lib/glance.ts` (`snapshotGlance` :56-71, `salaryGlance`, `spendingGlance`) has no goal or projection logic.

## Solution shape

### Terms and the model

Let:

- `P` = invested portfolio today (defined below).
- `F` = freedom number = `annualCost / w`, with `w` the withdrawal rate as a fraction.
- `r` = annual real effective return as a fraction; `r_m = (1 + r)^(1/12) - 1`.
- `c_t` = amount invested in month `t` (month 1 is the month after `now`).

Compounding, month by month, contribution at month end:

```
B_0 = P
B_t = B_(t-1) * (1 + r_m) + c_t
```

The projected month is the first `t` with `B_t >= F`, reported as a calendar month (`now` plus `t` months). If `P >= F` it is `t = 0` ("already reached"). The loop is bounded at `capMonths = 720` (60 years). If `B_720 < F` the result is `null`, which means "not reached within 60 years" and is shown as exactly that, never as a date.

All figures are in today's money: `r` is a real return, income and costs are held flat (no raises, no inflation steps), and there are no taxes. This is stated on the card.

The model deliberately omits: raises, one-off windfalls, CPF payouts, tax, sequence-of-returns risk and the cost of selling. It projects "what the owner's own assumptions imply", nothing more.

### Inputs: where every number comes from

1. Invested portfolio today `P`. The sum of the latest snapshot's entries in `INVESTMENT_CATEGORIES`: stocks + etf + non_equity + crypto. This is the same total the chart already shows as `total_investment` (`use-chart-data.ts:48-51`). Excluded on purpose:
   - `savings` and `bonds`: they hold the emergency fund and war chest and are not available to invest. Their deployable surplus is a lever, not part of `P`.
   - `pension` (CPF OA/SA/MA and SRS): locked until withdrawal age; see CPF below.
   - Live equity market value from trades (`computeMarketEquity`) is NOT added on top: it describes the same holdings as the snapshot and adding both would double count. The snapshot is the single source (Q7).
   - RSP: there is no RSP balance in code, only a monthly ratio. RSP holdings count only when the owner records them in a snapshot entry (typically `etf`).
2. Annual living cost `annualCost = 12 * (expenses + bufferAmt + budgetsMonthly)`, where:
   - `expenses` is the planner's existing figure (override or 12-month average, `salary-planner.tsx:187-190`);
   - `bufferAmt = expenses * bufferPct / 100` (`salary-plan.ts:137`);
   - `budgetsMonthly` is the caller's monthly share of household budgets, from `computeHouseholdPlan(...).budgetsMonthly`. It is separate from goal set-asides because budgets are recurring living costs and goals are finite.
   - Insurance, tithe and allowance are excluded from living cost by default (Q5); the assumptions line says so.
3. Monthly investing, `c_t`. Today's `investmentAmt` from `computeSalaryPlan` (`salary-plan.ts:207`), plus optional release of safety savings once the emergency fund and war chest are fully funded (`savingsAmt` joins investing from the month the goals are funded; `savingsAmt` is `:204`). Over time, household goals change it:
   - the caller passes `householdGoalsMonthlyByYear`, a list where element `k` is the caller's average monthly goal set-aside during future year `k` (`k = 0` is the next 12 months, months 12k to 12k+11 after `now`). It comes from the schedule walk below, run on the plan the planner already computes (one `computeHouseholdPlan` call with the planner's own `surplus` and `now`, never called again per year). Years after the last funded month are missing and read as 0;
   - investing in year `k` = `max(0, investmentToday + goalsToday - (householdGoalsMonthlyByYear[k] ?? 0))`, where `goalsToday` is the current `HouseholdPlan.goalsMonthly`. In projection month `t` (month 1 is the month after `now`) the year index is `floor((t - 1) / 12)`;
   - budgets stay flat and are already inside `annualCost`;
   - year 0 can differ from today's figure because it is a year average (the walk's pace only falls over time); the detail table says "average over the year".

### Household goals series (schedule walk)

`householdGoalsMonthlyByYear` is a pure function of the plan the planner already has. It does not call `computeHouseholdPlan` again: re-running the planner with an advanced `now` is not valid, because overdue entries would count as one month instead of dropping out (`household-plan.ts:171`, `goal-stats.ts:16-19`), `placeGoal` uses today's `remaining` that later contributions would have reduced (`:104-107`), and the surplus offset would be applied again on every call (`:205-216`).

Helper: `householdGoalsSeries(plan, now, capMonths = 720)` with `plan: Pick<HouseholdPlan, 'schedule' | 'goalsMonthly' | 'bindingMonths'>`, returning `{ monthly: number[]; byYear: number[] }`. It lives in the household slice, new file `src/features/household/lib/household-goal-series.ts`, exported from the household barrel (`@/features/household`). Reason: it must share the plan's schedule semantics and `monthsUntil` (`goal-stats.ts:16-23`), and keeping it there leaves the freedom lib free of household code (S1 stays independent of spec 183). It needs no change to `computeHouseholdPlan` and no export of `tightestDeadline`: it re-states the same rule in six lines over integer month counts from `monthsUntil`, and a test pins segment 1 to `plan.goalsMonthly` and `plan.bindingMonths`.

Walk (`schedule` is the post-offset schedule, date ascending, so the surplus is already applied once):

1. Let `m(e) = monthsUntil(e.date, now) ?? 1`: whole months from today to the date, partial months rounded up, overdue and this-month dates counting as one month, exactly as `tightestDeadline` counts them. `m` never decreases down the schedule.
2. Segment 1 runs from `now` at pace `plan.goalsMonthly` for `plan.bindingMonths` months (call it `M1`). At its end every entry with `m(e) <= M1` is fully funded: for each such deadline `cumulative <= pace * m`, and at the binding deadline it is equal, so nothing spills into later entries.
3. Drop those entries. For the remaining entries restart `cumulative` at 0 and measure months from the end of the previous segment as `m(e) - M1`, an integer subtraction, so no calendar re-measuring (month-end clamping cannot shift a boundary). Next pace = max over deadline dates of `cumulative / (m(e) - M1)`, taking the last entry of each date; the binding months are the months at the first date reaching that maximum. That gives the next segment's pace and length. Paces never rise from one segment to the next.
4. Repeat until no entries remain. After that the pace is 0.
5. `monthly[j]` is the pace in month `j` after `now` (`j = 0` is the first month). `byYear[k]` is the sum of `monthly[12k .. 12k+11]` divided by 12, so a partial last year averages in zeros. `monthly` stops after the last funded month and is truncated at `capMonths`. An empty schedule, `goalsMonthly` of 0 or a null `bindingMonths` returns empty arrays.

Rounding consequence: months are whole, partial months round up, so a deadline 2.2 months away is paid over 3 months and a segment ends up to just under a month after the real date. This is the same rounding the planner uses, so month 0 matches what the planner shows. Undated goals are not in the schedule and contribute nothing. Budgets are not in the series (they stay in `budgetsMonthly` and inside `annualCost`).

Invariants (each has a test): `monthly[0]` equals `plan.goalsMonthly`; the sum of `monthly` equals the sum of schedule amounts (uncapped); `monthly` is non-increasing; the surplus is applied once because only the single plan call applies it.

Hand example (surplus 0, `now` 2026-01-15): entries A 2026-04-15 amount 600 (`m = 3`), B 2026-07-15 amount 300 (`m = 6`), C 2028-01-15 amount 900 (`m = 24`). Plan: 600/3 = 200, 900/6 = 150, 1,800/24 = 75, so `goalsMonthly = 200`, `bindingMonths = 3`.

- Segment 1: 3 months at 200 (funds A, 600).
- Segment 2: B and C remain, months 3 and 21. 300/3 = 100, 1,200/21 is about 57, so pace 100 for 3 months (funds B, 300).
- Segment 3: C remains, `24 - 6 = 18` months, 900/18 = 50 for 18 months (funds C).
- `monthly` = 200, 200, 200, 100, 100, 100, then 50 for 18 months (24 months in all); sum 1,800 = 600 + 300 + 900.
- `byYear` = [100, 50]: year 0 is (600 + 300 + 6 _ 50) / 12 = 100, year 1 is 12 _ 50 / 12 = 50; year 2 onwards is missing, read as 0.

4. Savings rate = `(investmentAmt + savingsAmt) / netAfterCpf`, shown as a percentage. Household goal set-asides are not counted as saving in this definition (they are a commitment, not a freedom contribution). Null when `netAfterCpf` is not positive.
5. Dividend coverage = `expenseCoverage(averageMonthlyTTM(ttm), annualCost / 12)` from `@/features/equity` (a fraction, displayed as a percentage). `ttm` is `dividendSummary(...).trailing12m`, as in `dividend-summary.tsx:103`. It uses full living cost, so it can differ from the Dividend summary card's expenses-only figure; the caption says "of living cost". It is informational and never added to the projection (the portfolio's return already includes distributions).

### Assumptions are the owner's own settings

Three owner-entered settings, shown beside every date and number:

- `realReturnPct` (annual, real; for example 4 means 4 percent);
- `withdrawalRatePct` (for example 4 means 4 percent);
- `targetYear` (optional; when set the card also says whether the base case reaches freedom by that year).

There is no pre-filled value: until the owner enters return and withdrawal rate the card shows the invitation "Add your return and withdrawal assumptions to see a projection" and nothing else is computed. Validation bounds (Q1-Q3): return 0 to 12 percent, withdrawal rate 1 to 10 percent, target year from the current year to current year + 60.

Range, never a promise: the function computes three runs, `low = max(0, r - spread)`, `base = r`, `high = r + spread`, with `spread = 2` percentage points (Q10). The headline always reads as a range ("2041 to 2046", low to high), the base case sits inside, and a one-line caption reads: "Projection from your own assumptions, not a forecast or advice."

The app does not recommend securities, funds, platforms or allocations anywhere in this feature. Levers talk about amounts, months and dates only. Figures are projections from user-entered assumptions and are labelled so.

### CPF

Excluded from `P` by default. Excluded from the freedom number's coverage. If the latest snapshot has `pension` entries, the detail shows a separate read-only line "CPF (locked): $X" (masked), with the note that it is not counted. No CPF growth, no CPF Life payout, no withdrawal-age logic (out of scope). There is no include toggle (Q4).

### Pure function: `projectFreedom`

New file `src/features/assets/lib/freedom-projection.ts`, no I/O, `now` passed in:

```ts
interface FreedomInput {
  now: Date;
  portfolio: number; // P
  annualCost: number;
  withdrawalRatePct: number | null;
  realReturnPct: number | null;
  returnSpreadPct: number; // default 2
  targetYear: number | null;
  monthlyInvesting: number; // investing today
  safetyRelease: { monthly: number; fromMonth: number } | null;
  householdGoalsToday: number; // goalsMonthly now
  householdGoalsMonthlyByYear: number[]; // see Inputs, item 3
  netMonthlyIncome: number | null; // netAfterCpf, for savings rate
  savingsMonthly: number; // for savings rate
  dividendAvgMonthly: number | null; // averageMonthlyTTM(ttm)
  capMonths?: number; // default 720
}

interface FreedomRun {
  months: number | null; // null = not reached within the cap
  date: string | null; // YYYY-MM
  reached: boolean; // portfolio already >= freedom number
}

interface FreedomProjection {
  status: 'ok' | 'no_assumptions' | 'no_expenses' | 'no_portfolio' | 'invalid';
  freedomNumber: number | null;
  progressPct: number | null; // P / F * 100, capped at 100
  low: FreedomRun;
  base: FreedomRun;
  high: FreedomRun;
  onTrackForTarget: boolean | null;
  savingsRatePct: number | null;
  dividendCoveragePct: number | null; // expenseCoverage(...) * 100
  householdMovesMonths: number | null; // base with goals minus base without
  yearly: { year: number; invested: number; endBalance: number }[]; // base case
}
```

Rules:

- `status` is `no_assumptions` when return or withdrawal rate is null; `no_expenses` when `annualCost` is not positive and finite; `invalid` for non-finite inputs or `withdrawalRatePct <= 0`. `no_portfolio` is not a hard stop: with `P = 0` the projection still runs (everything comes from contributions) but the UI states "No invested portfolio yet", and the status is only used for copy.
- `householdMovesMonths` = base months with the goal schedule minus base months with goals removed (investing = `monthlyInvesting + householdGoalsToday` for all years). Positive = household goals delay freedom by that many months. Null if either run is not reached.
- `yearly` lists base-case invested amount and end-of-year balance per year, up to the reached year (or the cap), for the detail table.
- Monotonic: `low.months >= base.months >= high.months` when all reached; a non-reached run is treated as larger than any reached run.
- Zero or negative investing with `P < F` never reaches: `months = null`.

### Worked example (hand-computable, `r = 0`)

`annualCost = 36,000`, `w = 4%`, so `F = 36,000 / 0.04 = 900,000`. `P = 180,000`, so progress = 20%.

- Flat investing 3,000 a month: `(900,000 - 180,000) / 3,000 = 240` months (20 years).
- Household goals: investing today is 2,000 a month and `householdGoalsToday` is 1,000, with the goals ending after 24 months, so investing is 2,000 for 24 months and 3,000 after (2,000 + 1,000 released). After 24 months the balance is `180,000 + 24 * 2,000 = 228,000`; remaining `672,000 / 3,000 = 224`; total 248 months. Goals move the date by `248 - 240 = 8` months versus the goals-removed run (investing 3,000 throughout). In series terms `householdGoalsMonthlyByYear = [1,000, 1,000]`: year 0 and year 1 are 2,000 investing, year 2 onwards reads as 0 and gives 3,000. The emergency-surplus lever does not enter this example; it changes `monthlyInvesting` only when the owner acts on it.
- Flat investing 2,000 forever (no household change): `720,000 / 2,000 = 360` months (30 years).

Compounding table for the test (`P = 0`, `c = 100`, annual return chosen so `r_m = 1%`, that is `r = 1.01^12 - 1`):

| month | balance  |
| ----- | -------- |
| 1     | 100      |
| 2     | 201      |
| 3     | 303.01   |
| 4     | 406.0401 |

### Levers: `computeFreedomLevers`

Pure, rule-based, no AI, same pattern as the household recommendations (`householdRecommendations`): typed items, a copy formatter in the UI slice (`formatLever`), at most 3 shown with the rest behind "Show all". No asset, fund or platform is ever named. Defined in `freedom-projection.ts` (or a sibling `freedom-levers.ts` if it grows) as `computeFreedomLevers(input: FreedomInput, context: LeverContext)` and run only when `status === 'ok'` and `base.months !== null` unless stated. The caller builds `LeverContext` from planner values and the household plan.

```ts
interface LeverContext {
  /** savings + bonds - emergencyFundGoal - warChestGoal - householdEarmark, before the 1,000 floor. */
  surplusAfterEarmark: number;
  /** From calcRecentAvgExpense versus the planner expenses; null when not computable. */
  expenseDriftPct: number | null;
  /** One entry per household goal in the plan schedule, soonest end first; empty when household is unavailable. */
  householdGoalEnds: {
    goalId: string;
    name: string;
    endMonth: string;
    extraInvesting: number;
  }[];
}

type FreedomLever =
  | { kind: 'extra-monthly'; amount: number; monthsEarlier: number }
  | { kind: 'expense-drift'; driftPct: number; monthsLater: number }
  | { kind: 'emergency-surplus'; amount: number }
  | {
      kind: 'household-goal-ends';
      goalId: string;
      name: string;
      endMonth: string;
      extraInvesting: number;
    };
```

Triggers and copy (ordered by months moved, then as listed; at most 3 shown):

1. `extra-monthly`: always when `base.months > 0` and the base run is reached. The step is the larger of 100 and 10 percent of `monthlyInvesting`, rounded to 50. `monthsEarlier = base.months - months(base with monthlyInvesting + step)`; shown only if `monthsEarlier >= 1`. Copy: "Investing $X more a month brings your date forward N months."
2. `expense-drift`: when the latest completed month, or the 12-month average used by the planner, is more than 10 percent above the 12-month figure it is compared against (`calcRecentAvgExpense` average versus the planner `expenses` when an override is set; if no override is set, compare the most recent completed month with the 12-month average). `driftPct` is whole percent. `monthsLater` = months(base with `annualCost` scaled by the drift on the expenses portion) minus `base.months`, shown only if `>= 1`. Copy: "Spending is N% above your 12-month average. If it stays there, your date moves back M months." This lever needs a recent month and `monthsUsed >= 3`.
3. `emergency-surplus`: when `surplusAfterEarmark` (`savings + bonds - emergencyFundGoal - warChestGoal - PlannerValues.householdEarmark`, the same deployable surplus `computeInvestmentBreakdown` computes at `investment-math.ts:203-205`) is at least 1,000. `amount` = `surplusAfterEarmark` rounded down to the nearest 100. Copy: "Your emergency fund is $X above target, available to invest if you choose." It does not say where to invest.
4. `household-goal-ends`: for each household goal in the household plan's schedule whose last entry date falls within the next 60 months, `endMonth` is that date's month and `extraInvesting` = that goal's own `GoalPlan.monthly` (floored at 0), an estimate for that goal alone rather than the drop in the series. The goal name comes from the plan input's goals by `goalId` (schedule labels are item names). Copy: "Household goal <name> ends in <Month Year>; your investing rises by $X a month after." The goal name and the amount go through `mask()`, like every household goal name (spec 187:`CopyOptions.maskName`in`src/features/household/lib/household-recommendation-copy.ts:10`, `:30`, applied by `household-recommendations.tsx:35`). One lever per goal, soonest first. Needs household state `'ready'` and a non-empty schedule.

If no lever triggers, the section is hidden (not an empty heading).

### Scenarios

Saved scenarios (`scenario-dialog.tsx`) show their own projected freedom date, read-only, computed by the same `projectFreedom` from `computeSalaryPlan(payload.inputs)`:

- Basis, labelled "scenario basis": scenario `expenses * 12` (no buffer, because `scenarioInputsSchema` has no `expenseBufferPct`), flat investing from the scenario's `investmentAmt`, no household schedule (the scenario carries one combined `householdMonthlyDeduction`, so it stays inside the flat figure and goal timing is not modelled), the live portfolio, and the live assumptions.
- The scenario date never changes stored scenarios and adds no field to `scenarioInputsSchema`.
- Shown only when assumptions are set (Q8).

### Storage

Choice: three plaintext nullable columns on the existing `planner_settings` row (one row per user, own-row RLS already in `20260411150000_init.sql:136-140`):

- `freedom_real_return_pct NUMERIC`;
- `freedom_withdrawal_rate_pct NUMERIC`;
- `freedom_target_year INTEGER`.

No default, so `NULL` means "unset". CHECK constraints (return 0 to 12, withdrawal rate 1 to 10, year 2000 to 2200) are added in a guarded DO block so re-running is a no-op. Rejected: a new table (more RLS for three values), browser localStorage (does not follow the owner across devices), encrypted payload (the values are not amounts and would add a decrypt step for no gain).

Migration file: `supabase/migrations/20261110000184_planner_freedom_assumptions.sql`, additive and idempotent, modelled on `20261106120000_planner_expense_buffer.sql`. The owner applies it to the live database before the code that writes the columns lands (slice order below). `getPlannerSettings` and `upsertPlannerSettings` extend the existing missing-column fallback (`planner-actions.ts:15-19`): if the columns are absent the app still builds and runs, assumptions simply do not persist and the card asks again. The freedom fields are optional in `plannerSettingsSchema` and omitted from the upsert when undefined, so the 800 ms autosave never resets them (same pattern as :74-77, :81-84). `export-validation.ts:131-139` gains the three fields as optional so exports and imports round-trip; `PlannerSettingsData` (`types.ts:52-63`) gains the three optional fields.

### UI

One card, "Freedom", in the Overview tab after `SalaryPlanner` in `dashboard-overview.tsx`. It receives its numbers by extending `PlannerValues` additively through the existing bridge (`salary-planner.tsx:58-64`, effect :312-328), which already carries `expenses` and `householdEarmark`: `savingsAmt`, `netAfterCpf`, `budgetsMonthly`, `bufferAmt`, `goalsMonthly`, `householdGoalsMonthlyByYear`, and the household goal ends for the levers (name, end month, `GoalPlan.monthly`); the card builds `LeverContext` from these plus the snapshot and `householdEarmark`. This mirrors `DividendSummary monthlyExpenses={plannerValues.expenses}`. The card gets the portfolio from the latest snapshot (the `latest` snapshot `dashboard-overview.tsx` already passes to `SalaryPlanner`) and dividend TTM from `@/features/equity`.

Collapsed state: one number and one sentence, for example "34% of the way. On track for 2041 to 2046." The number is the progress percentage; the sentence is the low-to-high date range. One tap opens detail (disclosure inside the same client component; no navigation):

1. Assumptions: return, withdrawal rate, target year as inputs with the "your assumption" helper and the disclaimer line. Editing saves through the planner settings action.
2. Range: low, base and high dates; freedom number; invested portfolio today; "CPF (locked)" line when present; whether the base case reaches the target year.
3. Per-year investing table from `yearly` (year, average monthly investing, end balance), at most 60 rows, scrolls inside its own container at 375 px.
4. "Household goals move your date by N months" line, savings rate, dividend coverage "of living cost".
5. Levers section (max 3, "Show all").

Masking: amounts go through `mask(formatSGD(...))`: freedom number, portfolio, CPF, per-year investing and balances, lever amounts. Percentages and years are NOT masked by default (progress, savings rate, dividend coverage, projected dates, target year); they are not currency amounts. The tradeoff (a percentage plus a visible date can let an onlooker infer scale) was accepted in Q6. When amounts are hidden the sentence still renders, with masked amounts as "\*\*\*"-style placeholders where needed. Editing assumptions requires `canReveal()`, matching how `InvestmentBreakdown` guards edits.

Chart: none in v1. A single number, a sentence and a table answer the question; a chart would add visual weight on a 375 px phone for no extra information. If the owner later wants one, a Recharts area chart of the base-case balance against `F` uses the already installed Recharts (§3.2) and existing `--chart-*` tokens.

Layout: single-column, 16 px gutters, no fixed widths over 100 percent, works at 375 px with no horizontal page scroll; only existing design tokens (`text-muted-foreground`, `bg-card`, `--gain`, `--warning`), so dark mode comes for free. No new dependency.

### States

| State                              | Behaviour                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No salary                          | Projection still runs from entered investing and portfolio; savings rate is hidden (null). Copy: "Add a salary to see a savings rate."                                                                                                                                                                                                          |
| No expenses (annual cost 0)        | `no_expenses`: card says "Add expenses to set a freedom number." No date.                                                                                                                                                                                                                                                                       |
| No portfolio                       | Runs with `P = 0`; the sentence leads with "No invested portfolio yet." and the date comes from contributions.                                                                                                                                                                                                                                  |
| No assumptions                     | `no_assumptions`: invitation to add return and withdrawal rate; no numbers.                                                                                                                                                                                                                                                                     |
| Household locked / unavailable     | `HouseholdPlanInput.state` of `'none'` or `'locked'`, and the household plan query loading or in error, all mean zero household contribution: `householdGoalsMonthlyByYear` is empty, `budgetsMonthly` and `goalsMonthly` are 0, no household lever. The card still renders; the detail says "Household goals not included". No error is shown. |
| Amounts hidden                     | Amounts masked; percentages and years visible (Q6); assumption editing blocked until revealed.                                                                                                                                                                                                                                                  |
| Not reached within cap             | Sentence reads "Not reached within 60 years at this pace." No date.                                                                                                                                                                                                                                                                             |
| Already reached                    | Sentence reads "Your portfolio already covers your living costs at your assumptions." Date line shows the current month.                                                                                                                                                                                                                        |
| Missing column (migration pending) | Assumptions do not persist; the card still works for the session.                                                                                                                                                                                                                                                                               |

### Privacy

Personal only. The card never renders for the household view and no household action or table receives any freedom value. The partner learns nothing from this feature (§1.1, §5.1). A later opt-in to share the progress percentage with the partner would touch the household trust boundary, so it is out of scope and would need its own governance spec (Q9).

## Slices

Order: S1, then S2, then S3. Each slice is green on all five gates alone. S2's migration must be applied by the owner before S2's code is deployed. S3 uses `computeHouseholdPlan` (`src/features/household/lib/household-plan.ts`), `getHouseholdPlanInput` (`actions/plan-actions.ts`) and `useHouseholdPlan` (`hooks/use-household-plan.ts`), imported from `@/features/household`, plus the new `householdGoalsSeries` helper (additive export, no change to existing household behaviour).

### S1. Pure maths and levers (new files only)

- `src/features/assets/lib/freedom-projection.ts`: `projectFreedom`, `computeFreedomLevers`, types.
- `src/features/assets/lib/__tests__/freedom-projection.test.ts` (or the colocated pattern the repo already uses for `salary-plan` tests).
- `src/features/assets/index.ts`: export the new functions and types.

No behaviour change anywhere. This slice does not depend on 183.

### S2. Settings and migration

- `supabase/migrations/20261110000184_planner_freedom_assumptions.sql` (owner applies first).
- `src/features/assets/types.ts`: `PlannerSettingsData` optional fields.
- `src/features/assets/schemas.ts`: `plannerSettingsSchema` optional fields with bounds.
- `src/features/assets/actions/planner-actions.ts`: read, upsert and missing-column fallback.
- `src/features/profile/lib/export-validation.ts`: optional fields in the planner strictObject.
- Tests: schema bounds, action omit-when-undefined, export validation round trip.

### S3. UI

- `src/features/household/lib/household-goal-series.ts` (new, `householdGoalsSeries`), its test under `src/features/household/lib/__tests__/`, and one additive export line in `src/features/household/index.ts`.
- `src/features/assets/components/freedom-card.tsx` (card, detail, assumptions form, `formatLever`).
- `src/features/assets/components/salary-planner.tsx`: extend `PlannerValues` and the `onPlannerValuesChange` effect; call `householdGoalsSeries(householdPlan, now)` on the plan it already computes (`:295-297`) and publish `byYear` as `householdGoalsMonthlyByYear` (empty unless the household input state is `'ready'`).
- `src/app/dashboard/(overview)/dashboard-overview.tsx`: render the card after `SalaryPlanner`, pass planner values and snapshot.
- `src/features/assets/components/scenario-dialog.tsx`: read-only projected date per scenario.
- `src/features/assets/hooks/use-freedom-inputs.ts`: assembles inputs (portfolio, dividend TTM, and the household series and lever context from `PlannerValues`).
- Tests: component states, masking, scenario date.

## Tests to add

S1 (`freedom-projection.test.ts`):

- Compounding versus a hand-computed table: `P = 0`, `c = 100`, `r_m = 1%` gives balances 100, 201, 303.01, 406.0401 for months 1 to 4; plus the month count for a small target computed by hand.
- Zero-return worked example: `F = 900,000`, `P = 180,000`, flat 3,000 gives 240 months; 2,000 flat gives 360.
- Range ordering: `low.months >= base.months >= high.months`; a non-reached low run sorts after a reached base run.
- Household schedule moves the date: the 24-month example gives 248 versus 240 and `householdMovesMonths = 8`; schedule that ends sooner moves the date less.
- Zero investing never reaches: `months = null`, `date = null`.
- Already reached: `P >= F` gives `months = 0`, `reached = true`.
- Cap: investing so small that 720 months is not enough returns null, and a run needing exactly 720 months reports a date.
- `projectFreedom` statuses: no assumptions, no expenses, invalid input, withdrawal rate 0.
- Savings rate and dividend coverage: coverage equals `expenseCoverage(...) * 100`; null netAfterCpf gives null savings rate.
- Levers per kind: `extra-monthly` months moved, `expense-drift` at 10 percent threshold (below does not fire), `emergency-surplus` at the 1,000 threshold measured net of the household earmark (savings + bonds 3,000 above the funds' targets with earmark 2,500 gives net 500 and does not fire; earmark 1,500 gives net 1,500 and amount 1,500; earmark 1,410 gives net 1,590 and amount 1,500; earmark above the surplus does not fire), `household-goal-ends` ordering and the 60-month window; max-3 trimming order; no lever when nothing triggers; no asset name appears in any lever; `household-goal-ends` copy passes the goal name through the supplied mask function (a masking stub is applied to the name and amount).
- Household unavailable: state `'none'`, state `'locked'`, query loading and query error each produce an empty `householdGoalsMonthlyByYear`, zero household budgets and goals, and a projection equal to the one with no household goals.
- `now` is passed in (no `Date.now()`): the same input at two `now` values shifts only the dates.

S3 household helper (`src/features/household/lib/__tests__/household-goal-series.test.ts`):

- Hand example: the three-entry example gives `monthly` 200 x3, 100 x3, 50 x18 and `byYear` [100, 50].
- Month 0 equals `plan.goalsMonthly` and segment 1 length equals `plan.bindingMonths`, for plans built by `computeHouseholdPlan` (including one with a surplus offset).
- Sum of `monthly` equals the sum of schedule amounts; `monthly` is non-increasing.
- Overdue and this-month entries count as one month (they land in segment 1); two entries on one date are one deadline.
- Empty schedule, `goalsMonthly` 0 and null `bindingMonths` return empty arrays; undated goals contribute nothing; budgets never appear in the series (a plan with budgets gives the same series as without).
- A single far-dated entry is truncated at `capMonths`; the surplus is applied once (the series sums to the post-offset total, not the raw total).

S2: new optional fields round trip through the schema and export validator; upsert omits undefined freedom fields; the missing-column fallback still saves the old fields.

S3: component renders each state in the States table, including the household unavailable row for `'none'`, `'locked'`, loading and error (the card still renders in each); a household goal name is masked in lever copy while amounts are hidden; amounts masked and percentages not; scenario date uses the scenario basis label; no horizontal overflow classes at 375 px (class check).

## Out of scope

- Tax modelling.
- Asset, fund, platform or allocation recommendations.
- Monte Carlo or any probabilistic or historical-sequence model.
- Joint household projection (a combined couple's freedom date).
- CPF Life payout modelling and CPF balance growth.
- Inflation modelling beyond using a real return, salary raises and windfalls.
- Sharing any freedom figure with the partner.
- Changing `computeSalaryPlan` (no change needed).
- Any change to `computeHouseholdPlan` or the `HouseholdPlan` contract (specs 183, 185, 187); the new helper is a separate additive export.
- Re-running `computeHouseholdPlan` with an advanced `now`.

## Acceptance

- [ ] `pnpm format:check`
- [ ] `pnpm lint` (max-warnings=0)
- [ ] `pnpm typecheck`
- [ ] `pnpm test:ci`
- [ ] `pnpm build`
- [ ] `projectFreedom` is pure: no I/O, `now` passed in, no `Date.now()` or `new Date()` without an argument inside the library.
- [ ] Every date is displayed beside the assumptions that produced it; the headline is a range.
- [ ] No security, fund or allocation is named anywhere in the UI copy or levers.
- [ ] Migration is additive and idempotent; running it twice changes nothing; owner has applied it before S2 deploys.
- [ ] Card works at 375 px and in dark mode; amounts masked, no new dependency.
- [ ] The partner account sees nothing from this feature.
- [ ] The `emergency-surplus` lever is net of `PlannerValues.householdEarmark`, matching `computeInvestmentBreakdown`.
- [ ] Household goal names in lever or detail copy go through `mask()`.
- [ ] Household `'none'`, `'locked'`, loading and error all render the card with zero household contribution.
- [ ] `householdGoalsSeries` takes the plan the planner already computed (no second `computeHouseholdPlan` call): month 0 equals `plan.goalsMonthly`, the monthly sum equals the schedule total, the series is non-increasing, budgets are excluded, and the hand example gives `byYear` [100, 50].
- [ ] `computeHouseholdPlan` and `tightestDeadline` are unchanged.

## Risk & reversibility

- Risk: a precise-looking date can be mistaken for a promise. Mitigation: range headline, assumptions beside every date, no pre-filled assumptions, the disclaimer line, and the "not reached" and "already reached" states.
- Risk: double counting the portfolio. Mitigation: `P` is the snapshot investment categories only; live equity and savings are not added (Q7).
- Risk: inputs drift from the planner (expenses override, buffer). Mitigation: the card reads the same `PlannerValues` bridge the planner already publishes.
- Risk: the household series (S3) restates the tightest-deadline rule in a second place, so the two could drift. Mitigation: the walk reads only `HouseholdPlan` fields from the planner's single plan call (surplus applied once), and tests pin segment 1 to `plan.goalsMonthly` and `plan.bindingMonths` and the monthly sum to the schedule total. Whole-month rounding can end a segment just under a month after the real date, the same as the planner. S1 and S2 do not depend on it.
- Reversibility: S1 is new files only; S3 removes by deleting the card and the additive `PlannerValues` fields. S2's columns are nullable and unused if the UI is removed; a later migration may drop them (forward-only, §6.3).

## Open questions

- [x] Q1: Default real return. Default: no pre-filled value; the owner enters it (helper text says "your assumption"), bounds 0 to 12 percent. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q2: Default withdrawal rate. Default: no pre-filled value; the owner enters it, bounds 1 to 10 percent. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q3: Target year. Default: optional; when set the card says whether the base case reaches it. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q4: CPF inclusion. Default: excluded, shown as a separate read-only "CPF (locked)" line when pension entries exist; no include toggle. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q5: Living cost scope. Default: planner expenses + buffer + household budgets; insurance, tithe and allowance excluded and stated on the assumptions line. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q6: Mask percentages and years. Default: not masked (they are not amounts); amounts masked. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q7: Portfolio source. Default: snapshot investment categories only; do not add live equity value. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q8: Show a projected date on saved scenarios. Default: yes, read-only, labelled "scenario basis". Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q9: Opt-in to share the progress percentage with the partner. Default: out of scope; would need a governance spec. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q10: Range spread. Default: base return plus and minus 2 percentage points, lower bound 0. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q11: Projection cap. Default: 60 years (720 months), then "not reached". Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
- [x] Q12: Safety savings release (savings joining investing once emergency fund and war chest are funded). Default: included in `monthlyInvesting` from the funded month, labelled in the detail. Owner: Clarence. A: Default accepted (Clarence, 2026-11-11).
