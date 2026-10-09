---
id: '084'
area: audit
status: shipped
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/17
created: 2026-10-10
author: Codex
constitution_satisfies:
  ['§1.2', '§2.1', '§2.3', '§3.1', '§3.2', '§4.1', '§4.2', '§7.4', '§8.2']
---

# Quote availability and native investment currencies

## Owner authorization and problem

Owner's full-codebase audit and 2026-10-10 continuation/parallel-worktree request authorize ordinary evidence-backed remediation under §7.4 and roadmap081 batch C. This records that scope, not approval of new dependencies, migrations, protected edits or a new currency product.

Evidence: price-actions replaces absent prices with zero and absent currencies with USD; portfolio-summary adds SGD and USD then labels SGD; holdings-table shows partial totals and substitutes missing FX with zero; distributions-section substitutes absent FX with one. Yield-on-cost divides converted SGD distributions by a USD denominator for US holdings. Missing quotes can produce spurious losses and annualised returns.

## Solution and scoped paths

- Equity price action: require reported finite price and currency; genuine zero remains valid. Retain authenticated, bounded/time-limited provider requests, no DB/encryption changes.
- Equity valuation helper: validate quote coverage and expected native currencies before valuation; preserve empty holdings as zero. Native market summaries avoid cross-currency arithmetic and mixed-currency IRR.
- portfolio-summary and holdings-table: visible missing/partial/loading/error states, native currency summaries, optional US display conversion only with actual rate. Provider/source age is not inferred from query cache time or a trading-session cutoff.
- distributions-section and yield-on-cost-table: retain recorded native rows when FX unavailable, do not use fabricated conversion, convert both income and cost denominator consistently when valid rate exists. Label current-rate estimates.
- Existing price/UI tests and new valuation/regression tests; scoped audit record. README and shared roadmap updates handled at root integration.

## Acceptance

- Missing/null price or currency does not create a quote; zero is retained.
- Partial/mismatched quote coverage never becomes a full market value or return.
- SGD/USD values are never added as a single SGD total; only native annualised returns are shown.
- Absent FX never yields zero or 1:1 converted balances; actual recorded rows remain usable.
- Regression tests fail against shipped behavior; all format/lint/typecheck/test/build gates in isolated synthetic fixture, every aggregate metric >80%, stricter security floors retained; second review.

## Risk and rollback

Presentation/read-only calculations only; revert batch commit. No dependencies, migrations, protected paths, crypto changes or secret access. No speed gains claimed. Original trade schema lacks explicit currency; existing SG/US ticker map is retained and mismatched provider quotes fail closed rather than guessing. Existing cost-accounting and IRR solver scope remain separately reviewed follow-ups.

## Skill and research

Impeccable harden and craft-floor applied in Operate mode against incumbent tokens/components: essential unavailable states visible, optional detail disclosures, native table rows preserved. Context script skipped because prior audit observed unrelated credential/cache discovery; owner privacy constraint prevails. No skill/harness changes. TemplateCentral/frontend-design unavailable in current catalog; no install assumed.

