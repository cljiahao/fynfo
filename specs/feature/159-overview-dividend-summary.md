---
id: '159'
slug: overview-dividend-summary
area: feature
status: approved
author: Claude Code
created: 2026-10-30
approved: 2026-10-30
shipped:
impl_pr: direct commit to main (no PR)
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.3'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.4'
constitution_overrides: []
---

# Spec 159: Dividend summary on the dashboard overview

## Problem

The owner finds the dashboard overview "a bit empty". It shows only
`FirstRecordPrompt` and `LatestRecords`
(`src/app/dashboard/(overview)/dashboard-overview.tsx`), while dividend income,
which the owner tracks closely, is visible only on the Equity page
(`DistributionsSection`). The overview should answer "how much have my dividends
paid, and is it growing?" at a glance: dividends earned to date, an
average per year, the trailing twelve months, and a five-year trend.

## Constitution check

- Satisfies: `§2.1` and `§2.3` (no new data path; dividends are read through the
  existing `getDividends` action, which calls `requireUserId()` then
  `getVaultDekSession()` and decrypts in process), `§2.4` (the page file stays
  thin; the new component lives in the equity feature and is composed by the
  overview component), `§2.5` (the component needs React Query and the privacy
  context, so it is a Client Component like its neighbours),
  `§2.6` (imported from `@/features/equity`), `§2.7`, `§3.2` (Tailwind only,
  no `any`, Recharts only through `@/lib/recharts`), `§3.4`, `§4.1`, `§4.4`,
  `§4.2` (tests for the new pure maths and the render).
- Overrides: none. No new dependency, migration or encryption change.

## Solution shape

### Pure helpers

Add to `src/features/equity/lib/dividend-metrics.ts`; existing exports and their
callers (`totalSGD`, `incomeByYear`, `ttmDistributionsSGD`, `DividendIncomeChart`
default behaviour, `DistributionsSection`) stay unchanged.

Decision: new pure helpers rather than a window parameter on `incomeByYear`.
`incomeByYear` returns only years that have data and is used by the Equity page
chart as is; adding an optional zero-filled window to it would change one
function's contract for two different needs. The new helpers reuse `toSGD`.

- `incomeForRecentYears(dividends, usdSgdRate, endYear, count = 5)`: returns
  `count` entries `{ year: string, total: number }`, ascending, for calendar
  years `endYear - count + 1 .. endYear`, with `0` for years without payments.
  Dividends dated outside the window are ignored.
- `trailing12MonthSGD(dividends, usdSgdRate, asOf)`: sum of SGD amounts for
  dates in the half-open window `(asOf minus one year, asOf]`, all tickers, using
  `YYYY-MM-DD` string comparison. When `asOf` is 29 February the window start is
  28 February of the previous year. Future-dated records (after `asOf`) are
  excluded.
- `dividendSummary(dividends, usdSgdRate, asOf)`: returns
  `{ totalToDate, trailing12m, averagePerYear, fullYears }`.
  - `totalToDate`: sum of SGD amounts dated on or before `asOf`.
  - `averagePerYear` (per annum, full calendar years only): let `Y0` be the year
    of the earliest dividend dated on or before `asOf` and `C` the current
    calendar year of `asOf`. The completed years are `Y0 .. C - 1`, so
    `fullYears = C - Y0` when positive. `averagePerYear` is the sum of those
    years' SGD totals divided by `fullYears`, counting a year with no payments
    in between as zero. The current year is excluded because it is incomplete.
  - Edge cases: no dividends gives all zeros, `averagePerYear` null and
    `fullYears` 0. First dividend in the current year gives `fullYears` 0 and
    `averagePerYear` null (UI shows "Needs a full calendar year"). The first
    dividend year counts as a full year even if the owner started recording mid
    year; this lowers the average slightly and is a stated simplification, not a
    guess at the owner's holding start date.
- The three helpers each take `asOf` as an `YYYY-MM-DD` argument so tests are
  deterministic. Callers pass `new Date().toISOString().slice(0, 10)`, the same
  convention as `DistributionsSection`.

### Component

- New `src/features/equity/components/dividend-summary.tsx`, exported from
  `src/features/equity/components/index.ts` as `DividendSummary`. It takes no
  props.
- Data: `useDividends()` and `useExchangeRate('USD', 'SGD')`, with
  `usdSgdRate = !rateError && validExchangeRate(rate) ? rate : null` and
  `requiresRate = rows.some(r => r.currency === 'USD')`, exactly as
  `distributions-section.tsx` L42-L54. Conversion is "ready" when there is no USD
  row or the rate is valid and every derived figure is finite.
