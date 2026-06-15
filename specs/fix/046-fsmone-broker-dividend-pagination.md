---
id: 046
slug: fsmone-broker-dividend-pagination
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.1' # UI: broker selectable for new trades; paginated dividend table
constitution_overrides:
---

# Spec 046: FSMone broker (manual fee) + dividend table pagination

## Problem

1. New trades can only pick `DBS Vickers` / `Moomoo`; FSMone is missing. FSMone's
   fees are tiered/complex (lower on sells) and are already captured per-trade, so
   it must be **selectable with no auto-fee** — currently the fee calc treats any
   non-DBS-Vickers broker as Moomoo, so adding FSMone naively would mis-price it.
2. The dividend table has no pagination, unlike the trade/expense tables.

## Constitution check

- Satisfies `§4.1` (UI completeness). Overrides: none. No migration, no new
  dependency.

## Solution shape

- `broker-fees.ts`: add `'FSMone'` to `BROKERS`. Make `calculateFees` return
  `FeeResult | null` with an **explicit** `Moomoo` branch and a `null` fallthrough,
  so FSMone (and any future listed broker without a formula) yields no auto-fee →
  the user types it. `resolveTradeFees` already returns `FeeResult | null`.
- `trade-form.tsx`: extend the SG auto-CDP tick to FSMone as well as DBS Vickers
  (the owner buys SG into CDP on both).
- `dividend-table.tsx`: add `page`/`pageSize` state + slice + `PaginationControls`
  (mirror `TradeTable`).

## Out of scope

- FSMone fee formulas (manual by design — fees already captured).
- CDP backfill of existing SG trades and the "live fee" idea (separate threads).

## Acceptance

- [ ] `pnpm check` / `pnpm build` green
- [ ] `pnpm test:ci` green — `resolveTradeFees('FSMone', …)` returns null;
      DBS Vickers / Moomoo unchanged
- [ ] Manual: new trade can pick FSMone (fee field stays manual); SG FSMone trade
      auto-ticks CDP; dividend table paginates
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: broker fee calc (explicit branch — behavior preserved for
  DBS Vickers/Moomoo) + two presentational changes.
- **Reversibility**: single `git revert`.

## Open questions

- [ ] Q: none.
