---
id: 039
slug: dividend-tracking
area: feature
status: draft # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by:
created: 2026-06-15
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§2.1' # dividend ticker + amount AES-256-GCM encrypted before Supabase
  - '§2.3' # actions call requireUserId() then getVaultDekSession() (requireActionContext)
  - '§2.2' # mutations via server actions only; Yahoo read stays in price-actions
  - '§5' # new table ships per-user RLS policies
constitution_overrides:
---

# Spec 039 (feature): Dividend / distribution tracking

## Problem

The equity tracker records buy/sell trades but not the **income** those holdings
throw off. For a REIT-heavy portfolio (the ticker map is almost all SG REITs)
distributions are the whole point — the app currently cannot answer "what passive
income did I receive, and is it growing?" v1 adds manual distribution entry (the
amount that actually hit the bank = source of truth), a Yahoo-powered auto-fill
assist, and three read views: income timeline, total + per-ticker breakdown, and
yield-on-cost. Forward-yield estimate is deferred.

## Constitution check

- Satisfies `§2.1` (dividend `ticker` + `amount` encrypted via `encryptPayload`
  before any DB write; `currency` + `date` stay plaintext metadata, consistent with
  `equity_trades` where `date`/`broker`/`action` are plaintext), `§2.3` (every
  dividend action goes through `requireActionContext()` = `requireUserId()` →
  `getVaultDekSession()`), `§2.2` (mutations are server actions; the Yahoo dividend
  read lives in `price-actions.ts` alongside the existing quote fetch, requiring only
  `requireUserId()` — public market data, no vault), and `§5` (new table ships RLS).
- Overrides: none. **No new dependency** (reuses Yahoo `fetch`, recharts, React
  Query). New **additive** migration (CREATE TABLE + RLS) — not destructive, so not a
  §0 hard-stop; ships in `supabase/migrations/`.

## Solution shape

### Data model — `supabase/migrations/20260615000000_add_equity_dividends.sql`

`equity_dividends`:

| column                      | type              | notes                                           |
| --------------------------- | ----------------- | ----------------------------------------------- |
| `id`                        | uuid PK           |                                                 |
| `user_id`                   | uuid → auth.users | RLS scope                                       |
| `ticker`                    | text              | **encrypted** (AES-GCM)                         |
| `amount`                    | text              | **encrypted** — native-currency amount received |
| `currency`                  | text              | plaintext, `SGD` / `USD`                        |
| `date`                      | date              | plaintext — payment date                        |
| `created_at` / `updated_at` | timestamptz       |                                                 |

RLS: owner-only select/insert/update/delete keyed to `auth.uid() = user_id`
(mirror the `equity_trades` policies exactly).

### Types / schema — `features/equity`

- `DividendData = { id; ticker; amount; currency: 'SGD' | 'USD'; date }`.
- `dividendInputSchema` (Zod): `ticker` non-empty, `amount` > 0, `currency` enum,
  `date` `YYYY-MM-DD`.

### Server actions — `features/equity/actions/dividend-actions.ts`

- `getDividends(): DividendData[]` — `requireActionContext()`, decrypt ticker+amount,
  throw opaque on read error (spec 032 pattern).
- `createDividend(data)` / `updateDividend(id, data)` — `parseOrThrow` →
  `requireActionContext()` → encrypt ticker+amount → insert/update.
- `deleteDividend(id)` — `requireDbContext()`, scoped delete, opaque error.

### Yahoo auto-fill — extend `features/equity/actions/price-actions.ts`

- `fetchDividends(ticker): Array<{ exDate: string; dpu: number }>` —
  `requireUserId()`, `getYahooSymbol`, hit
  `/v8/finance/chart/{symbol}?range=5y&interval=1d&events=div`, parse
  `chart.result[0].events.dividends` → `{ amount, date }`; empty array on any
  `!res.ok` / missing / throw (same defensive shape as `fetchStockPrices`).

### Pure suggest logic — `features/equity/lib/dividend-suggest.ts` (IO-free, tested)

- `sharesHeldAsOf(trades, ticker, date): number` — `Σ buy.shares − Σ sell.shares`
  for that ticker with `trade.date <= date`.
- `suggestAmount(dpu, sharesHeld): number` — `dpu × sharesHeld`. The add form's
  "Suggest" button: pick the Yahoo ex-date nearest the entered date, multiply by
  `sharesHeldAsOf`, pre-fill the (editable) amount.

### Yield-on-cost — `features/equity/lib/dividend-metrics.ts` (IO-free, tested)

- `yieldOnCost(dividendsSGD, holding): number` — trailing-12-month SGD distributions
  for the ticker ÷ `holding.costBasis`.
- `toSGD(amount, currency, usdSgdRate)` helper; income timeline + totals sum the
  SGD-converted amounts. USD→SGD via the existing `fetchExchangeRate('USD','SGD')`
  hook; if the rate is unavailable, show native totals split by currency rather than
  a wrong blended number.

### UI — equity page gets a "Distributions" section

- `useDividends` hook (React Query) in `features/equity/hooks`.
- `DividendForm` (add/edit dialog, with Suggest button), `DividendTable`
  (list + delete), `DividendIncomeChart` (recharts bars by year), `YieldOnCostTable`
  (per holding). Composed into a new section on `dashboard/equity/page.tsx` (follow
  the existing in-page hook pattern; no new page route in v1).

## Out of scope

- Forward-yield / projected-income estimate (fast-follow).
- acciaux integration (coverage + deploy-topology; separate idea).
- Auto-detection / bulk import of all historical dividends.
- Per-payment withholding-tax modelling; DRIP; scrip dividends.
- Editing currency conversion history — a single live USD→SGD rate is fine for v1.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green — action tests (encrypt/decrypt/opaque), `dividend-suggest`
      (`sharesHeldAsOf` boundary + sell cases), `dividend-metrics` (yield-on-cost +
      SGD conversion), `fetchDividends` (fetch mock: parse / empty / `!ok`)
- [ ] `pnpm test:coverage` green; new action + lib files per-file gated
- [ ] `pnpm build` green
- [ ] Manual: add a distribution (manual + via Suggest), see it in the table,
      timeline, and yield-on-cost; delete it; USD entry converts into the SGD total
- [ ] RLS verified: a second user cannot read/write another's dividend rows
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: additive — new table + new equity-feature surface. No change to
  trades, holdings, or crypto. Encryption path reuses `encryptPayload`/`requireActionContext`.
- **Reversibility**: revert the impl commit; drop the (additive, empty) table via a
  follow-up migration. No data loss to existing features.
- **Backout plan**: feature is self-contained in `features/equity` + one page section;
  revert + drop-table migration.

## Open questions

- [ ] Q: Payment-date vs ex-date as the stored `date`? — Owner: Clarence — A: default
      **payment date** (matches "what hit my bank"); Suggest still matches against
      Yahoo ex-dates internally.
- [ ] Q: Allow currencies beyond SGD/USD in v1? — Owner: Clarence — A: default no —
      enum `SGD|USD` only (covers current holdings); widen later if needed.