- States:
  - pending: skeleton cards, as in `DistributionsSection`.
  - error: `DashboardError compact` with retry, title "Couldn't load dividends".
  - success with zero dividends: render nothing, so the overview does not gain an
    empty block for someone who tracks no dividends.
  - conversion not ready: the three figures show "Unavailable" and one
    `role="status"` note: "Exchange rate unavailable. Converted dividend totals
    and the chart are hidden." (same wording family as the Equity page). The note
    "SGD totals use a current exchange-rate estimate" is shown when USD rows
    exist and conversion is ready.
- Cards (three `StatCard`s from `@/components/widgets`): "Dividends earned" (all
  time, SGD), "Last 12 months" (SGD), "Average per year" (SGD; hint "N full
  calendar years", or "Needs a full calendar year" when null). Values pass
  through `mask(formatSGDWhole(...))` from `useAmountVisibility`, matching
  `LatestRecords`.
- Chart: reuse `DividendIncomeChart` with a new optional prop `years?: number`.
  When provided it builds its data with `incomeForRecentYears(dividends,
usdSgdRate, currentYear, years)`; when omitted it keeps calling `incomeByYear`
  so the Equity page is unchanged. The overview passes `years={5}`, giving the
  last five calendar years including the current one, zero-filled. The chart
  already renders "Distribution chart hidden" when amounts are hidden, so
  masking is inherited.
- Overview wiring: `src/app/dashboard/(overview)/dashboard-overview.tsx` renders
  `<DividendSummary />` inside the "Overview" view, after `LatestRecords`.
  Import from `@/features/equity` (already imported there for `useTrades`).

### Prefetch decision

Do not add dividends to `OverviewPrefetch` or to `OverviewReadData`.

- `OverviewPrefetch` (`src/features/overview/components/overview-prefetch.tsx`)
  server-prefetches the four queries the first screen needs (snapshots, salary,
  planner, expenses). Trades are used on the overview but are deliberately not
  prefetched; they travel through the batched overview read transport
  (`use-equity.ts` L17-L21). Dividends sit below those cards, so a client query
  with a skeleton matches how trades behave and avoids lengthening the server
  prefetch.
- Adding dividends to prefetch would need `DIVIDENDS_KEY` exported from the
  equity feature and another decrypting read before first paint. Adding them to
  the batched transport would touch `OverviewReadData`
  (`src/lib/overview-read-context.tsx`), `overview-actions.ts` and
  `use-dividends.ts`. Neither is justified for one below-the-fold block.
- Either way, `getDividends` itself performs `requireUserId()` then
  `getVaultDekSession()`, so the vault rule holds with no prefetch.
- If the owner later sees a visible loading flash, a follow-up spec can add the
  prefetch; the component contract does not change.

## Out of scope

- Forward yield, yield on cost, or per-ticker breakdown on the overview.
- Changing the Equity page's `DistributionsSection` or its chart behaviour.
- Rate-on-payment-date FX conversion (the existing single-rate estimate stays).
- Any change to dividend storage, the overview read transport or prefetch.
- A configurable year count in the UI.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests:
  - `test/features/equity/dividend-metrics.test.ts`: `incomeForRecentYears`
    returns exactly five ascending years, zero-fills gaps, ignores dividends
    outside the window, converts USD; `trailing12MonthSGD` includes a payment
    exactly one year back minus a day, excludes one exactly one year back and
    one dated after `asOf`, handles `asOf` of 29 February; `dividendSummary`
    average over full years only (current year excluded, gap year counted as
    zero), `averagePerYear` null and `fullYears` 0 when the first dividend is in
    the current year or there are none, `totalToDate` ignores future-dated rows
  - `test/features/equity/dividend-summary.test.tsx` (RTL, jsdom, mocked hooks
    in the style of `distribution-readiness.test.tsx`): the three cards show
    SGD figures; with amounts hidden the figures are masked and the chart shows
    the hidden message; USD rows with an invalid rate show "Unavailable" and the
    status note; empty data renders nothing; error shows the retry control;
    pending shows skeletons
  - `DividendIncomeChart` without `years` still passes `incomeByYear` data
    (existing Equity tests stay green)
- [ ] `pnpm build` green
- [ ] Manual: the overview shows the three cards and a five-bar chart; toggling
      amount visibility masks them; the Equity page is unchanged

## Risk & reversibility

- **Blast radius**: the overview page gains one block and the equity feature
  gains pure helpers and one component. One extra `getDividends` call on overview
  load, which is a single read of one user's rows.
- **Reversibility**: single `git revert`; no data or schema touched.
- **Backout plan**: revert the implementation commit on `main`.

## Open questions

- [ ] Q: Is the first dividend year acceptable as a full year in the per-annum
      average, even when recording started mid year? Proposed: yes, documented
      on the card hint. — Owner: Clarence — A: Yes, counts as a full year; card hint explains the rule.
- [ ] Q: Placement: under `LatestRecords` in the Overview view (proposed), or
      above it? — Owner: Clarence — A: Below LatestRecords.
