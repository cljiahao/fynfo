---
id: 007
slug: drop-backup-tables
area: fix
status: shipped
author: clarence + claude (opus 4.7, 2026-05-28)
created: 2026-05-28
approved: 2026-05-28
shipped: 2026-05-28
impl_pr: https://github.com/cljiahao/fynfo/commit/0af187a
supersedes:
constitution_satisfies:
  - '§Simplicity' # purge unused schema once the migration that produced it is complete
  - '§Security' # backup_* tables held ciphertext under v1 DEKs — discarded keys, dead data, still subject to leak
constitution_overrides:
---

# Spec 007: Drop `public.backup_*` tables

## Problem

The PROD Supabase project carries nine `backup_*` tables in the `public` schema:

```
backup_asset_entries
backup_equity_trades
backup_expense_records
backup_expense_splits
backup_monthly_snapshots
backup_planner_settings
backup_salary_records
backup_tax_relief_entries
backup_users_profile
```

These were created by `scripts/backup-via-sql-editor.sql` (Section B) as a same-project pre-rekey snapshot. They hold rows encrypted under the **v1 DEK**, which has now been discarded for every user (both prod accounts at `vault_version = 2`, `vault_check IS NULL`). The backup tables can no longer be decrypted by anyone — including the legitimate owners — and the application code that referenced their key derivation (`deriveKeyFromPin`, `V1_*` constants) was removed in spec 006.

Leaving them in place is pure liability:

- Disk + free-tier quota waste — duplicates of the live rowset.
- Same-row encrypted data under a discarded key is still ciphertext subject to leak if the project is ever exposed. Better to remove than to retain unreadable plaintext-of-secrets.
- No application reads them; no migration references them; no script reads them now that `scripts/` was deleted.

## Constitution check

- Satisfies: cleanup of unused schema; smaller leak surface.
- Overrides: none. AGENTS §0 #3 lists destructive Supabase ops as a hard stop requiring owner approval — owner is the spec author here and explicitly approved.

## Solution shape

- New migration `supabase/migrations/20260528020000_drop_backup_tables.sql`.
- Body: nine `DROP TABLE IF EXISTS public.backup_<name>;` statements, idempotent.
- No `CASCADE` — these tables are referenced by nothing (they were FDW import targets, not parents of any FK). If a `DROP TABLE` errors with a dependency, the migration fails fast and the dependency is investigated before retry.
- No code change. No spec dependency. Strictly DDL.

## Manual step (you, after merge)

1. Apply the new migration in Supabase Studio → SQL Editor → paste `supabase/migrations/20260528020000_drop_backup_tables.sql` → Run. Expect "Success. No rows returned."
2. Verify gone:
   ```sql
   SELECT table_schema, table_name
   FROM information_schema.tables
   WHERE table_name LIKE 'backup_%'
     AND table_schema = 'public';
   ```
   Expect zero rows.

## Out of scope

- Dropping `users_profile.vault_check` / `vault_version` columns (deferred — spec 006 §Out of scope).
- Recreating any of these tables. None needed; live tables already hold the canonical v2-encrypted rows.

## Acceptance

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [ ] After migration applied: the verify query above returns zero rows.
- [ ] Live app continues to load every dashboard page (smoke test post-deploy).

## Risk & reversibility

- **Blast radius**: only the nine `backup_*` tables. No live data path touches them.
- **Reversibility**: `DROP TABLE` is destructive — rows cannot be recovered. **Counter**: the data is already irrecoverable (encrypted under a DEK no human still holds). Dropping the tables changes nothing about decryptability; it only removes already-dead ciphertext.
- **Backout plan**: none needed. If a column drop on the live tables ever surfaces something missing, the v2-encrypted live tables are the source of truth, not these.

## Open questions

- [ ] None.
