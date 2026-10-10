---
id: '090'
slug: dividend-history-entitlement
area: audit
status: shipped
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/20
author: Codex
created: 2026-10-10
constitution_satisfies: ['§2.1', '§2.3', '§3.1', '§4.1', '§4.2', '§7.4', '§8.2']
constitution_overrides: []
---

# Historical dividend scan entitlement

## Problem and owner authorization

Clarence's sequential roadmap and 2026-10-10 parallel-worktree request authorize this ordinary remediation under §7.4 and roadmap081 batch N. The existing spec042 scan only fetches current holdings, omitting historical distributions for fully sold positions. Its inclusive share calculation counts ex-date purchases and removes ex-date sales. Finite trade/DPU inputs can also overflow candidate amounts. This record documents the scope before implementation; it does not grant new provider access or change persistence contracts.

## Constitution check

Preserve existing auth, encrypted mutations and feature boundaries (§2.1/§2.3). Use pinned dependencies and existing components (§3.1). Meaningful regressions, full gates and independent review satisfy §4.1/§4.2 and owner remediation §7.4. No protected files, dependency, migration or crypto changes (§8.2). No soft overrides.

## Solution shape and affected paths

- `src/features/equity/lib/dividend-scan.ts`: derive distinct normalized historical trade tickers rather than current holdings; reconstruct finite, positive candidates from shares before each supplied ex-date, preserving ticker/date dedupe and existing market inference.
- `src/features/equity/lib/dividend-suggest.ts`: add an explicit before-ex-date helper with a recorded calendar-day contract. Keep `sharesHeldAsOf` inclusive and its existing manual Suggest consumer unchanged.
- `src/features/equity/components/dividend-scan-dialog.tsx`: use historical tickers and existing concurrency limit for provider requests; cancellation prevents stale results and stops scheduling new requests. Keep explicit review/selection before existing import actions; filter non-finite edited amounts.
- `test/features/equity/dividend-scan.test.ts`, `dividend-suggest.test.ts`, `equity-ui.test.tsx`: sold-position, ex-date boundary, finite arithmetic, dedupe, bounded request and cancellation regressions.
- `README.md` and this record, coordinated with root: explain trade-history scope, five-year feed window, pre-ex-date share estimates and retained date/source limitations.

The existing client dialog remains client-side for interactions/hooks. Pure helper interfaces change only their internal callers and tests. No stored records are modified until the user selects Add through the existing encrypted action.

## Research and UI guidance

