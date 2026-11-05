---
id: '177'
slug: dashboard-dividend-breakdown
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-06
approved: 2026-11-06 # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # no PR (direct to main); commit shas recorded per slice
supersedes:
constitution_satisfies:
  - '§2.1'
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
  - '§5.4'
constitution_overrides:
---

# Spec 177: Dashboard dividend breakdown (move to Investments tab, richer card)

## Problem

Owner request (2026-11-06): the dividend card on the dashboard is a thin
summary sitting in the wrong place. Concrete pain today (spec 159 shipped it):

- `DividendSummary` renders in the **Overview** tab
  (`src/app/dashboard/(overview)/dashboard-overview.tsx:137`), next to the
  net-worth and latest-records cards. Dividends are income that funds the plan,
  so they belong in the investing tab (today **Plan income**, `:141-170`;
  renamed **Investments** by spec 176), which today ends with
  `InvestmentBreakdown` and `InvestmentAllocation`.
- The card shows only three stat cards (Dividends earned, Last 12 months,
  Average per year) and a 5-calendar-year bar chart
  (`src/features/equity/components/dividend-summary.tsx:84-105`). It cannot
  answer: is income growing, how much per month, which tickers pay it, how much
  of my spending does it cover, what should I expect next year.

The Equity page Dividends tab (`src/app/dashboard/equity/page.tsx:54-71`,
`DistributionsSection`) is unchanged by this spec.

## Constitution check

- Satisfies: `§2.1` (dividends stay client-decrypted via the existing
  `useDividends` hook; no new server surface, no plaintext leaves the client),
  `§2.4` (pages compose features; the page only reorders components and passes a
  planner value as a prop), `§2.5` (see override-free justification below),
  `§2.6` (imports via `@/features/equity` barrel; new component exported from
  `components/index.ts`), `§2.7` (named exports), `§3.1` / `§3.2` (no new
  dependency; existing `@/lib/recharts` wrapper), `§3.4` (kebab-case files),
  `§4.1` / `§4.4` (gates), `§4.2` (pure math ships with unit tests and a
  per-file coverage gate, spec refactor/049 pattern), `§4.3` (no suppressions),
  `§4.5` (new chart is dynamically imported, so no JS added to the initial
  route), `§5.4` (no DB query touches encrypted columns; all math is client
  side after decrypt).
- `§2.5` (`SOFT`, Server Components by default): the existing
  `DividendSummary` and chart are already `'use client'` because they use
  `useDividends`, `useExchangeRate`, `useAmountVisibility` (privacy mask) and
  recharts. The new breakdown component is `'use client'` for the same reasons
  (React Query hooks, mask context, browser-only recharts). The lib module is a
  plain server-safe TS file with no directive. No override needed: the rule
  allows client components with a justification, given here.
- Overrides: none. No `HARD` rule is touched; no governance spec required.

## Sequencing with spec 176

