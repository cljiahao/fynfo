---
id: '105'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies: ['§2.1', '§3.2', '§4.2', '§4.4', '§7.4', '§8.2']
---

# Trade-history inferred currency consistency

## Owner authorization and evidence before edits

Clarence's ordinary audit/remediation and parallel worktree request authorize this correction under §7.4. Root reviewed the external105 proposal and actual mounted failing regression on2026-10-10, then selected existing getMarket/formatCurrency consistency with visible inference/no-FX copy, gross-value labeling and nonfinite derived-output guard. Base03de9f96ed740907d2ef07ea53b5b414de3ce649. No stored currency, mapping, fee, holdings/accounting, provider, schema/migration, dependency, crypto or protected-file change; no private data/env/account/provider access.

TradeTable renders all recorded price/fees/gross totals with formatSGD, while TradeForm/TradeFeeBreakdown/TradeSummary already use the ticker-mapped native SGD/USD convention. EquityTradeData stores no currency; getMarket recognizes named SG aliases and defaults all other symbols to US, including unsupported/raw.SI symbols. This is a display convention, not proof of historical settlement currency. No current or historical FX conversion is justified. Shares times finite positive price may overflow and must not display Infinity.

External105 actual mounted AAPL price100/fees3/shares2 regression against unchanged source failed the expected US$100 assertion without import/setup failure (105-trade-currency-red.log). The owner has not separately approved currency persistence or a broader market mapping; this batch must not imply otherwise.

## Affected paths and changes

src/features/equity/components/trade-table.tsx; new test/features/equity/trade-history-currency.test.tsx; this audit and README concise durable inference limitation. Use existing getMarket and formatCurrency per row for recorded prices/fees/gross values, label Total as Gross value, render unavailable for nonfinite gross multiplication. Visible helper: Currency inferred from ticker mapping (SGD/USD); check your trade statement. No FX conversion. Keep actual zero-fee contract, pagination/edit/delete callbacks and underlying data/math unchanged. No form, mapping, action, hook or query change.

## Acceptance and rollback

Meaningful mounted baseline failures for mixed US/SG formatting and inference/gross/unavailable copy; regressions cover mixed rows, both buy/sell gross rather than fee-adjusted value, zero fee, pagination and actual edit/delete callbacks, overflow and unknown/raw.SI disclosure without a verified-currency claim. Existing form summaries remain unchanged. Targeted verification uses only isolated synthetic fixture; full gates wait the shared heavy-verification slot. Each aggregate metric above80% and stricter floors unchanged. Independent second review, actual-component desktop/mobile synthetic proof, README/comments and normal hooks before commit/PR; exact required green CI before merge. Rollback is a scoped revert with no data reversal.

## Guidance and residuals

Impeccable Operate/harden/craft-floor: incumbent table/tokens, essential material inference visible, accessible controls and mobile overflow reviewed; no new primitives or decorative layout. Project next-verify gates retained. Existing helper/form implementation is the source of this bounded convention; no external market accuracy/FX/fee claim introduced. Unsupported markets, actual historical settlement currency, cost basis and fee-adjusted accounting remain separate recorded contracts. No claim that105 verifies every historical trade. Unavailable catalog skills are not claimed used; no harness or skill edit.

## Results

Mounted baseline: four expected behavior failures and one zero-fee control pass (105-red.log). Corrected focused suite: two files/42 tests passed, including five new currency/gross/overflow/inference cases and37 incumbent equity UI cases exercising actual callbacks/forms (105-focused.log). README records the durable inference/gross-value limitation; no new inline narration added. Impeccable detector returned[]. Independent read-only review by latency agent found no scoped blocker: mapping qualification, native formatting, gross versus fee separation, multiplication guard and unchanged callbacks/pagination.

Root synthetic browser desktop proof passed mixed labels, edit callback, overflow and pagination. Initial390px mobile captures appeared narrow; root traced this to tab.screenshot capture API rather than product layout. Actual DOM root/main390, h1/card342, header/content340, with no zoom/transform; getScreenshot returned proper390px viewport evidence (105-trade-mobile-proof.jpg), inspected by this agent too. Inference helper readable; table retains existing cramped columns and horizontal scrolling with document width390. External preview wrapper now matches actual page w-full contract; no product layout changes. These are actual-component synthetic-row checks, not full Next/auth/private workflows. Root closed tabs/reset viewport and owns server cleanup. Final built105 CSS/local fonts refreshed; one final proper getScreenshot remains pending root confirmation.

All five gates passed in the released shared slot (105-gates.log):129 files/1101 tests; statements93.51%, branches89.16%, functions91.12%, lines93.80%; stricter floors unchanged and optimized build green. Root confirmed101 does not alter TradeTable; no overlapping date change needs integration. Normal hooks/CI and merge remain pending; not shipped.
