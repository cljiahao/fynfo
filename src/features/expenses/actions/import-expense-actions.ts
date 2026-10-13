'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
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
