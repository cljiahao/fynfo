'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { withDeadline } from '@/lib/with-deadline';
import { z } from 'zod';
import {
  IMPORT_SAVE_GROUP_SIZE,
  IMPORT_SAVE_MAX_BYTES,
  IMPORT_SERVER_STEP_TIMEOUT_MS,
} from '../constants';
import {
  importedExpenseSchema,
  importedExpenseValues,
  type ImportExpenseOutcome,
} from '../lib/import-expense';
import { sameExpenseValues } from '../lib/reuse-draft';
import { getExpenses } from './expense-actions';

/** Insert-only: unknown outcomes never overwrite a subsequently edited expense. */
export async function insertImportedExpense(
  input: unknown
): Promise<ImportExpenseOutcome> {
  const parsed = importedExpenseSchema.safeParse(input);
  if (!parsed.success) return { id: '', status: 'not_saved' };
  const value = importedExpenseValues(parsed.data);
  let sent = false;
  try {
    const { userId, dek, supabase } = await requireActionContext();
    const [item, info, amount] = await Promise.all([
      encryptPayload(value.item, dek),
      encryptPayload(value.info, dek),
      encryptPayload(String(value.amount), dek),
    ]);
    sent = true;
    const { error } = await supabase.from('expense_records').insert({
      id: value.id,
      user_id: userId,
      date: `${value.date}T00:00:00.000Z`,
      type: value.type,
      item,
      info,
      amount,
      split_type: 'self',
    });
    if (!error) return { id: value.id, status: 'confirmed' };
    if (error.code === '23505') {
      const saved = (await getExpenses()).find((row) => row.id === value.id);
      return {
        id: value.id,
        status: !saved
          ? 'unconfirmed'
          : sameExpenseValues(saved, value)
            ? 'confirmed'
            : 'conflict',
      };
    }
    // These SQLSTATE errors reject the insert transaction; gateway/timeout errors
    // do not establish rollback and must remain unconfirmed (spec136).
    return {
      id: value.id,
      status: ['23502', '23503', '23514', '42501'].includes(error.code ?? '')
        ? 'not_saved'
        : 'unconfirmed',
    };
  } catch {
    return { id: value.id, status: sent ? 'unconfirmed' : 'not_saved' };
  }
}

/** One insert transaction per bounded group; never update an existing identity. */
export async function insertImportedExpenses(
  input: unknown
): Promise<ImportExpenseOutcome[]> {
  const parsed = z
    .array(importedExpenseSchema)
    .min(1)
    .max(IMPORT_SAVE_GROUP_SIZE)
    .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length)
    .refine(
      (rows) =>
        new TextEncoder().encode(JSON.stringify(rows)).length <=
        IMPORT_SAVE_MAX_BYTES
    )
    .safeParse(input);
  if (!parsed.success) return [];
  const values = parsed.data.map(importedExpenseValues);
  let sent = false;
  try {
    const { userId, dek, supabase } = await withDeadline(
      requireActionContext(),
      IMPORT_SERVER_STEP_TIMEOUT_MS
    );
    const records = await Promise.all(
      values.map(async (value) => {
        const [item, info, amount] = await Promise.all([
          encryptPayload(value.item, dek),
          encryptPayload(value.info, dek),
          encryptPayload(String(value.amount), dek),
        ]);
        return {
          id: value.id,
          user_id: userId,
          date: `${value.date}T00:00:00.000Z`,
          type: value.type,
          item,
          info,
          amount,
          split_type: 'self',
        };
      })
    );
    sent = true;
    const { error } = await withDeadline(
      supabase.from('expense_records').insert(records),
      IMPORT_SERVER_STEP_TIMEOUT_MS
    );
    if (!error) return values.map(({ id }) => ({ id, status: 'confirmed' }));
    if (error.code === '23505') {
      // PostgreSQL rejected the entire insert, so absent IDs were not written.
      const saved = await withDeadline(
        getExpenses(),
        IMPORT_SERVER_STEP_TIMEOUT_MS
      );
      return values.map((value) => {
        const record = saved.find((row) => row.id === value.id);
        return {
          id: value.id,
          status: !record
            ? 'not_saved'
            : sameExpenseValues(record, value)
              ? 'confirmed'
              : 'conflict',
        };
      });
    }
    const rejected = ['23502', '23503', '23514', '42501'].includes(
      error.code ?? ''
    );
    return values.map(({ id }) =>
      rejected
        ? { id, status: 'not_saved', reason: 'rejected' }
        : { id, status: 'unconfirmed' }
    );
  } catch {
    return values.map(({ id }) =>
      sent
        ? { id, status: 'unconfirmed' }
        : { id, status: 'not_saved', reason: 'access' }
    );
  }
}
