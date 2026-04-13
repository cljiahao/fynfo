'use server';

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { getVaultDekSession } from '@/lib/keystore';
import { randomUUID } from 'crypto';
import type { ExpenseData } from '../types';

type ExpenseSplitRow = { person: string; amount: string; settled: boolean };
type ExpenseWithSplitsRow = { splits: Array<{ person: string }> };

async function getDekOrThrow() {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

export async function getExpenses(): Promise<ExpenseData[]> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('expense_records')
    .select(`*, splits:expense_splits(*)`)
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw new Error('Failed to fetch expenses: ' + error.message);

  return Promise.all(
    (data || []).map(async (r) => {
      const decryptedSplits = await Promise.all(
        (r.splits || []).map(async (s: ExpenseSplitRow) => ({
          person: s.person,
          amount: Number(await decryptPayload(s.amount, dek)),
          settled: s.settled,
        }))
      );

      return {
        id: r.id,
        date: r.date,
        type: r.type as ExpenseData['type'],
        item: await decryptPayload(r.item || '', dek),
        info: await decryptPayload(r.info || '', dek),
        amount: Number(await decryptPayload(r.amount, dek)),
        splitType: r.split_type as 'self' | 'shared',
        splits: decryptedSplits,
      };
    })
  );
}

export async function upsertExpense(data: ExpenseData): Promise<void> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  const encItem = await encryptPayload(data.item, dek);
  const encInfo = await encryptPayload(data.info || '', dek);
  const encAmount = await encryptPayload(data.amount.toString(), dek);

  const { error: expErr } = await supabase.from('expense_records').upsert({
    id: data.id,
    user_id: userId,
    date: new Date(data.date).toISOString(),
    type: data.type,
    item: encItem,
    info: encInfo,
    amount: encAmount,
    split_type: data.splitType,
    updated_at: new Date().toISOString(),
  });

  if (expErr) throw new Error('Failed to save expense');

  await supabase.from('expense_splits').delete().eq('expense_id', data.id);

  if (data.splitType === 'shared' && data.splits.length > 0) {
    const encSplits = await Promise.all(
      data.splits.map(async (s) => ({
        id: randomUUID(),
        expense_id: data.id,
        person: s.person,
        amount: await encryptPayload(s.amount.toString(), dek),
        settled: s.settled,
      }))
    );

    const { error: splitErr } = await supabase
      .from('expense_splits')
      .insert(encSplits);
    if (splitErr) throw new Error('Failed to save expense splits');
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('expense_records')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function settleSplit(
  expenseId: string,
  person: string,
  settled: boolean
): Promise<void> {
  await requireUserId();
  const supabase = await createSupabaseServerClient();

  // RLS limits our mutations automatically to expenses we own.
  const { error } = await supabase
    .from('expense_splits')
    .update({ settled })
    .eq('expense_id', expenseId)
    .eq('person', person);

  if (error) throw new Error(error.message);
}

export async function settleMonthSplits(
  expenseIds: string[],
  person: string,
  settled: boolean
): Promise<void> {
  await requireUserId();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('expense_splits')
    .update({ settled })
    .in('expense_id', expenseIds)
    .eq('person', person);

  if (error) throw new Error(error.message);
}

export async function getDistinctPeople(): Promise<string[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('expense_records')
    .select('splits:expense_splits(person)')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const peopleSet = new Set<string>();
  data.forEach((r: ExpenseWithSplitsRow) => {
    (r.splits || []).forEach((s) => {
      if (s.person) peopleSet.add(s.person);
    });
  });

  return Array.from(peopleSet).sort();
}
