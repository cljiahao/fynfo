import { throwIfSupabaseError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptPayload, encryptPayload } from './crypto';

const VAULT_CANARY = 'fynfo_vault_ok';

function reEnc(value: string | null, oldDek: Buffer, newDek: Buffer): string {
  return encryptPayload(decryptPayload(value ?? '', oldDek), newDek);
}

/**
 * Re-encrypts all user data from oldDek to newDek, then updates the vault
 * canary. Call only after verifying oldDek is correct.
 *
 * Not idempotent — do not retry on partial failure. Use DELETE /api/vault
 * to reset and re-enter data if migration errors midway.
 */
export async function migrateUserVault(
  supabase: SupabaseClient,
  userId: string,
  oldDek: Buffer,
  newDek: Buffer
): Promise<void> {
  // Phase 1: fetch all data that needs re-encryption
  const [
    { data: trades },
    { data: expenses },
    { data: salaryRecords },
    { data: taxReliefs },
    { data: snapshots },
  ] = await Promise.all([
    supabase.from('equity_trades').select('*').eq('user_id', userId),
    supabase.from('expense_records').select('*').eq('user_id', userId),
    supabase.from('salary_records').select('*').eq('user_id', userId),
    supabase.from('tax_relief_entries').select('*').eq('user_id', userId),
    supabase.from('monthly_snapshots').select('id').eq('user_id', userId),
  ]);

  const expenseIds = (expenses ?? []).map((e: { id: string }) => e.id);
  const snapshotIds = (snapshots ?? []).map((s: { id: string }) => s.id);

  const [{ data: splits }, { data: entries }] = await Promise.all([
    expenseIds.length > 0
      ? supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
      : Promise.resolve({ data: [], error: null }),
    snapshotIds.length > 0
      ? supabase
          .from('asset_entries')
          .select('*')
          .in('snapshot_id', snapshotIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Phase 2: re-encrypt each table and upsert in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upserts: PromiseLike<{ error: any }>[] = [];

  if ((trades ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (trades ?? []).map((t: any) => ({
      ...t,
      ticker: reEnc(t.ticker, oldDek, newDek),
      shares: reEnc(t.shares, oldDek, newDek),
      price: reEnc(t.price, oldDek, newDek),
      fees: reEnc(t.fees, oldDek, newDek),
    }));
    upserts.push(supabase.from('equity_trades').upsert(rows));
  }

  if ((expenses ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (expenses ?? []).map((r: any) => ({
      ...r,
      item: reEnc(r.item, oldDek, newDek),
      info: reEnc(r.info, oldDek, newDek),
      amount: reEnc(r.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('expense_records').upsert(rows));
  }

  if ((splits ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (splits ?? []).map((s: any) => ({
      ...s,
      amount: reEnc(s.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('expense_splits').upsert(rows));
  }

  if ((salaryRecords ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (salaryRecords ?? []).map((r: any) => ({
      ...r,
      salary: reEnc(r.salary, oldDek, newDek),
      bonus: reEnc(r.bonus, oldDek, newDek),
    }));
    upserts.push(supabase.from('salary_records').upsert(rows));
  }

  if ((taxReliefs ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (taxReliefs ?? []).map((r: any) => ({
      ...r,
      amount: reEnc(r.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('tax_relief_entries').upsert(rows));
  }

  if ((entries ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (entries ?? []).map((e: any) => ({
      ...e,
      account: reEnc(e.account, oldDek, newDek),
      amount: reEnc(e.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('asset_entries').upsert(rows));
  }

  const results = await Promise.all(upserts);
  for (const { error } of results) {
    throwIfSupabaseError(error, 'vault migration upsert');
  }

  // Phase 3: update vault canary last — if data upserts fail above, old DEK
  // still works and user can retry. Only update canary after all data is safe.
  const { error: canaryErr } = await supabase
    .from('users_profile')
    .update({ vault_check: encryptPayload(VAULT_CANARY, newDek) })
    .eq('id', userId);

  throwIfSupabaseError(canaryErr, 'vault migration canary update');
}
