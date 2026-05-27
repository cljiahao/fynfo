import 'server-only';

import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENCRYPTED_TABLES, RPC_PARAM_BY_TABLE } from './manifest';

const VAULT_CANARY = 'fynfo_vault_ok';

type EncryptedRow = {
  id: string;
  [col: string]: string | null;
};

async function rekeyRow(
  row: EncryptedRow,
  encryptedCols: string[],
  dekV1: Buffer,
  dekV2: Buffer
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = { id: row.id };
  for (const col of encryptedCols) {
    const v = row[col];
    if (v == null || v === '') {
      out[col] = v == null ? null : '';
      continue;
    }
    try {
      const plain = await decryptPayload(v, dekV1);
      out[col] = await encryptPayload(plain, dekV2);
    } catch (e) {
      if (e instanceof DecryptionError) {
        throw new AppError(
          'INTERNAL',
          `vault rekey: corrupt ciphertext in row ${row.id}`
        );
      }
      throw e;
    }
  }
  return out;
}

const PAGE_SIZE = 1000;
const IN_BATCH = 100;

async function fetchAllByUser(
  supabase: SupabaseClient,
  table: string,
  select: string,
  userColumn: string,
  userId: string
): Promise<EncryptedRow[]> {
  const out: EncryptedRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq(userColumn, userId)
      .range(from, to);
    if (error) {
      logger.error(
        {
          userId,
          table,
          from,
          to,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        'vault rekey: read failed'
      );
      throw new AppError('DB_ERROR', `vault rekey: read ${table} failed`);
    }
    const rows = (data ?? []) as unknown as EncryptedRow[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

async function fetchAllParentIds(
  supabase: SupabaseClient,
  table: string,
  userColumn: string,
  userId: string
): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq(userColumn, userId)
      .range(from, to);
    if (error) {
      logger.error(
        {
          userId,
          table,
          from,
          to,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        'vault rekey: read parent failed'
      );
      throw new AppError('DB_ERROR', `vault rekey: read ${table} failed`);
    }
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    out.push(...ids);
    if (ids.length < PAGE_SIZE) break;
  }
  return out;
}

async function fetchByParentIds(
  supabase: SupabaseClient,
  table: string,
  select: string,
  onColumn: string,
  parentIds: string[],
  joinTable: string,
  userId: string
): Promise<EncryptedRow[]> {
  const out: EncryptedRow[] = [];
  for (let i = 0; i < parentIds.length; i += IN_BATCH) {
    const chunk = parentIds.slice(i, i + IN_BATCH);
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in(onColumn, chunk)
        .range(from, to);
      if (error) {
        logger.error(
          {
            userId,
            table,
            joinTable,
            chunkIndex: i / IN_BATCH,
            chunkSize: chunk.length,
            parentCount: parentIds.length,
            from,
            to,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
          'vault rekey: read child failed'
        );
        throw new AppError('DB_ERROR', `vault rekey: read ${table} failed`);
      }
      const rows = (data ?? []) as unknown as EncryptedRow[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return out;
}

async function fetchRows(
  supabase: SupabaseClient,
  table: string,
  encryptedCols: string[],
  userId: string,
  userColumn: string | null,
  joinVia: { table: string; on: string; userColumn: string } | undefined
): Promise<EncryptedRow[]> {
  const select = ['id', ...encryptedCols].join(', ');

  if (userColumn) {
    return fetchAllByUser(supabase, table, select, userColumn, userId);
  }

  if (!joinVia) return [];
  const parentIds = await fetchAllParentIds(
    supabase,
    joinVia.table,
    joinVia.userColumn,
    userId
  );
  if (parentIds.length === 0) return [];

  return fetchByParentIds(
    supabase,
    table,
    select,
    joinVia.on,
    parentIds,
    joinVia.table,
    userId
  );
}

/**
 * Reads every encrypted row owned by `userId`, decrypts each ciphertext under
 * `dekV1`, re-encrypts under `dekV2`, then commits all rows atomically via the
 * `rekey_user_data` Postgres function. The RPC also writes the new v2 canary
 * and bumps `users_profile.vault_version` to 2 in the same transaction.
 *
 * Partial failure scenarios:
 *  - Read fails → `AppError('DB_ERROR')`. No writes attempted. v1 state intact.
 *  - Decrypt fails mid-sweep → `AppError('INTERNAL', 'corrupt ciphertext...')`.
 *    No writes attempted (everything is in memory until the RPC call).
 *  - RPC fails → `AppError('INTERNAL', 'Vault rekey failed...')`. Postgres
 *    rolled back automatically; v1 state intact.
 */
export async function rekeyUserVault(
  supabase: SupabaseClient,
  userId: string,
  dekV1: Buffer,
  dekV2: Buffer
): Promise<void> {
  logger.info({ userId }, 'vault rekey start');

  const tableData: Record<string, Record<string, string | null>[]> = {};
  for (const t of ENCRYPTED_TABLES) {
    const rows = await fetchRows(
      supabase,
      t.table,
      t.encryptedColumns,
      userId,
      t.userColumn,
      t.joinVia
    );
    const updated = await Promise.all(
      rows.map((r) => rekeyRow(r, t.encryptedColumns, dekV1, dekV2))
    );
    tableData[t.table] = updated;
  }

  const vaultCheckV2 = await encryptPayload(VAULT_CANARY, dekV2);

  const rpcArgs: Record<string, unknown> = {
    p_user_id: userId,
    p_vault_check_v2: vaultCheckV2,
  };
  for (const t of ENCRYPTED_TABLES) {
    rpcArgs[RPC_PARAM_BY_TABLE[t.table]] = tableData[t.table];
  }

  const { error } = await supabase.rpc('rekey_user_data', rpcArgs);
  if (error) {
    logger.error(
      { userId, code: error.code, message: error.message },
      'vault rekey RPC failed'
    );
    throw new AppError(
      'INTERNAL',
      'Vault rekey failed. Try again or restore from backup.'
    );
  }

  const rowCounts = Object.fromEntries(
    Object.entries(tableData).map(([t, rows]) => [t, rows.length])
  );
  logger.info({ userId, rowCounts }, 'vault rekey complete');
}