[Investor.gov ex-dividend guidance](https://www.investor.gov/introduction-investing/investing-basics/glossary/ex-dividend-dates-when-are-you-entitled-stock-and) states purchases on/after a supplied ex-date do not receive a normal dividend; the seller receives it. [DBS Singapore corporate-actions guidance](https://www.dbs.com.sg/personal/investments/equity-trading/corporate-actions) confirms purchase-before-ex-date and separates record/payment dates. Use supplied dates without deriving settlement calendars. Compare the calendar day recorded in each trade, including full timestamps, rather than accidentally counting same-day midnight trades.

Impeccable harden/craft-floor guidance is applied narrowly to existing dialog copy: material assumptions visible, supplementary detail concise, existing design tokens and accessible controls retained. No new control or layout is needed. Previously read guidance is reused; no skill installation or harness changes.

## Out of scope and residual limitations

Current holdings, yield-on-cost and any planning/forecast contracts remain unchanged. Manual Suggest's inclusive/payment-date and nearest-event behavior remains for a separate evidence/date contract. The existing Yahoo action supplies five years and returns empty on failure; source permission, empty-versus-failure metadata, independently verified event currency and actual payment dates are roadmap O/P. Scanned ex-dates currently share the stored payment-date field and cannot reliably dedupe manual payment-date rows; this historical spec042 limitation remains visible. Splits, transfers, short sales, incomplete history, special distributions/due bills, withholding and unknown ticker-market inference are not verified entitlement. Do not invent payment dates or claim exact received amounts.

## Acceptance

- Historical fully sold tickers are fetched and yield valid earlier candidates; later ex-dates after disposal are excluded.
- Purchases on an ex-date are excluded; sales on it retain earlier shares; earlier partial disposals reduce shares. SG and US fixtures cover the same supplied-date contract.
- Calendar timestamps, case normalization, no history, duplicates, invalid dates and non-finite/overflow arithmetic cannot yield an invalid candidate or import payload.
- Existing edit/select/import/error/unmount behavior passes; historical scan concurrency remains bounded.
- Meaningful red proof against shipped component/source, targeted tests, `pnpm check`, `pnpm test:ci`, `pnpm build`, every aggregate coverage metric above 80% and unchanged security floors.
- Independent second review and synthetic UI proof before PR delivery. No shipped status until merge.

## Risk and reversibility

Only reconstructed estimates and scan request scope change. More historical tickers may require more requests, bounded by the existing concurrency limit; no latency improvement is claimed. User-reviewed existing inserts are unchanged. Roll back with a single batch commit revert; no migration or automatic data rewriting.

## Open questions

No implementation-blocking question remains for normal cash-distribution estimates using supplied ex-dates. Evidence/payment-date/source contracts remain separate and explicitly unresolved.

## Targeted verification — 2026-10-10

Typecheck and all 69 tests across dividend scan, dividend suggestion and mounted equity UI passed in the isolated synthetic fixture (`090-targeted.log`). The first run caught one stale loading-copy expectation; that assertion was updated. A second self-review added a guard and regression stopping queued requests after a thrown fetch failure.

Three mounted workflow regressions failed against shipped source: a fully sold position had no historical candidate, an ex-date purchase incorrectly produced a candidate, and an ex-date sale removed the earlier entitlement. This exercised existing component behavior, without a new-module import failure. All three corrected product files were restored byte for byte and checked against saved SHA-256 hashes (`090-red-baseline.log`). Full gates, independent review and browser proof remain pending; no release claim is made.

`MAX_PRICE_TICKERS` bounds the separate batch quote action. The existing dividend action accepts one validated ticker per request, so all distinct historical tickers are processed with at most `MAX_PRICE_CONCURRENCY` (five) active requests. History is not silently truncated. Cancellation and thrown failures stop scheduling more work; the retained empty-on-provider-failure limitation remains unresolved.

## Final local verification and second review — 2026-10-10

The isolated synthetic fixture passed `pnpm check`, `pnpm test:ci` and `pnpm build` (`090-final-gates.log`). All 117 test files and 938 tests passed. Aggregate coverage: statements 92.79% (3568/3845), branches 87.78% (2257/2571), functions 90.23% (1137/1260), lines 93.06% (3288/3533). Existing coverage floors are unchanged. Only placeholder inline configuration was used; no production accounts, records or provider endpoints were accessed.

The parent completed an independent source review of the corrected historical ticker set, strict pre-ex-date shares, finite amounts, canonical dedupe, bounded worker scheduling, cancellation/failure stops and visible source/date assumptions. No blocking finding remained within the recorded scope. No measured latency improvement is claimed: reconstruction still scans trade history per event, and any indexing optimization requires a later benchmark.

Candidate currency retains the existing SG/US ticker-classification inference, rather than provider-reported event currency. SG-listed USD-denominated products remain unsupported by this currency contract. Users must cross-check currency, dates and amounts; these are gross historical estimates, not verified received income. Provider-reported currency, market-time conversion, independently verified ex-dates, payment dates and empty-versus-failure metadata remain roadmap O/P contracts. Root-owned README integration and the synthetic browser proof below are complete. This record is not marked shipped.

## Synthetic browser proof — 2026-10-10

The parent checked the actual scan dialog in the external preview with a deterministic feed and memory-only mutation. A fully sold position retained its earlier 100-share, 20 estimated distribution. Editing to 26.50, unchecking/rechecking selection and Add produced one memory row with amount 26.5; unchecking disabled Add. A first purchase on the ex-date yielded no candidate, while a full sale on that date retained the earlier 100-share, 20 estimate. Desktop and 390px mobile checks showed no horizontal overflow. Evidence: `090-dividend-desktop-proof.jpg` and `090-dividend-mobile-proof.jpg` in the external visualization directory.

The preview reused the actual component, helpers, controls and compiled styles, with synthetic `fetchDividends`, memory-only `useCreateDividends` and a standalone Next Link adapter. It does not verify authenticated persistence, production routing, market-provider accuracy or actual payments. The temporary tab, viewport and server were cleaned up. README now describes historical coverage and currency/date/payment cross-checks. No product behavior changed after the passed full gates.
