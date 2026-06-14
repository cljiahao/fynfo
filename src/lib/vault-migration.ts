import { throwIfSupabaseError } from '@/lib/errors';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { decryptPayload, encryptPayload } from './crypto';

const VAULT_CANARY = 'fynfo_vault_ok';

// Minimal typed shapes for each encrypted table. Only the re-encrypted fields
// are typed explicitly; the rest pass through via the Record spread.
type TradeRow = Record<string, unknown> & {
  ticker: string | null;
  shares: string | null;
  price: string | null;
  fees: string | null;
};
type ExpenseRow = Record<string, unknown> & {
  item: string | null;
  info: string | null;
  amount: string | null;
};
type SplitRow = Record<string, unknown> & { amount: string | null };
type SalaryRow = Record<string, unknown> & {
  salary: string | null;
  bonus: string | null;
};
type TaxReliefRow = Record<string, unknown> & { amount: string | null };
type AssetEntryRow = Record<string, unknown> & {
  account: string | null;
  amount: string | null;
};

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
  const upserts: PromiseLike<{ error: PostgrestError | null }>[] = [];

  if ((trades ?? []).length > 0) {
    const rows = (trades ?? []).map((t: TradeRow) => ({
      ...t,
      ticker: reEnc(t.ticker, oldDek, newDek),
      shares: reEnc(t.shares, oldDek, newDek),
      price: reEnc(t.price, oldDek, newDek),
      fees: reEnc(t.fees, oldDek, newDek),
    }));
    upserts.push(supabase.from('equity_trades').upsert(rows));
  }

  if ((expenses ?? []).length > 0) {
    const rows = (expenses ?? []).map((r: ExpenseRow) => ({
      ...r,
      item: reEnc(r.item, oldDek, newDek),
      info: reEnc(r.info, oldDek, newDek),
      amount: reEnc(r.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('expense_records').upsert(rows));
  }

  if ((splits ?? []).length > 0) {
    const rows = (splits ?? []).map((s: SplitRow) => ({
      ...s,
      amount: reEnc(s.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('expense_splits').upsert(rows));
  }

  if ((salaryRecords ?? []).length > 0) {
    const rows = (salaryRecords ?? []).map((r: SalaryRow) => ({
      ...r,
      salary: reEnc(r.salary, oldDek, newDek),
      bonus: reEnc(r.bonus, oldDek, newDek),
    }));
    upserts.push(supabase.from('salary_records').upsert(rows));
  }

  if ((taxReliefs ?? []).length > 0) {
    const rows = (taxReliefs ?? []).map((r: TaxReliefRow) => ({
      ...r,
      amount: reEnc(r.amount, oldDek, newDek),
    }));
    upserts.push(supabase.from('tax_relief_entries').upsert(rows));
  }

  if ((entries ?? []).length > 0) {
    const rows = (entries ?? []).map((e: AssetEntryRow) => ({
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
