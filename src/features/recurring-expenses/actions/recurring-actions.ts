'use server';
import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { z } from 'zod';
import { RECURRING_LIMITS } from '../constants';
import { singaporeToday } from '../lib/calendar';
import {
  applyRecurringCommand,
  recurringRequestRecorded,
} from '../lib/commands';
import { recurringMutationSchema, recurringPayloadSchema } from '../schemas';
import type { RecurringBook, RecurringOutcome } from '../types';
const revision = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((value) => value.length < 19 || value <= '9223372036854775807');
const storedSchema = z.strictObject({
  id: z.uuid(),
  revision,
  payload: z.string().min(1).max(RECURRING_LIMITS.ciphertextBytes),
});

async function readBook(
  context: Awaited<ReturnType<typeof requireActionContext>>
): Promise<RecurringBook | null> {
  const { userId, dek, supabase } = context;
  const { data, error } = await supabase
    .from('personal_recurring_rulebooks')
    .select('id,revision::text,payload')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'recurring template read');
  if (data === null) return null;
  try {
    const row = storedSchema.parse(data);
    const plaintext = decryptPayload(row.payload, dek);
    if (Buffer.byteLength(plaintext, 'utf8') > RECURRING_LIMITS.plaintextBytes)
      throw new Error();
    return {
      id: row.id,
      revision: row.revision,
      payload: recurringPayloadSchema.parse(JSON.parse(plaintext)),
    };
  } catch {
    throw new AppError(
      'VALIDATION',
      'Recurring templates could not be read. Try loading again.'
    );
  }
}
export async function getRecurringRulebook(): Promise<RecurringBook | null> {
  return readBook(await requireActionContext());
}

export async function mutateRecurringRulebook(
  input: unknown
): Promise<RecurringOutcome> {
  const parsed = recurringMutationSchema.safeParse(input);
  if (!parsed.success) return { status: 'not_saved' };
  let sent = false;
  try {
    const context = await requireActionContext();
    const value = parsed.data;
    const current = await readBook(context);
    if (
      current &&
      current.id === value.bookId &&
      recurringRequestRecorded(value, current.payload)
    )
      return { status: 'saved' };
    if (
      (current &&
        (current.id !== value.bookId ||
          current.revision !== value.expectedRevision)) ||
      (!current &&
        (value.expectedRevision !== '0' || value.command.kind !== 'create'))
    )
      return { status: 'conflict' };
    let next;
    try {
      next = applyRecurringCommand(
        current?.payload ?? null,
        value,
        singaporeToday()
      );
    } catch {
      return { status: 'not_saved' };
    }
    const pPayload = encryptPayload(JSON.stringify(next), context.dek);
    if (Buffer.byteLength(pPayload, 'utf8') > RECURRING_LIMITS.ciphertextBytes)
      return { status: 'not_saved' };
    const expense =
      value.command.kind === 'confirm' ? value.command.expense : null;
    const pExpense = expense
      ? {
          id: expense.id,
          date: expense.date,
          type: expense.category,
          item: encryptPayload(expense.item, context.dek),
          info: encryptPayload(expense.info, context.dek),
          amount: encryptPayload(String(expense.cents / 100), context.dek),
        }
      : null;
    sent = true;
    const { data, error } = await context.supabase.rpc(
      'compare_save_personal_recurring_rulebook',
      {
        p_id: value.bookId,
        p_expected_revision: value.expectedRevision,
        p_payload: pPayload,
        p_expense: pExpense,
      }
    );
    if (error) return { status: 'unconfirmed' };
    const result = z
      .array(
        z.strictObject({
          status: z.enum(['SAVED', 'CONFLICT']),
          revision: revision.nullable(),
        })
      )
      .length(1)
      .safeParse(data);
    if (!result.success) return { status: 'unconfirmed' };
    if (result.data[0].status === 'CONFLICT') {
      const latest = await readBook(context);
      return {
        status:
          latest?.id === value.bookId &&
          recurringRequestRecorded(value, latest.payload)
            ? 'saved'
            : 'conflict',
      };
    }
    return {
      status:
        result.data[0].revision ===
        String(BigInt(value.expectedRevision) + BigInt(1))
          ? 'saved'
          : 'unconfirmed',
    };
  } catch {
    return { status: sent ? 'unconfirmed' : 'not_saved' };
  }
}
