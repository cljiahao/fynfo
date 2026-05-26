-- ============================================================================
-- fynfo Supabase backup via SQL Editor (no terminal / no Postgres client install)
--
-- Uses postgres_fdw to let the BACKUP project pull rows directly from PROD.
-- Everything runs inside the BACKUP project's SQL Editor at supabase.com.
--
-- Pre-req:
--   1. Second free-tier Supabase project created (name suggestion: fynfo-backup).
--   2. All schema migrations from fynfo/supabase/migrations/ already applied to
--      the BACKUP project (paste each migration file into BACKUP SQL Editor in
--      order before running Section A).
--   3. PROD database password from Supabase Studio → Project Settings →
--      Database → Connection string. You will paste it once into Section A.
--
-- Sections:
--   A. ONE-TIME SETUP — run once in the BACKUP project SQL Editor.
--   B. REFRESH SNAPSHOT — run whenever you want to copy PROD → BACKUP.
--   C. RESTORE PROD FROM BACKUP — only if prod is corrupted. Manual, paste in
--      PROD project SQL Editor (this is the reverse direction).
--   D. TEARDOWN — drop the foreign server if you ever stop using this setup.
-- ============================================================================


-- =============================================================================
-- SECTION A — ONE-TIME SETUP  (run in BACKUP project SQL Editor)
-- =============================================================================
-- Replace the three REPLACE_ME placeholders before running.

-- 1. Enable postgres_fdw extension (available on Supabase free tier).
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 2. Create foreign server pointing at PROD.
--    REPLACE_PROD_REF = your prod project ref (the subdomain in the connection
--    string, e.g. abcdefghijklmnop). Get it from PROD project's Settings →
--    Database → Host. Strip the leading "db." prefix.
CREATE SERVER IF NOT EXISTS fynfo_prod_fdw
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.REPLACE_PROD_REF.supabase.co',
    port '5432',
    dbname 'postgres'
  );

-- 3. Map the backup project's `postgres` role to PROD's `postgres` role.
--    REPLACE_PROD_DB_PASSWORD = the PROD database password.
--    The password is stored in BACKUP project's metadata (encrypted at rest
--    by Supabase). Never commit this SQL file with the real password.
CREATE USER MAPPING IF NOT EXISTS FOR postgres
  SERVER fynfo_prod_fdw
  OPTIONS (
    user 'postgres',
    password 'REPLACE_PROD_DB_PASSWORD'
  );

-- 4. Create a local schema to hold the foreign-table mirrors of PROD.
CREATE SCHEMA IF NOT EXISTS prod_mirror;

-- 5. Import PROD's `public` schema as foreign tables under prod_mirror.
--    These are NOT copies — they are views over the live PROD tables.
IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    users_profile,
    equity_trades,
    expense_records,
    expense_splits,
    salary_records,
    monthly_snapshots,
    asset_entries,
    tax_relief_entries,
    planner_settings
  )
  FROM SERVER fynfo_prod_fdw
  INTO prod_mirror;

-- 6. Sanity check — should return PROD's row count without touching local
--    public schema.
SELECT 'users_profile' AS tbl, COUNT(*) FROM prod_mirror.users_profile
UNION ALL SELECT 'equity_trades', COUNT(*) FROM prod_mirror.equity_trades
UNION ALL SELECT 'expense_records', COUNT(*) FROM prod_mirror.expense_records
UNION ALL SELECT 'expense_splits', COUNT(*) FROM prod_mirror.expense_splits
UNION ALL SELECT 'salary_records', COUNT(*) FROM prod_mirror.salary_records
UNION ALL SELECT 'monthly_snapshots', COUNT(*) FROM prod_mirror.monthly_snapshots
UNION ALL SELECT 'asset_entries', COUNT(*) FROM prod_mirror.asset_entries
UNION ALL SELECT 'tax_relief_entries', COUNT(*) FROM prod_mirror.tax_relief_entries
UNION ALL SELECT 'planner_settings', COUNT(*) FROM prod_mirror.planner_settings;

-- Setup is complete. Run Section B any time to copy data into the backup.


-- =============================================================================
-- SECTION B — REFRESH SNAPSHOT  (run in BACKUP project SQL Editor)
-- =============================================================================
-- Replaces the backup project's local data with the current PROD state.
-- Safe to re-run — the transaction is atomic; failures roll back.
--
-- `session_replication_role = replica` disables FK validation for the duration
-- of the transaction. Without it, INSERTs into public.users_profile would fail
-- because the BACKUP project's auth.users does not contain PROD's user UUIDs.

BEGIN;

SET LOCAL session_replication_role = 'replica';

-- Order doesn't matter inside the transaction because FK is disabled, but
-- TRUNCATE CASCADE handles dependents regardless.
TRUNCATE
  public.users_profile,
  public.equity_trades,
  public.expense_records,
  public.expense_splits,
  public.salary_records,
  public.monthly_snapshots,
  public.asset_entries,
  public.tax_relief_entries,
  public.planner_settings
RESTART IDENTITY CASCADE;

INSERT INTO public.users_profile      SELECT * FROM prod_mirror.users_profile;
INSERT INTO public.equity_trades      SELECT * FROM prod_mirror.equity_trades;
INSERT INTO public.expense_records    SELECT * FROM prod_mirror.expense_records;
INSERT INTO public.expense_splits     SELECT * FROM prod_mirror.expense_splits;
INSERT INTO public.salary_records     SELECT * FROM prod_mirror.salary_records;
INSERT INTO public.monthly_snapshots  SELECT * FROM prod_mirror.monthly_snapshots;
INSERT INTO public.asset_entries      SELECT * FROM prod_mirror.asset_entries;
INSERT INTO public.tax_relief_entries SELECT * FROM prod_mirror.tax_relief_entries;
INSERT INTO public.planner_settings   SELECT * FROM prod_mirror.planner_settings;

