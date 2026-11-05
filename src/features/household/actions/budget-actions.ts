'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { ROW_UUID } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import { BUDGET_EXISTS } from '../constants';
import { normalizeCategory } from '../lib/spending-stats';
import { setCategoryBudgetSchema } from '../schemas';
import type { SpendingBudget } from '../types';

interface BudgetRow {
  id: string;
  category: string;
  monthly_amount: string;
}

type Context = Awaited<ReturnType<typeof requireHouseholdContext>>;

// category and monthly_amount are encrypted, so ordering and matching happen
// after decryption (constitution §5.4); rows are ordered by id for stable pages.
async function readBudgets(ctx: Context): Promise<SpendingBudget[]> {
  const rows = await readAllRows<BudgetRow>(
    (from, to) =>
      ctx.supabase
        .from('household_spending_budgets')
        .select('id, category, monthly_amount', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to),
    'household spending budgets read'
  );
  return rows
    .map((row) => ({
      id: row.id,
      category: decryptPayload(row.category, ctx.kh),
      monthlyAmount: Number(decryptPayload(row.monthly_amount, ctx.kh)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/** Reads the household's decrypted monthly category budgets. */
export async function getSpendingBudgets(): Promise<SpendingBudget[]> {
  return readBudgets(await requireHouseholdContext());
}

/** Creates a category budget, or updates one when `id` is given. */
export async function setCategoryBudget(input: unknown): Promise<void> {
  const data = parseOrThrow(
    setCategoryBudgetSchema,
    input,
    'household.budget.input'
  );
  const ctx = await requireHouseholdContext();
  const { userId, kh, supabase } = ctx;

  const key = normalizeCategory(data.category);
  const existing = await readBudgets(ctx);
  if (
    existing.some(
      (budget) =>
        budget.id !== data.id && normalizeCategory(budget.category) === key
    )
  )
    throw new AppError('VALIDATION', BUDGET_EXISTS);

  const category = encryptPayload(data.category, kh);
  const monthlyAmount = encryptPayload(data.monthlyAmount.toString(), kh);

  if (data.id) {
    const { error } = await supabase
      .from('household_spending_budgets')
      .update({
        category,
        monthly_amount: monthlyAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id);
    throwIfSupabaseError(error, 'household budget update');
    return;
  }

  const { data: memberData, error: memberErr } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId);
  throwIfSupabaseError(memberErr, 'household member read');
  const householdId = ((memberData ?? [])[0] as { household_id: string })
    ?.household_id;
  if (!householdId) throw new Error('No household');

  const { error } = await supabase.from('household_spending_budgets').insert({
    id: randomUUID(),
    household_id: householdId,
    category,
    monthly_amount: monthlyAmount,
    created_by: userId,
  });
  throwIfSupabaseError(error, 'household budget create');
}

/** Deletes one category budget (RLS scoped). */
export async function deleteCategoryBudget(id: string): Promise<void> {
  parseOrThrow(ROW_UUID, id, 'household.deleteBudget.id');
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_spending_budgets')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household budget delete');
}
