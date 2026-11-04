---
id: 172
slug: equity-ticker-dividend-autoscan
area: feature
status: shipped
author: builder (Claude)
created: 2026-11-04
approved:
shipped: 2026-11-05
impl_pr: https://github.com/cljiahao/fynfo/commit/e3e62420f3223ae2400fc8e8c8563244c98e90ef
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§5.4'
  - '§6.3'
constitution_overrides: []
---

# Spec 172: Equity numeric inputs, ticker picker, dividend scan hardening and post-unlock auto-scan

## Problem

1. Clearing Shares or Price in the trade form yields `0`, and typing `3500` shows `03500`: `trade-form.tsx:363-386` and `:390-400` register `setValueAs` (`'' -> 0`) with a controlled `value`, and submit re-coerces at `:145-146`. `relief-row.tsx:198-205` has the same `Number(e.target.value) || 0` pattern. `salary-form.tsx:184,206` spread RHF `field` into `type="number"` inputs (salary/bonus) and coerce with `Number(...) || 0` at `:107-108`; whether they show the leading-zero symptom must be confirmed during implementation.
2. Ticker is free text (`trade-form.tsx:210-223`, `schemas.ts:4,20-23`). `ticker-map.ts:2-17` hardcodes 14 SG tickers; `getMarket()` (`:26-30`) returns SG only for mapped names, so any other SG ticker is treated as USD (wrong currency and CDP flag at `trade-form.tsx:85-88`, wrong dividend currency at `dividend-scan.ts:33`) and gets no Yahoo `.SI` symbol.
3. The dividend scan (`dividend-scan-dialog.tsx:56-114`) fails entirely if one ticker fails (`:83-86`, `:108-111`). Ex-dates are UTC day slices (`price-actions.ts:203`, `dividend-suggest.ts:31-37`), so SG/US exchange dates can be off by one day. The dedupe key is `TICKER|date` (`dividend-scan.ts:25-27,42`) and manual entries use the payment date, so ex-date candidates duplicate them. A malformed trade makes `sharesHeldBeforeExDate` return `null` and `dividend-scan.ts:37` silently skips the ticker.
4. The owner wants dividends picked up automatically after vault unlock, without a confirmation step.

## Constitution check

- Satisfies: `§2.1` (market and ticker stay encrypted; no plaintext financial column added), `§2.2` (writes through server actions only), `§2.3` (new action calls `requireUserId()` then `getVaultDekSession()`), `§2.4` (pages compose features), `§3.1` (no new dependency; RHF + Zod kept), `§3.2` (no `any`, no inline styles, no manual shadcn install), `§3.4` (file naming), `§4.1` (gates), `§5.4` (no SQL filtering on encrypted columns), `§6.3` (no migration in the recommended path).
- Overrides: none. The auto-scan is a server action called from `vault-unlock-flow.tsx`, not a new API route (`§2.2`, `§3.3`).
- `AGENTS.md` §4: errors are opaque; detail is logged server-side only.

## Solution shape

### A. Shared numeric input (item 1)

- New shared component (named export, under `src/components/`, not a shadcn primitive) wrapping `Input`. It holds the raw string while editing, emits `number | null` (`null` when empty or non-finite) via `onValueChange`, and normalizes on blur. Pure parser `parseNumericInput(raw: string): number | null` in `src/lib/utils/` for unit testing.
- Apply to trade-form Shares and Price (Fees too if it shows the symptom), relief-row amount (`relief-row.tsx:198-205`; the field must not force `0` when empty), and salary-form salary/bonus if the symptom reproduces.
- `schemas.ts:22-23` already rejects `0` for shares/price; submit shows the field error for empty input instead of coercing. Remove the `|| 0` coercions at `trade-form.tsx:145-146`.

### B. Ticker picker and per-trade market (item 2)

