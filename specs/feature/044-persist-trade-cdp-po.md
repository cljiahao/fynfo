---
id: 044
slug: persist-trade-cdp-po
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§2.1' # is_cdp/is_po are non-financial flags — plaintext, like broker/action
  - '§2.3' # write path stays inside the guarded server actions
  - '§4.2' # extends the action tests
constitution_overrides:
---

# Spec 044 (feature): Persist CDP / Preferential-Offering flags on trades

## Problem

`isCdp` and `isPO` are entered when adding a trade and drive the fee calc, but they
are not stored (`EquityTradeData` has no such fields). On edit they always default
to unchecked, so the form no longer reflects whether a trade was CDP-settled or a
Preferential Offering. Fees are unaffected (the computed `fees` value is saved), but
the edit form is misleading. Persisting the two flags makes edit faithful and lets
the app show a trade's CDP/PO status.

## Constitution check

- Satisfies `§2.1` (the flags are non-financial booleans — plaintext, consistent
  with `broker`/`action`/`date`; no amounts/tickers exposed), `§2.3` (writes stay in
  the guarded `createTrade`/`updateTrade`), `§4.2` (tests). New **additive** migration
  (two columns with defaults) — not destructive, not a §0 stop.

## Solution shape

### Migration — `supabase/migrations/20260616000000_add_trade_cdp_po.sql`

```sql
ALTER TABLE "public"."equity_trades"
  ADD COLUMN "is_cdp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_po"  BOOLEAN NOT NULL DEFAULT false;
```

### Types / schema

- `EquityTradeData` gains `isCdp: boolean`, `isPO: boolean`.
- `equityTradeInputSchema` gains `isCdp` / `isPO` (`z.boolean().default(false)`).

### Actions — `equity-actions.ts`

- `createTrade` / `updateTrade`: write `is_cdp` / `is_po` from the input.
- `getTrades`: map `is_cdp` → `isCdp`, `is_po` → `isPO`.

### Form — `trade-form.tsx`

- `buildTradeFormDefaults(editTrade)`: restore `isCdp: editTrade.isCdp ?? false`,
  `isPO: editTrade.isPO ?? false` (instead of hardcoded `false`).
- `onSubmit`: include `isCdp` / `isPO` in the saved payload.

### Backfill (owner runs in Supabase SQL editor — handed over, not auto-run)

`ticker` is encrypted so trades can't be matched by ticker in SQL; match the three
known Preferential Offerings by plaintext `date` + `broker`. Verify the SELECT hits
exactly 3 rows first, then UPDATE:

```sql
select id, date::date, broker from equity_trades
where broker ilike 'vickers' and date::date in
  ('2020-10-27','2021-12-22','2022-04-13');
-- if exactly the 3 expected rows:
update equity_trades set is_po = true
where broker ilike 'vickers' and date::date in
  ('2020-10-27','2021-12-22','2022-04-13');
```

CDP backfill is not scripted — market (SG/US) derives from the encrypted ticker, so
SQL can't tell CDP-eligible rows apart; tick CDP per trade via the (now faithful)
edit form, or bulk-set if every Vickers position is CDP.

## Out of scope

- Changing fee calculation or re-deriving fees on edit (fees stay as saved).
- The dividend-import 500 (tracked separately) and the Vickers→DBS-Vickers fee
  mapping (separate small fix).

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green — `createTrade`/`updateTrade` persist the flags;
      `getTrades` maps them back
- [ ] `pnpm test:coverage` green
- [ ] `pnpm build` green
- [ ] Manual (after migration applied): edit a CDP trade and the P/O trades → the
      checkboxes reflect the saved state; saving keeps them
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: additive columns + the trade write/read/form. No effect on fees
  or existing rows (default false).
- **Reversibility**: revert the impl commit; drop the two columns. Backfill is a
  data UPDATE the owner can reverse.
- **Backout plan**: revert + `ALTER TABLE ... DROP COLUMN is_cdp, DROP COLUMN is_po`.

## Open questions

- [ ] Q: none.
