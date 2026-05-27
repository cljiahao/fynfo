---
id: 004
slug: rekey-paginate-batch
area: fix
status: shipped
author: clarence + claude (opus 4.7, 2026-05-28)
created: 2026-05-28
approved: 2026-05-28
shipped: 2026-05-28
impl_pr: https://github.com/cljiahao/fynfo/commit/0b04a7a
supersedes:
constitution_satisfies:
  - '§Security' # zero-knowledge encryption invariant — rekey MUST process every owned row
  - '§Observability' # surface partial-fetch hazard explicitly, no silent truncation
constitution_overrides:
---

# Spec 004: Paginate + batch every read in vault rekey

## Problem

User with 3988 `expense_records` + 649 `expense_splits` cannot complete the v1→v2 vault rekey. Diagnostic log from spec 002 shows:

```
{"table":"expense_splits","joinTable":"expense_records","parentCount":1000,"message":"Bad Request","msg":"vault rekey: read child failed"}
```

Two compounding defects in `src/lib/vault-rekey/rekey.ts`:

1. **Silent truncation at 1000 rows.** `supabase.from(t).select(...).eq(userColumn, userId)` returns at most 1000 rows by default. Any direct-owned table with >1000 rows for a user is silently truncated — rekey processes only the first 1000, then the RPC writes those re-encrypted values back and bumps `vault_version` to 2, leaving the remaining 2988 rows v1-encrypted under a now-discarded DEK. Result: **partial rekey → permanent ciphertext orphans → data loss on next save** because every later read decrypts under v2 and crashes.

2. **`.in('expense_id', parentIds)` URL overflow.** With 1000 TEXT parent IDs (avg ~30 chars each), the PostgREST query URL exceeds the ~8KB limit and the request is rejected `400 Bad Request`. This is what visibly fails today; (1) is the silent killer that would hit even if (2) were fixed.

## Constitution check

- Satisfies: rekey processes every owned encrypted row, not a truncated subset. Observability of partial-fetch (logs row count vs page count) added.
- Overrides: none.

## Solution shape

Refactor `src/lib/vault-rekey/rekey.ts`:

- Add a `fetchAllByUser(table, select, userColumn, userId)` helper that pages `.range(from, to)` in slices of `PAGE_SIZE = 1000` until a partial page (`data.length < PAGE_SIZE`) signals end-of-table. Applies to direct-owned tables AND to the `joinVia` parent fetch (which itself can exceed 1000 IDs).
- Add a `fetchByParentIds(table, select, onColumn, parentIds)` helper that chunks `parentIds` into batches of `IN_BATCH = 100` and runs `.in(onColumn, chunk)` per batch. Each chunk's response is further range-paginated so a single batch returning more than 1000 child rows (e.g. high-fanout splits) does not truncate.
- All four error branches keep the spec 002 detailed logging (`code`, `message`, `details`, `hint`, `userId`, `table`, plus `from`/`to` or `chunkIndex`/`parentCount` for the page/batch).
- No schema change. No RPC change. No API change. Same `rekeyUserVault` signature, same `rekey_user_data` RPC contract.

`PAGE_SIZE = 1000` matches the PostgREST default upper bound; using `1000` (not 999) is intentional — `.range(0, 999)` returns up to 1000 rows.

`IN_BATCH = 100` keeps the worst-case `.in()` URL well under 4KB (100 × ~50 chars = 5KB nominally, plus PostgREST framing). Lower than 200 so any fanout > 10 splits/record still fits one chunk's child read without truncation.

## Out of scope

- Migrating reads to a single RPC (`get_user_encrypted_data`). Possible future optimisation; not needed for correctness.
- Tuning `PAGE_SIZE` / `IN_BATCH` per-table. Constants are fine for current scale.
- Touching the `rekey_user_data` write RPC — it accepts arbitrary jsonb arrays and already handles all rows in one transaction.
- Resuming a partially-failed rekey from a checkpoint. Rekey remains all-or-nothing; on failure, v1 state is intact (RPC was never called).

## Acceptance

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [ ] Existing `test/api/vault.test.ts` still passes (8 tests).
- [ ] Manual: user with 3988 `expense_records` + 649 `expense_splits` unlocks vault; server log shows `rekey complete` with `rowCounts: { expense_records: 3988, expense_splits: 649, ... }`; subsequent reads of any encrypted page (assets, expenses, salary, equity) decrypt successfully.
- [ ] Manual: a deliberately-failed read (e.g. PostgREST 5xx mid-page) logs `from`/`to` and surfaces `AppError('DB_ERROR')` with the affected table; vault stays v1 (RPC not called).

## Risk & reversibility

- **Blast radius**: vault unlock path only. Affects only users with v1 vaults still pending rekey. No effect on v2 vaults (Case A in `/api/vault`).
- **Reversibility**: single `git revert`. RPC contract unchanged; v1 state untouched on failure.
- **Backout plan**: revert the commit. v1 vault rekey reverts to broken state — but no NEW corruption is introduced by the revert because each rekey attempt is atomic.

## Open questions

- [ ] Should the `fetchAllByUser` helper warn-log when it hits >N pages (e.g. >5 pages = >5000 rows) so future scale issues surface early? Defer; current users <5000 rows, log noise low priority.