- `src/components/ui` has `popover.tsx`, `input.tsx`, `select.tsx` but no `command.tsx`. Build the combobox from `Popover` + `Input` + a filtered `<ul role="listbox">`. `npx shadcn@latest add command` would add `cmdk` (Open question 2).
- Options are the distinct tickers from the user's own trades (already decrypted client-side), filtered by typed text. A final "Add new ticker" option reveals a ticker input plus an explicit SG/US `Select`. Choosing an existing ticker fills its market.
- Market storage, recommended (no migration): `equity_trades.ticker` is an encrypted column (`equity-actions.ts:60,89`). Encode the market inside the encrypted value as `SG:<TICKER>` or `US:<TICKER>`; decode in the read path of `equity-actions.ts` into `EquityTradeData.market?: 'SG' | 'US'`. Rows without a prefix decode to `market: undefined` and fall back to the legacy map. `TICKER_RE` (`schemas.ts:4`) already permits `:`, but the schema must validate prefix and body separately, and the 16-char limit applies to the body.
- Alternative: a nullable plaintext `market` column on `equity_trades` (`check in ('SG','US')`) via a forward-only migration (`§6.3`; the table already has RLS, `§5.2`). It exposes the SG/US split to Supabase operators (`is_cdp` is already plaintext, `equity-actions.ts:65`) and REQUIRES separate owner approval before implementation.
- `ticker-map.ts`: add `deriveYahooSymbol(ticker, market)` (SG -> `<ticker>.SI`, US -> as is; legacy map entries win for internal names such as `SASSEUR`) and `resolveMarket(trade)` (explicit `market`, else legacy `getMarket`). `SG_TICKER_MAP` stays only as the legacy fallback.
- Currency and CDP default derive from `resolveMarket`; dividend currency at `dividend-scan.ts:33` uses the trade's market.

### C. Dividend scan correctness (item 3)

- Exchange-local ex-date: convert the Yahoo timestamp with `Intl.DateTimeFormat('en-CA', { timeZone })` using `Asia/Singapore` (SG) or `America/New_York` (US) in `price-actions.ts:203`. Share-holding comparison in `dividend-suggest.ts` stays on `YYYY-MM-DD` strings (buys minus sells strictly before ex-date, unchanged).
- Dedupe rule in `dividend-scan.ts`: a candidate is a duplicate if an existing dividend has the same ticker, `|existing.amount - candidate.amount| <= max(0.02, 2% of candidate.amount)`, and `existing.date` lies within [ex-date - 3 days, ex-date + 60 days] (covers ex-date entries and the usual 2-6 week payment lag). An exact same-date, same-ticker match is always a duplicate. Each existing row matches at most one candidate (nearest date first) so monthly payers are not swallowed.
- Failure isolation: per-ticker `fetchDividends` failures are collected and the scan continues. Result `{ candidates, skipped: { ticker, reason: 'fetch' | 'malformed-trade' | 'currency-mismatch' }[] }`. The dialog shows a "Skipped: X, Y" summary; the error state is used only when every ticker failed.
- Malformed trades are returned in `skipped` (`malformed-trade`) instead of being dropped at `dividend-scan.ts:37`.
- Currency check: `fetchDividends` also returns Yahoo `meta.currency` when present; a mismatch with the trade-derived currency skips the ticker (`currency-mismatch`). Absent currency passes.

### D. Post-unlock auto-scan (item 4)

- New server action `autoScanDividends()` in `src/features/equity/actions/dividend-actions.ts`: `requireUserId()` then `getVaultDekSession()`, load and decrypt trades and dividends, run the hardened scan (C), insert only non-duplicate candidates through the existing insert path (cf. `createDividends`, `dividend-actions.ts:56`), return `{ added: number }`. Detail is logged server-side; the client gets an opaque result.
- Trigger: after `res.ok` in `vault-unlock-flow.tsx:118-127`, call the action fire-and-forget (not awaited, wrapped in try/catch) so unlock is never delayed or failed. Toast "Added N dividends" when `added > 0`; invalidate the dividend React Query keys.
- Throttle at most once per 24h per user. Recommended: `loadLocal`/`saveLocal` (`src/lib/utils/local-store.ts`) key `fynfo:divscan:last:<userId>`, written only after a completed scan. Trade-off: per device, so another device may scan once more; the dedupe rule prevents duplicates, so the cost is one extra Yahoo round trip. No migration. Pure helper `shouldAutoScan(lastIso, nowMs)`.
- The manual scan dialog stays and uses the same hardened core.
- The Yahoo chart endpoint is unofficial and unthrottled; the scan reuses the `revalidate: 86400` fetch cache and the existing concurrency cap (`MAX_PRICE_CONCURRENCY`).
- Encryption-touching paths: decrypt of trades/dividends and encrypt of inserted dividend ticker/amount in `dividend-actions.ts`, plus the ticker prefix encode/decode in `equity-actions.ts`. The DEK stays in the cookie.

