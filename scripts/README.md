# scripts/

Dev tooling. Not shipped to production.

## Two ways to backup fynfo's Supabase data

Free-tier Supabase has no managed backups; both approaches below mirror live data into a second free-tier project so you have a manual restore target.

### Option 1 — `backup-via-sql-editor.sql` (no install, all clicks)

Runs entirely inside Supabase Studio's SQL Editor. Uses `postgres_fdw` so the BACKUP project pulls live rows from PROD on demand. **Pick this if you don't want to install `pg_dump` / `psql`.**

Setup (once):

1. Create the second Supabase project (`fynfo-backup`).
2. Paste each file from `supabase/migrations/` into the BACKUP project's SQL Editor in order to create the schema.
3. Open `scripts/backup-via-sql-editor.sql`. Replace the two placeholders:
   - `REPLACE_PROD_REF` — PROD project ref (e.g. `abcdefghijklmnop` from `db.abcdefghijklmnop.supabase.co`).
   - `REPLACE_PROD_DB_PASSWORD` — PROD database password from Supabase Studio → Project Settings → Database.
4. Paste **Section A** into BACKUP project's SQL Editor. Run. The final query returns PROD row counts — confirms the foreign-data wrapper is wired correctly.

Refresh (any time):

5. Paste **Section B** into BACKUP project's SQL Editor. Run. Replaces backup data with a current PROD snapshot, atomically. Parity-check query at the end shows row counts side-by-side; every row must say `OK`.

Restore (emergency only):

6. Section C documents the reverse direction. Run only if PROD is corrupted. Requires the inverse foreign-data wrapper in PROD pointing at BACKUP. Destructive.

Teardown:

7. Section D removes the foreign server cleanly.

Caveats:

- PROD DB password sits in BACKUP project's metadata (encrypted at rest by Supabase). Rotate the password if BACKUP is ever leaked.
- `SET session_replication_role = replica` disables FK validation during the snapshot. Necessary because BACKUP's `auth.users` does not contain PROD's user UUIDs.
- `postgres_fdw` cross-region traffic counts toward Supabase egress quota. Negligible for personal scope.
- The final SELECT shows mismatches but doesn't block. Re-run Section B if any row shows MISMATCH.
- No scheduling — you have to remember to open the SQL editor and click Run. If you want hands-off recurring backups, use Option 2.

### Option 2 — `backup-to-supabase.{sh,ps1}` (Postgres client install required)

Mirror via `pg_dump` + `psql` from a dev machine. Adds:

- One-shot CLI command, no clicks.
- Cron / Task Scheduler hands-off recurring backup.
- Local `.sql` snapshot file under `.supabase-backups/` for additional belt-and-braces (deleted by default after restore; `--keep-dump` retains).
- Row-count parity check that aborts on mismatch.

One-time setup:

1. **Create the backup project** — Supabase Studio → New project. Name: `fynfo-backup`. Same region as prod. Save the database password.
2. **Mirror the schema** to the backup project. The data script only copies rows — tables must already exist on the backup side.
   - Easiest: open Supabase Studio for the backup project → SQL editor → paste each file from `supabase/migrations/` in order → run.
   - Or via CLI if you use it: `supabase db push --db-url "$BACKUP_DATABASE_URL"`.
3. **Install Postgres client tools** on your dev machine.
   - Windows: `scoop install postgresql` or download from postgresql.org.
   - macOS: `brew install libpq && brew link --force libpq`.
   - Linux: `apt install postgresql-client`.
   - Verify: `pg_dump --version` and `psql --version`.
4. **Configure connection strings**
   - `cp scripts/.env.backup.example scripts/.env.backup`.
   - Fill in `PROD_DATABASE_URL` and `BACKUP_DATABASE_URL` from Supabase Studio → Project Settings → Database → Connection string (URI).
   - `.env.backup` is gitignored.

Run a backup:

```bash
# Bash / WSL / git-bash
bash scripts/backup-to-supabase.sh

# PowerShell
powershell -File scripts/backup-to-supabase.ps1
```

Flags:

- `--dry-run` (`-DryRun`): dump only, skip the destructive truncate + restore on the backup side.
- `--keep-dump` (`-KeepDump`): keep the `.sql` dump file in `.supabase-backups/` after a successful restore.

Output:

- `.supabase-backups/vault-YYYYMMDD-HHMMSS.sql` — the raw pg_dump (deleted after success unless `--keep-dump`).
- Row counts logged per table after restore to confirm parity.

### When to run (either option)

- Before any vault rekey (spec 001 PBKDF2 v2 migration).
- Before any destructive Supabase migration.
- For Option 2 only — weekly cron / Windows Task Scheduler for steady-state insurance:
  ```bash
  # Linux cron — Sunday 03:00
  0 3 * * 0  cd /path/to/fynfo && bash scripts/backup-to-supabase.sh >> .supabase-backups/cron.log 2>&1
  ```
  ```powershell
  # Windows Task Scheduler — weekly
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument '-NoProfile -File C:\path\to\fynfo\scripts\backup-to-supabase.ps1'
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
  Register-ScheduledTask -TaskName 'fynfo-supabase-backup' -Action $action -Trigger $trigger
  ```

### Shared limits (both options)

- **Auth schema not mirrored**. Only `public.*` is copied. If you restore prod from backup, recreate the `auth.users` rows with their original UUIDs first (otherwise the `user_id` FKs orphan).
- **Storage buckets not mirrored**. fynfo doesn't currently use Supabase Storage; if that changes, extend the script.
- **Truncate-then-restore replaces the backup project's data fully**. The backup project should be treated as write-only by the snapshot tooling; never put live user data in it.
- **Free tier limits**: 2 projects per organisation. PROD + BACKUP = both slots used.

### Restore (emergency, Option 2 path)

If you ever need to restore prod from the backup project via the CLI tools:

1. Take a fresh dump from the **backup** project:
   ```bash
   pg_dump "$BACKUP_DATABASE_URL" --data-only --column-inserts --no-owner --no-privileges \
     --table=public.users_profile --table=public.equity_trades \
     --table=public.expense_records --table=public.expense_splits \
     --table=public.salary_records --table=public.monthly_snapshots \
     --table=public.asset_entries --table=public.tax_relief_entries \
     --table=public.planner_settings \
     > restore-from-backup.sql
   ```
2. Truncate prod tables (DANGEROUS — be certain):
   ```bash
   psql "$PROD_DATABASE_URL" -c "TRUNCATE public.users_profile, public.equity_trades, public.expense_records, public.expense_splits, public.salary_records, public.monthly_snapshots, public.asset_entries, public.tax_relief_entries, public.planner_settings RESTART IDENTITY CASCADE;"
   ```
3. Restore:
   ```bash
   psql "$PROD_DATABASE_URL" --single-transaction -f restore-from-backup.sql
   ```
4. Verify `auth.users` contains the user IDs referenced by the restored rows.

For the SQL-editor path, see Section C in `backup-via-sql-editor.sql`.
