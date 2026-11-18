# Equity average-cost basis after partial sells

Owner-authorized remediation under CONSTITUTION §7.4 and AGENTS §1.5. Approval of findings is not claimed.

## Request and scope

Clarence authorized on 2026-11-19 an overnight remediation of high-confidence bugs only. Scope: `src/features/equity/lib/holdings.ts`, `test/features/equity/holdings.test.ts` and this record. No schema, dependency, protected-file or UI change.

## Finding

`computeHoldings` ignored sells when computing cost: `avgBuyPrice = totalBuyCost / totalBuyShares` (gross average of every buy) and `costBasis = totalBuyCost / shares` (cost of sold lots spread over the remaining shares). Buy 100@10 then sell 50 gave costBasis 20 instead of 10. Buy 100@10, sell 50, buy 50@30 gave avgBuyPrice 16.67 / costBasis 25 instead of 20.

## Evidence

- `src/features/equity/lib/holdings.ts` (previous lines 22-65): sells only decrement shares.
- `holdings-table.tsx` gain % uses `avgBuyPrice`; `portfolio-summary.tsx` P&L uses `avgBuyPrice * shares`; `dividend-metrics.ts` yieldOnCost and `dividend-breakdown.ts` use `costBasis * shares`. All overstate or misstate cost after any partial sell.
- `test/features/equity/holdings.test.ts` "costBasis only counts remaining shares after partial sell" asserted 200 for buy 10@100, sell 5, which encoded the bug.

## Change

Average-cost method with a running remaining cost: a buy adds `shares * price + fees`; a sell removes remaining cost in proportion to shares sold (sell fees do not change remaining cost); reaching zero shares resets cost so a rebuy starts fresh. Trades are sorted by date with input order as tiebreak because the method is order-dependent and callers do not sort.

Consumer decisions: `avgBuyPrice` and `costBasis` both become remaining cost per share, which every P&L, gain % and yield-on-cost consumer needs, so none of those files change. `totalBuyCost` and `totalBuyShares` stay gross historical buys, so the "Total Invested" card in `portfolio-summary.tsx` keeps its current figure; whether it should show remaining cost instead is ambiguous and left to the owner.

## Acceptance and rollback

Regression tests: buy-only unchanged, partial sell, buy/sell/buy blend, full sell then rebuy, buy fees included and sell fees ignored, out-of-order input. Five pnpm gates green. Rollback: revert the commit; no stored data changes.

## Follow-up

Finding: the first fix clamped running shares inside the walk and used localeCompare on dates, so share totals depended on same-day trade order (id is a TEXT key, not creation order). Nothing held, then buy 10 and sell 10 on one date with the sell listed first, left 10 shares where the plain sum gives 0.

Fix: `shares` is again the plain sum of buys minus sells; only the cost walk keeps a separate running count. The walk orders by parsed time (`Date.parse`), then buys before sells, then input order. Running shares under 1e-9 reset remaining cost to 0, and holdings at or below 1e-9 shares are excluded so float residue leaves no phantom holding. An oversell removes all remaining cost, and `avgBuyPrice`/`costBasis` are 0 when the walk holds nothing.

Tests: same-day sell-first full and partial, float-sized partial sells summing to the position, mixed date-only and ISO timestamp ordering.
