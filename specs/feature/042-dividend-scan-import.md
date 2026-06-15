---
id: 042
slug: dividend-scan-import
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16 # Clarence chose "review then bulk-add"
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§2.1' # bulk-inserted dividends encrypted before Supabase
  - '§2.3' # bulk action self-guards (requireActionContext)
  - '§4.2' # ships tests for the candidate builder + bulk action
constitution_overrides:
---

# Spec 042 (feature): Dividend scan + bulk import from trade history

## Problem

Spec 039 ships manual entry + a one-row "Suggest". But the data to reconstruct
past distributions already exists: trades give shares-held-at-any-date, and Yahoo
gives ex-dates + DPU per ticker. So the app can compute every past distribution for
held positions and let the user import them in one pass instead of typing each.
Amounts remain Yahoo estimates (no withholding tax / special-distribution
adjustment), so the user reviews + edits before import — they stay the source of
truth.

## Constitution check

- Satisfies `§2.1` (every imported row's `ticker`+`amount` encrypted via the
  existing `createDividend` path), `§2.3` (the bulk action runs
  `requireActionContext()` first), `§4.2` (tests for the pure candidate builder +
  the bulk action). Overrides: none. No migration, no new dependency (reuses Yahoo
  `fetchDividends`, `sharesHeldAsOf`, recharts/RQ).

## Solution shape

### Pure lib — `features/equity/lib/dividend-scan.ts` (IO-free, tested)

- `buildDividendCandidates(trades, holdings, pointsByTicker, existing)` →
  `Array<{ ticker; date; dpu; shares; amount; currency }>`:
  - for each holding, for each Yahoo `DividendPoint`: `shares = sharesHeldAsOf(...)`;
    skip if `shares <= 0`; `amount = round(dpu * shares, 2)`; `currency` from
    `getMarket(ticker)` (`SG→SGD`, `US→USD`); `date = exDate`.
  - **dedupe**: drop a candidate whose `ticker` + `date` already exists in
    `existing` (so re-scans don't duplicate).
  - sort by date descending.

### Bulk action — extend `dividend-actions.ts`

- `createDividends(rows: Omit<DividendData,'id'>[])`: `parseOrThrow` each via
  `dividendInputSchema`, `requireActionContext()`, encrypt ticker+amount, single
  array `insert`. No-op on empty. Opaque error on failure.

### Hook — `useCreateDividends` (bulk) in `use-dividends.ts`

- Mutation calling `createDividends`, invalidates the dividends key.

### UI — `DividendScanDialog` + a "Scan" button in `DistributionsSection`

- "Scan" button (next to Add) opens the dialog. On open: `computeHoldings(trades)`,
  fetch `fetchDividends(ticker)` for each holding in parallel, run
  `buildDividendCandidates`, show a loading state during the fetch.
- Review table: per candidate row — checkbox (all checked by default), ticker,
  ex-date, DPU, shares-held, **editable amount**, currency. Footer: "Add N
  selected" → `useCreateDividends` with the selected rows, toast, close.
- Empty state when nothing new is found (e.g. all already imported / no Yahoo data).

## Out of scope

- Withholding-tax / special-distribution / scrip / DRIP modelling — estimates only.
- Reconciling ex-date (scanned) vs payment-date (manual) entries — dedupe is by the
  stored `date`; a manual payment-date row may not dedupe against an ex-date scan
  (acceptable; user edits/deletes).
- Forward-yield projection (separate fast-follow).

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green — `dividend-scan` (skip-zero-shares, dedupe, currency,
      amount rounding) + `createDividends` (bulk encrypt/insert, parse-reject,
      opaque, empty no-op)
- [ ] `pnpm test:coverage` green; new lib + action per-file gated
- [ ] `pnpm build` green
- [ ] Manual: Scan → review list of computed distributions for held tickers →
      adjust an amount → Add selected → rows appear in table/chart/yield; re-scan
      shows them deduped out
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: additive — new lib + dialog + bulk action; reuses the encrypted
  write path. No change to existing dividend/trade behavior.
- **Reversibility**: single `git revert`. Imported rows are normal dividend rows the
  user can delete.
- **Backout plan**: revert the commit.

## Open questions

- [ ] Q: none.
