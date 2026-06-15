---
id: 035
slug: server-action-test-coverage
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-15
approved: 2026-06-15
shipped: 2026-06-15
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.2' # ships unit tests for the previously-untested action layer
  - '§2.1' # exercises the encrypt/decrypt + auth-guard contract on write paths
constitution_overrides:
---

# Spec 035: Server-action test coverage (write paths + untested actions)

## Problem

Coverage audit (2026-06-15) found the server-action layer thin: `profile-actions` and
`price-actions` have **zero** tests; `equity-actions` (31%), `snapshot-actions` (25%) and
`relief-actions` (25%) test only happy-path reads. The untested code is exactly the
confidentiality-critical surface — encrypt-on-write, parse-at-boundary, auth-guard rejection,
and DB-error opacity — yet a regression there fails silently (orphaned data, leaked DB text, or
a dropped guard). These are all node-testable today with the existing `makeFakeSupabase` helper
and a `fetch` mock; no new dependency and no jsdom needed.

## Constitution check

- Satisfies `§4.2` (adds unit tests for the action layer) and `§2.1` (asserts the
  encrypt/decrypt round-trip + guard ordering that protect the zero-knowledge vault). Overrides:
  none. No migration, no new dependency. Test-only — no `src/` behavior change.

## Solution shape

Test files only (`test/features/**`, `test/**`), plus a `vitest.config.ts` threshold ratchet.

- **`test/features/profile/profile-actions.test.ts`** (new): `getProfile` maps snake→camel and
  returns `null` on read error/empty; `upsertProfile` rejects invalid input via `parseOrThrow`
  before any DB call, writes mapped columns on valid input, and surfaces an opaque error on a
  write failure (no Postgres text).
- **`test/features/equity/price-actions.test.ts`** (new): mock global `fetch`. `fetchStockPrices`
  dedupes/upper-cases tickers, maps via `getYahooSymbol`, parses `meta` (price, prevClose
  fallbacks, currency default, `changePercent` divide-by-zero guard), drops `!res.ok` / missing
  `meta` / thrown symbols to absent keys, and requires auth. `fetchExchangeRate` returns the rate,
  `null` on `!res.ok`/non-positive/throw.
- **Extend `equity-actions.test.ts`**: `addTrade` encrypts ticker/shares/price/fees before insert;
  `deleteTrade` issues the scoped delete and surfaces opaque errors.
- **Extend `snapshot-actions.test.ts` + `relief-actions.test.ts`**: write-path (encrypt + upsert)
  and error-opacity cases for the currently-uncovered lines.
- **`vitest.config.ts`**: ratchet the global floors and add/raise per-file floors for the five
  action files to just under their new measured coverage (lock the gain, prevent regression).

No encryption-touching `src/` code changes — tests assert existing behavior only.

## Out of scope

- Component / hook render tests (jsdom/RTL) — separate track.
- Any change to action behavior, schemas, or crypto. If a test surfaces a real bug, file a
  separate fix spec; do not fix in this PR.
- The a11y accessible-name work — tracked in spec 036.

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck)
- [ ] `pnpm test:ci` green; new tests cover profile + price actions and equity/snapshot/relief
      write paths
- [ ] `pnpm test:coverage` green against the ratcheted thresholds
- [ ] `pnpm build` green
- [ ] Action-file line coverage materially up (profile/price 0% → >85%; equity/snapshot/relief
      write paths covered)
- [ ] No `src/` file changed except `vitest.config.ts`
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: test-only + threshold config. Zero runtime/user impact.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit; thresholds return to current floors.

## Open questions

- [ ] Q: Ratchet global thresholds, or only add per-file floors for the five actions? — Owner:
      Clarence — A: (default: per-file floors + a modest global bump, no aggressive global gate)