## Out of scope

- Withholding tax on US dividends (amounts remain gross estimates).
- Yahoo symbol-search autocomplete.
- Capturing payment dates (candidates keep the ex-date).
- Backfilling `market` onto existing trades (legacy fallback instead).
- Changing the Yahoo data source or adding a dependency.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green (`/next-verify`).
- [ ] Vitest (node default; jsdom per file for component tests):
  - `parseNumericInput`: `''` -> `null`; `'3500'` -> `3500`; `'0.5'`, `'.5'`, `'1.'` handled; `'abc'`, `'1e999'` -> `null`.
  - Component (jsdom): typing `3500` into Shares shows `3500`; clearing shows empty and submit shows the required error, not `0`.
  - `deriveYahooSymbol`/`resolveMarket`: legacy `DBS` hit, unmapped SG `Z74` -> `Z74.SI`, US `AAPL` -> `AAPL`, legacy trade without market falls back to `getMarket`.
  - Prefix encode/decode round-trips; an unprefixed value decodes to `market: undefined`.
  - Exchange-local date: 23:30 UTC the day before maps to the next SG day; 01:00 UTC maps to the previous US day.
  - Dedupe: payment-date entry inside window and tolerance suppresses the candidate; different amount on a different date does not; out-of-window does not; one existing row cannot suppress two candidates.
  - Failure isolation: one rejecting fetch still yields candidates for the rest and lists the ticker in `skipped`; all failing sets the error state; malformed trade -> `malformed-trade`; currency mismatch is skipped.
  - `shouldAutoScan`: null -> true; 23h -> false; 25h -> true; corrupt value -> true.
  - `autoScanDividends` (mocked context): inserts only non-duplicates, returns `added`, never surfaces DB text, a repeat run inserts nothing.
- [ ] Unlock path test: a rejected or slow `autoScanDividends` neither delays `revealWhenReady()` nor surfaces an error.
- [ ] Combobox: lists only the user's tickers, filters on typing, "Add new ticker" requires an explicit market, operable by keyboard, labelled for assistive tech.
- [ ] Manual: unlock with a PIN on an account missing a dividend; toast appears once; re-unlock within 24h scans nothing; the manual dialog still works and shows a skipped summary.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: trade entry, dividend records (auto-inserted without confirmation, so a wrong estimate lands in user data), and the unlock flow (isolated by fire-and-forget).
- **Reversibility**: UI and scan changes are a single git revert. Auto-added dividends are ordinary rows deletable in the dividend table. After trades are written with the market prefix, a revert must keep the decoder or the ticker would show as `SG:DBS`. The migration alternative is forward-only (`§6.3`).
- **Backout plan**: remove the trigger call in `vault-unlock-flow.tsx` while keeping the decoder; delete auto-added rows manually if needed.

## Open questions

- [ ] Q1: Market storage: encoded prefix in the encrypted `ticker` value (recommended, no migration, non-obvious format) or a plaintext nullable `market` column (migration, leaks the SG/US split, needs separate owner approval)? — Owner: Clarence — A:
- [ ] Q2: Combobox: build from `Popover` + `Input` (no dependency, recommended) or approve `cmdk` via `npx shadcn@latest add command`? — Owner: Clarence — A:
- [ ] Q3: Throttle storage: per-device `localStorage` (recommended, no migration) or a server-side timestamp (needs a column or table, hence a migration)? — Owner: Clarence — A:
- [ ] Q4: Are the dedupe window (-3/+60 days) and tolerance (max(0.02, 2%)) acceptable? Tighter risks duplicates, looser risks hiding real dividends. — Owner: Clarence — A:
- [ ] Q5: Should auto-added dividends be visibly marked (badge or "estimated" note) for review? Not included unless requested. — Owner: Clarence — A:
- [ ] Q6: Does `salary-form.tsx` need the shared input? Include only if the leading-zero symptom reproduces. — Owner: implementer — A:
