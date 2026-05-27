-- Drops the pre-rekey `public.backup_*` snapshot tables. They hold ciphertext
-- encrypted under the v1 DEK which is no longer derivable for any user (all
-- vaults at vault_version = 2). Dead, unreadable data.
-- Tracked by spec specs/fix/007-drop-backup-tables.md.

DROP TABLE IF EXISTS public.backup_asset_entries;
DROP TABLE IF EXISTS public.backup_equity_trades;
DROP TABLE IF EXISTS public.backup_expense_records;
DROP TABLE IF EXISTS public.backup_expense_splits;
DROP TABLE IF EXISTS public.backup_monthly_snapshots;
DROP TABLE IF EXISTS public.backup_planner_settings;
DROP TABLE IF EXISTS public.backup_salary_records;
DROP TABLE IF EXISTS public.backup_tax_relief_entries;
DROP TABLE IF EXISTS public.backup_users_profile;
