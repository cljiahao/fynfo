'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { expenseDataSchema } from '../schemas';
import type { ExpenseData } from '../types';

type ExpenseSplitRow = {
  expense_id: string;
  person: string;
  amount: string;
  settled: boolean;
};
type ExpenseRow = {
  id: string;
  date: string;
  type: string;
  item: string | null;
  info: string | null;
  amount: string;
  split_type: string;
};

export async function getExpenses(): Promise<ExpenseData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const records = await readAllRows<ExpenseRow>(
    (from, to) =>
      supabase
        .from('expense_records')
        .select('id, date, type, item, info, amount, split_type', {
          count: 'exact',
        })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    'expense read'
  );
  if (records.length === 0) return [];
  const splits = await readAllRows<ExpenseSplitRow>(
    (from, to) =>
      supabase
        .from('expense_splits')
        .select(
          'expense_id, person, amount, settled, parent:expense_records!inner(user_id)',
          { count: 'exact' }
        )
        .eq('parent.user_id', userId)
        .order('expense_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'expense splits read'
  );
  const splitsByExpense = new Map<string, ExpenseSplitRow[]>();
  for (const split of splits) {
    const group = splitsByExpense.get(split.expense_id) ?? [];
    group.push(split);
    splitsByExpense.set(split.expense_id, group);
  }

  return Promise.all(
    records.map(async (r) => {
      const decryptedSplits = await Promise.all(
        (splitsByExpense.get(r.id) ?? []).map(async (s) => ({
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

  const splits = await readAllRows<{ person: string }>(
    (from, to) =>
      supabase
        .from('expense_splits')
        .select('person, parent:expense_records!inner(user_id)', {
          count: 'exact',
        })
        .eq('parent.user_id', userId)
        .order('id', { ascending: true })
        .range(from, to),
    'people read'
  );

  const peopleSet = new Set<string>();
  for (const split of splits) {
    if (split.person) peopleSet.add(split.person);
  }

  return Array.from(peopleSet).sort();
}