COMMIT;

-- Parity check — row counts must match PROD's. Failures here mean the snapshot
-- is incomplete; re-run Section B.
WITH prod_counts AS (
  SELECT 'users_profile' AS tbl, COUNT(*) AS n FROM prod_mirror.users_profile
  UNION ALL SELECT 'equity_trades', COUNT(*) FROM prod_mirror.equity_trades
  UNION ALL SELECT 'expense_records', COUNT(*) FROM prod_mirror.expense_records
  UNION ALL SELECT 'expense_splits', COUNT(*) FROM prod_mirror.expense_splits
  UNION ALL SELECT 'salary_records', COUNT(*) FROM prod_mirror.salary_records
  UNION ALL SELECT 'monthly_snapshots', COUNT(*) FROM prod_mirror.monthly_snapshots
  UNION ALL SELECT 'asset_entries', COUNT(*) FROM prod_mirror.asset_entries
  UNION ALL SELECT 'tax_relief_entries', COUNT(*) FROM prod_mirror.tax_relief_entries
  UNION ALL SELECT 'planner_settings', COUNT(*) FROM prod_mirror.planner_settings
),
local_counts AS (
  SELECT 'users_profile' AS tbl, COUNT(*) AS n FROM public.users_profile
  UNION ALL SELECT 'equity_trades', COUNT(*) FROM public.equity_trades
  UNION ALL SELECT 'expense_records', COUNT(*) FROM public.expense_records
  UNION ALL SELECT 'expense_splits', COUNT(*) FROM public.expense_splits
  UNION ALL SELECT 'salary_records', COUNT(*) FROM public.salary_records
  UNION ALL SELECT 'monthly_snapshots', COUNT(*) FROM public.monthly_snapshots
  UNION ALL SELECT 'asset_entries', COUNT(*) FROM public.asset_entries
  UNION ALL SELECT 'tax_relief_entries', COUNT(*) FROM public.tax_relief_entries
  UNION ALL SELECT 'planner_settings', COUNT(*) FROM public.planner_settings
)
SELECT p.tbl, p.n AS prod_rows, l.n AS backup_rows,
       CASE WHEN p.n = l.n THEN 'OK' ELSE 'MISMATCH' END AS status
FROM prod_counts p
JOIN local_counts l USING (tbl);


-- =============================================================================
-- SECTION C — RESTORE PROD FROM BACKUP  (run in PROD project SQL Editor only
--             when prod is corrupted; this is the reverse direction and
--             requires the inverse setup — see steps below)
-- =============================================================================
-- DESTRUCTIVE. Run only after confirming prod is truly broken.
--
-- One-time inverse setup, in PROD project SQL Editor:
--   CREATE EXTENSION IF NOT EXISTS postgres_fdw;
--   CREATE SERVER fynfo_backup_fdw
--     FOREIGN DATA WRAPPER postgres_fdw
--     OPTIONS (host 'db.REPLACE_BACKUP_REF.supabase.co', port '5432',
--              dbname 'postgres');
--   CREATE USER MAPPING FOR postgres SERVER fynfo_backup_fdw
--     OPTIONS (user 'postgres', password 'REPLACE_BACKUP_DB_PASSWORD');
--   CREATE SCHEMA IF NOT EXISTS backup_mirror;
--   IMPORT FOREIGN SCHEMA public LIMIT TO (
--     users_profile, equity_trades, expense_records, expense_splits,
--     salary_records, monthly_snapshots, asset_entries, tax_relief_entries,
--     planner_settings
--   ) FROM SERVER fynfo_backup_fdw INTO backup_mirror;
--
-- Then the restore:
--   BEGIN;
--   SET LOCAL session_replication_role = 'replica';
--   TRUNCATE public.users_profile, public.equity_trades, public.expense_records,
--     public.expense_splits, public.salary_records, public.monthly_snapshots,
--     public.asset_entries, public.tax_relief_entries, public.planner_settings
--     RESTART IDENTITY CASCADE;
--   INSERT INTO public.users_profile      SELECT * FROM backup_mirror.users_profile;
--   INSERT INTO public.equity_trades      SELECT * FROM backup_mirror.equity_trades;
--   INSERT INTO public.expense_records    SELECT * FROM backup_mirror.expense_records;
--   INSERT INTO public.expense_splits     SELECT * FROM backup_mirror.expense_splits;
--   INSERT INTO public.salary_records     SELECT * FROM backup_mirror.salary_records;
--   INSERT INTO public.monthly_snapshots  SELECT * FROM backup_mirror.monthly_snapshots;
--   INSERT INTO public.asset_entries      SELECT * FROM backup_mirror.asset_entries;
--   INSERT INTO public.tax_relief_entries SELECT * FROM backup_mirror.tax_relief_entries;
--   INSERT INTO public.planner_settings   SELECT * FROM backup_mirror.planner_settings;
--   COMMIT;
--
-- After restore: confirm auth.users in PROD still contain the user UUIDs that
-- users_profile references. If you reset PROD's auth.users, the FKs orphan and
-- the app reads break.


-- =============================================================================
-- SECTION D — TEARDOWN  (run in BACKUP project SQL Editor if you stop using
--             this setup)
-- =============================================================================
-- DROP SCHEMA prod_mirror CASCADE;
-- DROP USER MAPPING IF EXISTS FOR postgres SERVER fynfo_prod_fdw;
-- DROP SERVER IF EXISTS fynfo_prod_fdw CASCADE;
-- DROP EXTENSION IF EXISTS postgres_fdw;
