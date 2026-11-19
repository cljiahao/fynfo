---
id: '194'
slug: invested-basis-and-coverage-empty-state
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-19
approved: 2026-11-19
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.4'
  - '§2.5'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.2'
constitution_overrides: []
---

# Spec 194: Equity "Total Invested" as cost basis of held shares, and a dividend-coverage empty state

Two small display fixes, both decided by the owner on 2026-11-19. Builds on spec 193 (coverage section) and the average-cost fixes in commits 96f7529 and e4a5876.

## Problem

1. The equity "Total Invested" card sums gross buy cost and ignores sells, while average cost already accounts for partial sells. After a partial sell, "Total Invested" overstates what is still invested and disagrees with Unrealised P&L, which is computed against average cost x shares.
2. With no dividends in the trailing window the Freedom card shows a "Dividends cover 0% of living cost." line and a row of milestone pills, which reads as a result rather than as "you have not logged dividends".

## Constitution check

- §1.1: personal data only; no household surface touched.
- §2.4 and §2.5: logic stays in `src/features/equity/lib/` and `src/features/assets/`; both components are already `'use client'`, no new ones.
- §3.1 and §3.2: no new dependency, no `any`, no migration, no inline static data (route and copy constants go in `constants.ts` if reused).
- §4.1 and §4.2: all gates, with tests for each new pure branch.

No SOFT override requested.

## Current behaviour (verified)

- `computeHoldings` (`src/features/equity/lib/holdings.ts`) returns per holding `totalBuyCost` (sum of `shares * price + fees` over buys, sells ignored) and `avgBuyPrice` (= `costBasis` = `costRemaining / runningShares`, partial-sell aware). Fully sold tickers are filtered out (`shares > EPSILON`).
- `PortfolioSummary` (`src/features/equity/components/portfolio-summary.tsx:36-53`) builds `invested` from `holding.totalBuyCost` and a separate `cost` from `avgBuyPrice * shares`. Only `cost` feeds Unrealised P&L (`value - cost`). `invested` feeds only the Total Invested card via `amounts('invested')` (:139), already grouped per market currency (SGD, USD).
- `totalBuyCost` has no other consumer (grep: only `holdings.ts` and `portfolio-summary.tsx`). Annualised return is the money-weighted IRR from `buildCashFlows`, which uses actual trade cash flows, not either figure. The holdings table already uses `avgBuyPrice`.
- `useDividendAvgMonthly` (`src/features/assets/hooks/use-freedom-inputs.ts:174`) returns `null` when there are no dividend rows at all or a USD rate is missing, else `averageMonthlyTTM(trailing12m)` over the window (asOf - 1 year, asOf]. `computeDividendCoverage` returns coverage `0` for a TTM average of 0 and all-null for a null average; `DividendCoverageSection` renders nothing when coverage is null.
- The dividends surface is the "Dividends" tab on `/dashboard/equity` (`src/app/dashboard/equity/page.tsx`); tab state is local, there is no deep link.

## Solution shape

1. Invested basis (decided). In `PortfolioSummary`, derive `invested` from the same `rawCost` already computed (`sum(avgBuyPrice * shares)` per market). `invested` and `cost` collapse into one value, so Total Invested and Unrealised P&L share one denominator and `value - invested === pnl` always. Fully sold positions are already excluded and contribute 0. Annualised IRR is unchanged (cash-flow based); no other number changes. Extract the per-market reduction into a pure `investedBasis(rows)` in `holdings.ts` so it is unit-testable. Remove `totalBuyCost` from `Holding` and `computeHoldings` if nothing else uses it afterwards.
2. Coverage empty state (decided). "No dividends logged" means no dividend in the trailing-12-month window, i.e. `ttmMonthlyAvg === 0`. Reason: coverage is computed from that window only, so a dividend that has aged out gives 0% coverage and the hint is the accurate reading. In `DividendCoverageSection`, when `coverage === 0`, render instead of the headline, pills, gap and allowance lines: "No dividends logged in the last 12 months. Log dividends to see how much of your living cost they cover." with a `next/link` to `/dashboard/equity?tab=dividends` ("Log dividends"). The "Estimates, not advice" footnote is dropped in this state. `coverage === null` still renders nothing.
3. Never-logged case. Today a user with zero dividend rows gets `null` from the hook and sees nothing, so no hint. To cover this, `useDividendAvgMonthly` returns `0` when dividends have loaded and the list is empty (no USD rate is needed for an empty list). `dividendCoverage` in `freedom-projection.ts` then yields 0% instead of null for these users, which only affects the projection's dividend-coverage figure (not income, balance or dates); acceptance below pins this. See Q1.

## Out of scope

- Realised P&L, a "total bought" figure, or renaming the card.
- Changing milestones, allowance maths, or the Investments-tab `dividend-summary.tsx` coverage figure.
- Migrations and dependencies.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` and `pnpm build` green.
- [ ] Unit tests, `investedBasis` (equity lib): buy-only equals gross buys incl. fees; partial sell reduces basis to avg cost x remaining shares; buy-sell-rebuy uses the walk's average; fully sold ticker contributes 0; SGD and USD rows are summed per market, never mixed; non-finite input returns null.
- [ ] Component test (jsdom per-file, mocked prices), `PortfolioSummary`: for a partial-sell fixture, Total Invested equals avg cost x shares and `value - invested` equals the displayed Unrealised P&L.
- [ ] Component tests, `DividendCoverageSection`: `ttmMonthlyAvg = 0` renders the hint and a link with `href="/dashboard/equity?tab=dividends"`, and no pills or "0%" text; a positive average renders exactly as today; `null` renders nothing.
- [ ] Hook test, `useDividendAvgMonthly`: empty loaded list gives 0; rows all older than 12 months give 0; still loading gives null; USD rows without a rate give null.
- [ ] Freedom projection regression: `dividendAvgMonthly: 0` produces the same income, balance and date outputs as `null`; only the coverage figure differs.
- [ ] Manual: a partial-sell portfolio shows Total Invested equal to avg cost x shares; a fresh account shows the hint on the Freedom card.

## Risk & reversibility

- **Blast radius**: one card's number on the equity page (lower after sells, by design) and one block on the Freedom card. Stored data is untouched.
- **Reversibility**: git revert; no migration.
- **Backout plan**: revert the commit.

## Resolved questions (owner, 2026-11-19)

- Q1: approved. `useDividendAvgMonthly` returns 0 for a loaded empty list; `dividendCoverage` becomes 0% instead of null for never-logged users.
- Q2: approved, inside this spec. `/dashboard/equity` reads `?tab=dividends` to open the Dividends tab; the hint links to `/dashboard/equity?tab=dividends`. Acceptance: a test shows the tab param selects Dividends, and the hint link `href` is `/dashboard/equity?tab=dividends`.
