#!/usr/bin/env bash
#
# Mirror fynfo prod Supabase project into a second (backup) Supabase project.
# Run from a dev machine with `pg_dump` and `psql` on PATH (Postgres client tools).
#
# Setup:
#   1. Create a second free-tier Supabase project (Supabase Studio → New project).
#      Name suggestion: "fynfo-backup".
#   2. Copy `scripts/.env.backup.example` to `scripts/.env.backup` and fill both
#      connection strings. NEVER commit `.env.backup`.
#   3. Run the schema migrations against the backup project once:
#        supabase db push --db-url "$BACKUP_DATABASE_URL"
#      (Or copy/paste the SQL from supabase/migrations/ in the Studio SQL editor.)
#   4. Then run this script to copy data.
#
# Usage:
#   bash scripts/backup-to-supabase.sh                # full data refresh
#   bash scripts/backup-to-supabase.sh --dry-run      # dump only, skip restore
#   bash scripts/backup-to-supabase.sh --keep-dump    # keep the .sql file after
#
# Notes:
#   - Only dumps the `public` schema (your app tables). Supabase `auth` schema
#     is NOT mirrored — backup project will have its own users. If you ever
#     need to restore prod from backup, you must recreate the auth users with
#     the same UUIDs first, or the foreign keys to `auth.users(id)` will fail.
#   - `monthly_snapshots`, `asset_entries` order matters for FK; pg_dump handles
#     that automatically.
#   - The script truncates target tables before restore so it stays idempotent.
#     The backup project's data is FULLY replaced each run. There is no merge.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.backup"

DRY_RUN=0
KEEP_DUMP=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --keep-dump) KEEP_DUMP=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing $ENV_FILE — copy from .env.backup.example and fill in connection strings" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${PROD_DATABASE_URL:?PROD_DATABASE_URL must be set in $ENV_FILE}"
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL must be set in $ENV_FILE}"

if [[ "$PROD_DATABASE_URL" == "$BACKUP_DATABASE_URL" ]]; then
  echo "PROD and BACKUP urls are identical — refusing to overwrite prod with itself" >&2
  exit 1
fi

command -v pg_dump >/dev/null || { echo "pg_dump not on PATH — install Postgres client tools" >&2; exit 1; }
command -v psql >/dev/null || { echo "psql not on PATH — install Postgres client tools" >&2; exit 1; }

TABLES=(
  public.users_profile
  public.equity_trades
  public.expense_records
  public.expense_splits
  public.salary_records
  public.monthly_snapshots
  public.asset_entries
  public.tax_relief_entries
  public.planner_settings
)

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_DIR="$PROJECT_ROOT/.supabase-backups"
mkdir -p "$DUMP_DIR"
DUMP_FILE="$DUMP_DIR/vault-$TIMESTAMP.sql"

echo "[1/3] pg_dump → $DUMP_FILE"
TABLE_FLAGS=()
for t in "${TABLES[@]}"; do TABLE_FLAGS+=(--table="$t"); done
pg_dump "$PROD_DATABASE_URL" \
  "${TABLE_FLAGS[@]}" \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  --no-comments \
  --quote-all-identifiers \
  > "$DUMP_FILE"

DUMP_SIZE=$(wc -c < "$DUMP_FILE")
DUMP_ROWS=$(grep -c '^INSERT INTO' "$DUMP_FILE" || true)
echo "    dump ok — $DUMP_SIZE bytes, $DUMP_ROWS rows"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "--dry-run set — skipping restore. dump kept at $DUMP_FILE"
  exit 0
fi

echo "[2/3] truncate backup tables"
TRUNCATE_LIST="$(IFS=,; echo "${TABLES[*]}")"
psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE $TRUNCATE_LIST RESTART IDENTITY CASCADE;"

echo "[3/3] psql restore from dump"
psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$DUMP_FILE" >/dev/null

# Sanity check: row counts match
for t in "${TABLES[@]}"; do
  prod_n=$(psql "$PROD_DATABASE_URL" -At -c "SELECT COUNT(*) FROM $t;")
  back_n=$(psql "$BACKUP_DATABASE_URL" -At -c "SELECT COUNT(*) FROM $t;")
  if [[ "$prod_n" != "$back_n" ]]; then
    echo "    $t: MISMATCH (prod=$prod_n backup=$back_n)" >&2
    exit 1
  fi
  echo "    $t: $prod_n rows"
done

if [[ "$KEEP_DUMP" == "1" ]]; then
  echo "dump retained at $DUMP_FILE"
else
  rm -f "$DUMP_FILE"
fi

echo "backup complete — $TIMESTAMP"
