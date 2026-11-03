'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { PARALLEL_READ_CONCURRENCY, readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { withDeadline } from '@/lib/with-deadline';
import { RECORD_ID } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import type { z } from 'zod';
import { EXPENSE_READ_TIMEOUT_MS } from '../constants';
import {
  expenseDataSchema,
  expenseRangeSchema,
  settleSplitSchema,
} from '../schemas';
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

type DateRange = z.infer<typeof expenseRangeSchema>;

export async function getExpenses(): Promise<ExpenseData[]> {
  return withDeadline(readExpenses(), EXPENSE_READ_TIMEOUT_MS);
}

/** Expenses dated within an inclusive calendar range, for import checks. */
export async function getExpensesInRange(
  from: string,
  to: string
): Promise<ExpenseData[]> {
  const range = parseOrThrow(expenseRangeSchema, { from, to }, 'expense.range');
  return withDeadline(readExpenses(range), EXPENSE_READ_TIMEOUT_MS);
}

const READ_TIMING_PAGE_SIZE = 500;

interface ReadTiming {
  contextMs?: number;
  recordsMs?: number;
  recordRows?: number;
  splitsMs?: number;
  splitRows?: number;
  decryptMs?: number;
}

const elapsed = (since: number) => Math.round(performance.now() - since);
const pageCount = (rows: number) => Math.ceil(rows / READ_TIMING_PAGE_SIZE);

// Bound the action response as well as client waiting, so later actions can run.
// Logs in finally so a read that outlives its deadline still reports how far
// it got; withDeadline rejects the caller but does not cancel this work.
async function readExpenses(range?: DateRange): Promise<ExpenseData[]> {
  const startedAt = performance.now();
  const timing: ReadTiming = {};
  try {
    return await readExpensesTimed(timing, range);
  } finally {
    logger.info(
      {
        event: 'expenses.read.timing',
        ranged: range !== undefined,
        ...timing,
        recordPages: pageCount(timing.recordRows ?? 0),
        splitPages: pageCount(timing.splitRows ?? 0),
        totalMs: elapsed(startedAt),
      },
      'expenses read timing'
    );
  }
}

async function readExpensesTimed(
  timing: ReadTiming,
  range?: DateRange
): Promise<ExpenseData[]> {
  let stageStart = performance.now();
  const { userId, dek, supabase } = await requireActionContext();
  timing.contextMs = elapsed(stageStart);

  const readRecords = async () => {
    const startedAt = performance.now();
    const rows = await readAllRows<ExpenseRow>(
      (from, to) => {
        let query = supabase
          .from('expense_records')
          .select('id, date, type, item, info, amount, split_type', {
            count: 'exact',
          })
          .eq('user_id', userId);
        if (range)
          query = query
            .gte('date', `${range.from}T00:00:00.000Z`)
            .lte('date', `${range.to}T23:59:59.999Z`);
        return query
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to);
      },
      'expense read',
      { concurrency: PARALLEL_READ_CONCURRENCY }
    );
    timing.recordsMs = elapsed(startedAt);
    timing.recordRows = rows.length;
    return rows;
  };

  // Unranged splits do not depend on the records, so both reads overlap; the
  // ranged path needs the record ids first.
  const readAllSplits = async () => {
    const startedAt = performance.now();
    const rows = await readAllRows<ExpenseSplitRow>(
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
      'expense splits read',
      { concurrency: PARALLEL_READ_CONCURRENCY }
    );
    timing.splitsMs = elapsed(startedAt);
    timing.splitRows = rows.length;
    return rows;
  };

  let records: ExpenseRow[];
  let splits: ExpenseSplitRow[];
  if (range) {
    records = await readRecords();
    if (records.length === 0) return [];
    const startedAt = performance.now();
    splits = await readSplitsFor(
      records.filter((r) => r.split_type === 'shared').map((r) => r.id),
      userId,
      supabase
    );
    timing.splitsMs = elapsed(startedAt);
    timing.splitRows = splits.length;
  } else {
    [records, splits] = await Promise.all([readRecords(), readAllSplits()]);
    if (records.length === 0) return [];
  }

  stageStart = performance.now();
  const splitsByExpense = new Map<string, ExpenseSplitRow[]>();
  for (const split of splits) {
    const group = splitsByExpense.get(split.expense_id) ?? [];
    group.push(split);
    splitsByExpense.set(split.expense_id, group);
  }

  const result = await Promise.all(
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
  timing.decryptMs = elapsed(stageStart);
  return result;
}

// Bound the id filter so request URLs stay short.
const SPLIT_ID_CHUNK = 100;

async function readSplitsFor(
  expenseIds: string[],
  userId: string,
  supabase: Awaited<ReturnType<typeof requireActionContext>>['supabase']
): Promise<ExpenseSplitRow[]> {
  const splits: ExpenseSplitRow[] = [];
  for (let offset = 0; offset < expenseIds.length; offset += SPLIT_ID_CHUNK) {
    const ids = expenseIds.slice(offset, offset + SPLIT_ID_CHUNK);
    splits.push(
      ...(await readAllRows<ExpenseSplitRow>(
        (from, to) =>
          supabase
            .from('expense_splits')
            .select(
              'expense_id, person, amount, settled, parent:expense_records!inner(user_id)',
              { count: 'exact' }
            )
            .eq('parent.user_id', userId)
            .in('expense_id', ids)
            .order('expense_id', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        'expense splits read'
      ))
    );
  }
  return splits;
}

export async function upsertExpense(data: ExpenseData): Promise<void> {
  parseOrThrow(expenseDataSchema, data, 'expense.upsert.input');
  const { dek, supabase } = await requireActionContext();

  const [encItem, encInfo, encAmount] = await Promise.all([
    encryptPayload(data.item, dek),
    encryptPayload(data.info || '', dek),
    encryptPayload(data.amount.toString(), dek),
  ]);

  const encSplits = await Promise.all(
    (data.splitType === 'shared' ? data.splits : []).map(async (s) => ({
      id: randomUUID(),
      person: s.person,
      amount: await encryptPayload(s.amount.toString(), dek),
      settled: s.settled,
    }))
  );

  const { error } = await supabase.rpc('replace_expense_record', {
    p_record: {
      id: data.id,
      date: new Date(data.date).toISOString(),
      type: data.type,
      item: encItem,
      info: encInfo,
      amount: encAmount,
      split_type: data.splitType,
    },
    p_splits: encSplits,
  });
  throwIfSupabaseError(error, 'expense save');
}

export async function deleteExpense(id: string): Promise<void> {
  parseOrThrow(RECORD_ID, id, 'expense.id');
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
  const args = parseOrThrow(
    settleSplitSchema,
    { expenseIds: [expenseId], person, settled },
    'expense.settle-split'
  );
  const { supabase } = await requireActionContext();

  // RLS limits our mutations automatically to expenses we own.
  const { error } = await supabase
    .from('expense_splits')
    .update({ settled })
    .eq('expense_id', args.expenseIds[0])
    .eq('person', args.person);

  throwIfSupabaseError(error, 'expense settle split');
}

export async function settleMonthSplits(
  expenseIds: string[],
  person: string,
  settled: boolean
): Promise<void> {
  const args = parseOrThrow(
    settleSplitSchema,
    { expenseIds, person, settled },
    'expense.settle-month'
  );
  const { supabase } = await requireActionContext();

  const { error } = await supabase
    .from('expense_splits')
    .update({ settled: args.settled })
    .in('expense_id', args.expenseIds)
    .eq('person', args.person);

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
