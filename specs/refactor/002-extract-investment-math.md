---
id: 002
slug: extract-investment-math
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved roadmap Phase 3 (SRP)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # SRP — pure financial math out of the component
  - '§4.2' # ships unit tests for the extracted math
constitution_overrides:
---

# Spec refactor/002: Extract pure investment-breakdown math into a tested lib

## Problem

`investment-breakdown.tsx` (655 lines, audit Phase 3) fused ~120 lines of pure financial allocation
math (monthly/quarterly splits, deployable cash, per-market targets/availability, quarter-spend) with
localStorage persistence and a large JSX tree. The math — the most error-prone, money-affecting part —
had **zero tests** and could only be exercised by rendering the component (impossible here: node-env
vitest, no RTL).

## Constitution check

- Satisfies `§3.1` (SRP) and `§4.2` (tests). Overrides: none. No migration, no new dependency, no
  encryption path. Behavior-preserving extraction.

## Solution shape

- New pure `src/features/assets/lib/investment-math.ts`: `floorH`, `sumCat`, `getCurrentQuarter(now?)`
  (time injectable), `deployPctColor`, `computeMarketEquity`, `computeQuarterSpend(…, getMarket)`
  (market resolver injected), and the aggregate `computeInvestmentBreakdown(input) → BreakdownResult`.
  `MarketBudgets` type moved here (re-exported from the component so the `@/features/assets` barrel is
  unchanged).
- New SSR-safe `src/lib/utils/local-store.ts`: `loadLocal`/`saveLocal` (replaces the component's
  bespoke `load` + raw `localStorage.setItem`; reusable by other preference-storing components).
- `investment-breakdown.tsx` now calls the helpers; the inline math/helpers are gone. JSX unchanged.

## Out of scope

- Decomposing the JSX itself (sub-components) — no test harness to verify render; size is now driven by
  markup, not logic.
- The other four oversized components (their own specs).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [x] New tests: `investment-math` (15 cases incl. quarter bounds, deployable/shortfall, clamped
      remaining) + `local-store` (round-trip, fallback, malformed, SSR). 223 total.
- [x] No new dependency, no `any`, no `console.log`.

## Risk & reversibility

- **Blast radius**: the investment-breakdown card only; literal extraction, JSX untouched.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
