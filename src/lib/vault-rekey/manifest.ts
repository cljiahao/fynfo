/**
 * Single source of truth for tables and columns holding AES-256-GCM
 * ciphertext encrypted under the user's DEK.
 *
 * The rekey orchestrator iterates this manifest to decrypt-with-v1 then
 * re-encrypt-with-v2. Adding a new encrypted column means one line here +
 * one line in the matching plpgsql `rekey_user_data` RPC (see
 * supabase/migrations/20260527000000_add_vault_v2.sql).
 *
 * `userColumn` direct-owned tables filter by `<col> = userId`.
 * `joinVia` indirect-owned tables resolve ownership through a parent table
 *   (`expense_splits` via `expense_records`; `asset_entries` via
 *   `monthly_snapshots`).
 */

export interface JoinVia {
  /** Parent table the child resolves ownership through. */
  table: string;
  /** Foreign-key column on the child table pointing to the parent's id. */
  on: string;
  /** Column on the parent table that equals `userId`. */
  userColumn: string;
}

export interface EncryptedTable {
  table: string;
  primaryKey: string;
  /** If null, ownership is resolved via `joinVia`. */
  userColumn: string | null;
  joinVia?: JoinVia;
  encryptedColumns: string[];
}

export const ENCRYPTED_TABLES: readonly EncryptedTable[] = [
  {
    table: 'equity_trades',
    primaryKey: 'id',
    userColumn: 'user_id',
    encryptedColumns: ['ticker', 'shares', 'price', 'fees'],
  },
  {
    table: 'expense_records',
    primaryKey: 'id',
    userColumn: 'user_id',
    encryptedColumns: ['item', 'info', 'amount'],
  },
  {
    table: 'expense_splits',
    primaryKey: 'id',
    userColumn: null,
    joinVia: {
      table: 'expense_records',
      on: 'expense_id',
      userColumn: 'user_id',
    },
    encryptedColumns: ['amount'],
  },
  {
    table: 'salary_records',
    primaryKey: 'id',
    userColumn: 'user_id',
    encryptedColumns: ['salary', 'bonus'],
  },
  {
    table: 'asset_entries',
    primaryKey: 'id',
    userColumn: null,
    joinVia: {
      table: 'monthly_snapshots',
      on: 'snapshot_id',
      userColumn: 'user_id',
    },
    encryptedColumns: ['account', 'amount'],
  },
  {
    table: 'tax_relief_entries',
    primaryKey: 'id',
    userColumn: 'user_id',
    encryptedColumns: ['amount'],
  },
] as const;

/** RPC argument name for each encrypted table's update payload. */
export const RPC_PARAM_BY_TABLE: Record<string, string> = {
  equity_trades: 'p_equity_trades',
  expense_records: 'p_expense_records',
  expense_splits: 'p_expense_splits',
  salary_records: 'p_salary_records',
  asset_entries: 'p_asset_entries',
  tax_relief_entries: 'p_tax_relief_entries',
};