[SEC Investor.gov international investing](https://www.investor.gov/introduction-investing/investing-basics/investment-products/international-investing) confirms exchange-rate changes affect investment returns. [TanStack query reference](https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/UseQueryOptions) distinguishes query update/staleness metadata; it is not evidence of provider market freshness. Provider regularMarketTime, if present, is exposed as source time without claiming live coverage or imposing an unverified trading cutoff.

## Confirmed consumer expansion

Assets investment-math, investment-breakdown, investment-allocation and market-allocation-table share the same missing quote/mixed currency bugs. Include those paths, their tests, equity barrel exports and the dashboard-overview budget callback nullable type. Complete converted SGD budget estimates require real FX; withholding incomplete deployment cards clears downstream budgets while monthly/basic cash inputs remain. Current-rate conversion of historical spending is visibly an estimate. Add signed-flow/duration/NPV-residual IRR availability guard, without rewriting solver. Guard arithmetic overflow after conversion.

## Residual limits

The existing holdings ledger does not reconcile chronological partial sales and later purchases into a formal accounting cost basis; existing aggregate-buy averaging is retained, with remaining-share average cost used for unrealised P&L. This batch fixes currencies/availability, not tax-lot accounting. Newton IRR remains an existing solver; the availability wrapper requires duration, signed flows and a finite scale-relative solved NPV, but does not claim unique roots for non-conventional flows. Closed-market source timestamps are shown without an unsupported freshness cutoff.

## First full verification and correction

All 116 files / 908 tests passed and aggregate coverage remained above80%, but the stricter mwr.ts statements floor failed94.02% vs95%. Retain the floor; add meaningful invalid-date/nonfinite-flow and native-market isolation tests. Market enumeration moved to existing constants.ts to satisfy §3.2. Repeat gates before delivery; first build was correctly skipped on failed coverage.

## Final verification and independent confirmation

- All required `pnpm check`, `pnpm test:ci`, `pnpm build` gates passed in the isolated synthetic fixture (`084-reviewed-gates.log`). 116 files / 910 tests passed.
- Aggregate coverage: lines93.00%, statements92.72%, functions90.20%, branches87.53%. Existing stricter calculation/security floors unchanged; mwr.ts statements98.50%, branches97.87%, functions/lines100%.
- Four missing-price/currency regressions failed against the named shipped source c87dd36, then the verified fixture was restored byte-for-byte with SHA-256 equality (`084-red-baseline.log`). The corrected cases pass in the full suite.
- Independent review identified cached failed quotes/FX, same-day and unsolved IRR guesses, TTM-window relevance, post-conversion/percentage overflow, and fully-sold US quarter-spending assumptions. All identified in-scope findings were corrected and verified. Initial stricter coverage failure was corrected with meaningful invalid-data/native-market-isolation tests; no floor reduction.
- README and comments reviewed. A local synthetic browser fixture with real summary/holdings/yield components and compiled production styles is prepared for root's bounded desktop/mobile visual proof; authenticated transport and private production records are not claimed tested. No speed gain claimed.

## Deferred provider metadata contract

The unused change/changePercent fields still retain legacy previous-close fallback and overflow rejection behavior. Source consumers do not render these fields. Record a later provider-read/YAGNI contract review to remove unused metadata or represent absent change data explicitly without rejecting otherwise usable current prices. This does not expand the current release after verification. Historical partial-sale accounting and non-conventional IRR uniqueness remain the limits recorded above.

## Recorded affected files

- `README.md`
- `src/app/dashboard/(overview)/dashboard-overview.tsx` (nullable budget callback only)
- `src/features/assets/components/investment-allocation.tsx`
- `src/features/assets/components/investment-breakdown.tsx`
- `src/features/assets/components/market-allocation-table.tsx`
- `src/features/assets/lib/investment-math.ts`
- `src/features/equity/actions/price-actions.ts`
- `src/features/equity/components/distributions-section.tsx`
- `src/features/equity/components/holdings-table.tsx`
- `src/features/equity/components/portfolio-summary.tsx`
- `src/features/equity/components/yield-on-cost-table.tsx`
- `src/features/equity/constants.ts`
- `src/features/equity/index.ts`
- `src/features/equity/lib/mwr.ts`
- `src/features/equity/lib/valuation.ts`
- `test/features/assets/investment-interactions.test.tsx`
- `test/features/assets/investment-math.test.ts`
- `test/features/equity/equity-ui.test.tsx`
- `test/features/equity/price-actions.test.ts`
- `test/features/equity/valuation.test.ts`
- This audit record; shared roadmap/progress closeout remains root's delivery step.

## Root visual confirmation

The synthetic component preview passed at the default desktop viewport and 390×844 mobile viewport. Complete/native quotes, missing US quotes and missing FX preserve the recorded holdings and withhold incomplete derived values. The currency toggle responds to Enter outside the disclosure trigger. Both market disclosures retain rows; mobile document width equals scroll width (390px). Screenshots: `084-desktop-proof.jpg`, `084-mobile-proof.jpg` in the isolated local audit artifacts. The preview uses an anchor adapter for Next Link and fixed hook data; this proves layout, availability copy and disclosures, not authenticated routing, real provider transport or private production records. Temporary tab, viewport override and preview server were cleaned up. No application files changed after the green gate run.
