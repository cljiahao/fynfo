'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { expenseDataSchema } from '../schemas';
import type { ExpenseData } from '../types';

type ExpenseSplitRow = { person: string; amount: string; settled: boolean };
type ExpenseWithSplitsRow = { splits: Array<{ person: string }> };

export async function getExpenses(): Promise<ExpenseData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('expense_records')
    .select(`*, splits:expense_splits(*)`)
    .eq('user_id', userId)
    .order('date', { ascending: false });

  throwIfSupabaseError(error, 'expense read');

  return Promise.all(
    (data || []).map(async (r) => {
      const decryptedSplits = await Promise.all(
        (r.splits || []).map(async (s: ExpenseSplitRow) => ({
          person: s.person,
          amount: await decryptNumber(s.amount, dek),
          settled: s.settled,
        }))
      );

      return {
        id: r.id,
        date: r.date,
        type: r.type as ExpenseData['type'],
        item: await decryptOptionalString(r.item, dek),
        info: await decryptOptionalString(r.info, dek),
        amount: await decryptNumber(r.amount, dek),
        splitType: r.split_type as 'self' | 'shared',
        splits: decryptedSplits,
      };
    })
  );
}

export async function upsertExpense(data: ExpenseData): Promise<void> {
  parseOrThrow(expenseDataSchema, data, 'expense.upsert.input');
  const { userId, dek, supabase } = await requireActionContext();

  const [encItem, encInfo, encAmount] = await Promise.all([
    encryptPayload(data.item, dek),
    encryptPayload(data.info || '', dek),
    encryptPayload(data.amount.toString(), dek),
  ]);

  const encSplits = await Promise.all(
    (data.splitType === 'shared' ? data.splits : []).map(async (s) => ({
      id: randomUUID(),
      expense_id: data.id,
      person: s.person,
      amount: await encryptPayload(s.amount.toString(), dek),
      settled: s.settled,
    }))
  );

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

  throwIfSupabaseError(expErr, 'expense upsert');

  const { error: deleteErr } = await supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', data.id);
  throwIfSupabaseError(deleteErr, 'expense splits delete');

  if (encSplits.length > 0) {
    const { error: splitErr } = await supabase
      .from('expense_splits')
      .insert(encSplits);
    throwIfSupabaseError(splitErr, 'expense splits insert');
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const { userId, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('expense_records')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'expense delete');
}

export async function settleSplit(
  expenseId: string,
  person: string,
  settled: boolean
): Promise<void> {
  const { supabase } = await requireActionContext();

  // RLS limits our mutations automatically to expenses we own.
  const { error } = await supabase
    .from('expense_splits')
    .update({ settled })
    .eq('expense_id', expenseId)
    .eq('person', person);

  throwIfSupabaseError(error, 'expense settle split');
}

export async function settleMonthSplits(
  expenseIds: string[],
  person: string,
  settled: boolean
): Promise<void> {
  const { supabase } = await requireActionContext();

  const { error } = await supabase
    .from('expense_splits')
    .update({ settled })
    .in('expense_id', expenseIds)
    .eq('person', person);

  throwIfSupabaseError(error, 'expense settle month');
}

export async function getDistinctPeople(): Promise<string[]> {
  const { userId, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('expense_records')
    .select('splits:expense_splits(person)')
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'people read');

  const peopleSet = new Set<string>();
  data.forEach((r: ExpenseWithSplitsRow) => {
    (r.splits || []).forEach((s) => {
      if (s.person) peopleSet.add(s.person);
    });
  });

  return Array.from(peopleSet).sort();
}