Spec 176 moves `SalaryPlanner` into the Overview tab and renames "Plan income"
to "Investments". Both specs edit `dashboard-overview.tsx`, so 177
implementation (S2 in particular) is sequenced after 176 ships; this spec's
references to the Plan income tab mean the Investments tab once 176 lands.
The dividend card goes in that tab after `InvestmentBreakdown` and
`InvestmentAllocation`. The coverage line depends on `plannerValues.expenses`,
which stays reachable because it is lifted into `dashboard-overview.tsx` state
via `handlePlannerValuesChange` (`:54-67`) regardless of which tab renders
`SalaryPlanner`. Spec 176 changes what that value is (a 6-month average or the
user's override), not whether it is available, so the coverage line stays
and uses the new value.

## Solution shape

### What the card shows today (verified against main)

`src/features/equity/components/dividend-summary.tsx`:

- Three `StatCard`s (`:84-98`): total to date, trailing 12 months, average per
  full calendar year (hint: count of full years).
- `DividendIncomeChart` (`:99-105`), lazy via `next/dynamic` in
  `dividend-income-chart.tsx` (ssr false, 260px skeleton), 5 calendar years
  zero-filled.
- Exchange-rate handling: USD amounts use one current USD to SGD rate; a note
  explains this is an estimate (`:78-83`); if the rate is missing and USD rows
  exist, totals show "Unavailable" and the chart is hidden (`:72-77`).
- Loading skeleton, compact error with retry, and `return null` when there are
  no dividends (`:48`). Amounts pass through `mask()`; the chart shows a
  "hidden" line when `hidden` is true.

Available data is only `DividendData` (`src/features/equity/types.ts:21-29`:
`ticker`, native `amount`, `currency` SGD or USD, payment `date`); schema in
`schemas.ts:38-45`. There is no ex-date and no withholding tax, so nothing here
can claim net-of-tax or ex-date accuracy.

### Content decisions (picked, with reasons)

Keep the existing three stat cards and the 5-year chart unchanged (proven,
tested, owner-seen). Add, in this order:

1. **Last 12 months vs prior 12 months** (YoY change). Added as a hint on the
   existing "Last 12 months" `StatCard` (`+12%` / `-4%` / `—` when the prior
   window is 0). Cheapest high-signal addition; no new tile.
2. **Average per month** = trailing-12-month SGD / 12, as a fourth stat card
   (grid goes `sm:grid-cols-2 lg:grid-cols-4`; stacks single-column at 375px).
   This is the number that compares directly with monthly expenses.
3. **Monthly income bar chart, last 12 months** (zero-filled, single series,
   same chart wrapper and tokens as the yearly chart). Dividends are lumpy
   (quarterly or semi-annual), so the monthly view shows timing that the yearly
   bars hide. Single series only; stacked-by-ticker is dropped (unreadable at
   375px with more than 4 tickers).
4. **Top tickers by share of TTM**: a list of up to 5 tickers plus an "Other"
   row, each with SGD amount, percent share and a thin share bar built from a
   div (no chart lib, no extra JS). Answers "where does it come from" and
   concentration risk.
5. **Yield on cost per ticker**, shown on the same ticker rows as a trailing
   caption, for tickers still held. Reuses the existing `yieldOnCost` and
   `ttmDistributionsSGD` (`dividend-metrics.ts:124-154`) and `computeHoldings`
   from the trades already cached by `useTrades`. Sold tickers show no yield
   (cost basis of shares held is 0). Note `costBasis` is whatever currency
   `computeHoldings` produces; verify at S1 whether it is SGD-comparable and convert if not (see
   Open questions).
6. **Forward 12-month estimate**: TTM SGD of tickers currently held, labelled
   "Estimate: assumes the last 12 months repeat for current holdings". Shown as
   a line, not a stat card, so it cannot be mistaken for a figure. Excludes
   tickers with zero current shares. No growth assumption, no forecasting of
   cuts.
7. **Coverage line**: "Dividends (last 12 months, per month) cover X% of planned
   monthly expenses", using `plannerValues.expenses`, which the page already
   holds (`dashboard-overview.tsx:54-60`). Hidden when expenses is 0.
   `DividendSummary` receives it as an optional `monthlyExpenses` prop; the
   feature does not import from `assets` (avoids a cross-feature cycle).

The **SGD vs USD split** is kept as one caption line under the total, masked
with the other amounts (owner decision, 2026-11-06). The card's existing note
that USD is converted at a current rate stays beside it.

Dropped, with reasons: **stacked or by-year monthly chart** (see 3); any
per-payment table (lives on the Equity Dividends tab).

All amounts use `mask(formatSGDWhole(...))`; percentages are not masked (they
leak no absolute amount) except the coverage percent, which is masked too
because with a known expenses figure it reveals dividend income. The monthly
chart renders the existing "hidden" placeholder when `hidden`. Colours use the
existing chart tokens, so dark mode follows the yearly chart. Layout is a
single column of blocks, 375px safe: ticker rows wrap caption under the amount
instead of squeezing.

### Files

- New `src/features/equity/lib/dividend-breakdown.ts` (no directive), pure and
  deterministic, all taking `asOf: string` and `usdSgdRate`:
  - `trailingTwelveMonthChange(dividends, rate, asOf)`: `{ current, prior,
changePct | null }` (windows (asOf-1y, asOf] and (asOf-2y, asOf-1y]);
    reuses `trailing12MonthSGD` semantics, 29 Feb handling included.
  - `averageMonthlyTTM(ttm)`: `ttm / 12`.
  - `incomeForRecentMonths(dividends, rate, asOf, count = 12)`: zero-filled
    `{ month: 'YYYY-MM', total }[]` ascending, ending at `asOf`'s month.
  - `topTickerShares(dividends, rate, asOf, limit = 5)`: `{ ticker, ttm,
share }[]` plus an `other` bucket when more than `limit` tickers paid;
    shares sum to 1; empty when TTM is 0.
  - `forwardEstimate(dividends, holdings, rate, asOf)`: sum of TTM for tickers
    with `shares > 0`.
  - `expenseCoverage(avgMonthly, monthlyExpenses)`: fraction or `null` when
    expenses is not a positive finite number.
  - Exports of `toSGD`, `trailing12MonthSGD` stay in `dividend-metrics.ts`;
    the new file imports them (no duplication). `dividend-metrics.ts` is not
    modified.
- New `src/features/equity/components/dividend-breakdown.tsx` (`'use client'`,
  justified above): ticker share list, estimate and coverage lines. Receives
  already-computed values from `DividendSummary` as props (presentational).
- New `src/features/equity/components/dividend-monthly-chart.tsx` (dynamic
  wrapper) and `dividend-monthly-chart-content.tsx` (recharts), mirroring
  `dividend-income-chart.tsx` / `-content.tsx` exactly: `next/dynamic`, `ssr:
false`, fixed-height `Skeleton` to avoid layout shift. This honours spec 174
  (lazy-loading recharts deferred): the new chart adds no static recharts
  import to the dashboard route; the existing yearly chart is already lazy
  (commit `bd11092`).
- Edit `src/features/equity/components/dividend-summary.tsx`: add optional
  `monthlyExpenses?: number` prop; call `useTrades()` for holdings (already
  cached on the dashboard by `dashboard-overview.tsx:53`); compute the new
  figures once, behind the same finite-number guard as `summary`
  (`:54-61`); render the new blocks only when `summary !== null`, so the
  rate-unavailable path is unchanged. If trades are still loading or errored,
  hide only the yield and forward-estimate pieces (they need holdings); everything else
  renders.
- Edit `src/features/equity/components/index.ts`: no new public export
  required beyond `DividendSummary` (sub-components stay internal).
- Edit `src/app/dashboard/(overview)/dashboard-overview.tsx`: remove
  `<DividendSummary />` from the Overview tab (`:137`) and render
  `<DividendSummary monthlyExpenses={plannerValues.expenses} />` in the plan
  tab after `InvestmentAllocation`. Place it outside `QueryContent` so dividend
  loading and errors do not depend on snapshot, salary and expense readiness;
  it carries its own skeleton and error state. The fragment in the Overview
  tab is simplified accordingly.
- Edit `vitest.config.ts`: add a per-file coverage gate for
  `src/features/equity/lib/dividend-breakdown.ts` (same thresholds as
  `dividend-metrics.ts`: 95 lines / 95 statements / 100 functions / 85
  branches), per the spec refactor/049 pattern.
- New `src/features/equity/lib/dividend-breakdown.test.ts` at
  `test/features/equity/dividend-breakdown.test.ts`, matching
  `test/features/equity/dividend-metrics.test.ts`.
- `specs/feature/159-overview-dividend-summary.md` is not edited (shipped specs
  are history); this spec records the move.

### Data and security

No migration, no schema change, no new action, no new dependency. Reads only
existing decrypted `dividends` and `equity_trades` query caches (`§2.1`,
`§5.4`). Nothing is logged.

## Out of scope

- Equity page Dividends tab (`src/app/dashboard/equity/page.tsx:54-71`) and
  `DistributionsSection`: unchanged.
- New data fields (ex-date, withholding tax, frequency), any migration.
- Historical per-payment FX (the single current-rate estimate stays, with its
  note).
- Forecasting beyond "TTM repeats"; growth, cut or payout-ratio modelling
  (`§1.2`: not a financial advisor).
- Changing the three existing stat cards' meaning, the 5-year chart, or
  `dividend-metrics.ts`.
- Dividend widgets on other tabs or pages; exporting.

## Slices

- **S1: metrics lib and tests.** `dividend-breakdown.ts`, its unit tests
  (zero-filled months, leap day, empty input, single ticker, more than five
  tickers with Other bucket, shares summing to 1, sold tickers excluded from the
  estimate, prior-window zero giving `null` change, expense coverage with 0 or
  NaN expenses), `vitest.config.ts` gate. No UI. Gates: `pnpm format:check`,
  `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`.
- **S2: card UI and move.** `dividend-breakdown.tsx`, monthly chart wrapper and
  content, `dividend-summary.tsx` edits, page move in
  `dashboard-overview.tsx`. Component tests for rate-unavailable, masked, no
  trades, and zero-expenses states where the existing test setup supports them
  (jsdom per-file). Manual check at 375px, light and dark, masked on and off.
  Same five gates.

S2 depends on S1. Each slice is a direct-to-main commit (owner waives PRs);
record shas in `impl_pr`.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green (`§4.1`)
- [ ] `pnpm test:ci` green; new tests cover every `dividend-breakdown.ts`
      export; coverage gate for that file passes
- [ ] `pnpm build` green; no static recharts import added to the dashboard
      route (new chart reached only through `next/dynamic`)
- [ ] Manual: Overview tab no longer shows dividends; Investments tab shows the
      card after Investment allocation; Equity Dividends tab is byte-identical
      in behaviour
- [ ] Manual: with amounts hidden, no dividend or coverage figure is visible;
      with USD rows and no exchange rate, the existing "Unavailable" path still
      renders and the new blocks are hidden
- [ ] Manual: 375px width shows no horizontal scroll; light and dark both
      legible
- [ ] Manual: user with zero dividends sees no card (unchanged `return null`)
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: dashboard Overview and Investments tabs, read-only
  presentation of existing decrypted data. No writes, no schema, no auth.
- **Reversibility**: each slice is a single `git revert`; no migration.
- **Backout plan**: revert S2 to restore the old card on Overview; S1 is inert
  without S2.
- **Risks**: FX estimate applied to a forward figure (mitigated by labelling);
  yield on cost depends on `costBasis` currency (see Open questions); a user
  may read the forward estimate as a promise (label wording is explicit);
  `plannerValues.expenses` is the planner's recent average or the user's
  override, not necessarily "planned" expenses (see Open questions).

## Open questions

- [x] Q: Is `Holding.costBasis` (`src/features/equity/lib/holdings.ts:11`, from
      trade prices) in the same currency as SGD-converted TTM for US tickers?
      If not, yield on cost per ticker for USD names needs a currency
      conversion or must be limited to SG tickers. — Owner: author at S1
      (read-only check), Clarence if a product call — A: Check at S1 whether `Holding.costBasis` is in the ticker's native currency. If it is not SGD, convert it to SGD with the same FX source the TTM SGD total uses. (owner, 2026-11-06, recommended default).
- [x] Q: Which expenses figure should coverage use: `plannerValues.expenses`
      (the planner's all-time average monthly expense, `salary-planner.tsx:109`)
      or a different "planned" number? — Owner: Clarence — A: Use `plannerValues.expenses`, which after spec 176 is the recent 6-month average or the user's override. (owner, 2026-11-06, recommended default).
- [x] Q: Should `DividendSummary` sit inside or outside `QueryContent` in the
      Investments tab? Draft says outside, so dividends load independently of
      snapshot, salary and expense readiness. — Owner: Clarence — A: Outside `QueryContent`, so dividends load independently of snapshot, salary and expense readiness. (owner, 2026-11-06, recommended default).
- [x] Q: Is the 12-month monthly chart enough, or do you want 24 months or a
      toggle (monthly / yearly)? Draft keeps 12 months plus the existing 5-year
      chart. — Owner: Clarence — A: 12-month bar chart plus the existing 5-year chart; no toggle. (owner, 2026-11-06, recommended default).
- [x] Q: Drop the SGD vs USD split as proposed, or keep it as one caption line?
      — Owner: Clarence — A: Keep the SGD vs USD split as a single caption line under the total, masked like the other amounts. (owner, 2026-11-06, recommended default).
