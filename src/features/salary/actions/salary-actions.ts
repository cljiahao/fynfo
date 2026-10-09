'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { salaryDataSchema } from '../schemas';
import type { SalaryData } from '../types';

export async function getSalaryRecords(): Promise<SalaryData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const data = await readAllRows(
    (from, to) =>
      supabase
        .from('salary_records')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('month', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'salary read'
  );

  return Promise.all(
    (data || []).map(async (r) => ({
      id: r.month,
      salary: await decryptNumber(r.salary, dek),
      bonus: await decryptNumber(r.bonus, dek),
    }))
  );
}

export async function getSalaryRecord(id: string): Promise<SalaryData | null> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('user_id', userId)
    .eq('month', id)
    .maybeSingle();

  throwIfSupabaseError(error, 'salary record read');
  if (!data) return null;

  return {
    id: data.month,
    salary: await decryptNumber(data.salary, dek),
    bonus: await decryptNumber(data.bonus, dek),
  };
}

export async function upsertSalaryRecord(data: SalaryData): Promise<void> {
  parseOrThrow(salaryDataSchema, data, 'salary.upsert.input');
  const { userId, dek, supabase } = await requireActionContext();

  const [encSalary, encBonus] = await Promise.all([
    encryptPayload(data.salary.toString(), dek),
    encryptPayload(data.bonus.toString(), dek),
  ]);

  const { error } = await supabase.from('salary_records').upsert(
    {
      id: randomUUID(),
      user_id: userId,
      month: data.id,
      salary: encSalary,
      bonus: encBonus,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id, month',
      ignoreDuplicates: false,
    }
  );

  throwIfSupabaseError(error, 'salary write');
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  const { userId, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('salary_records')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);

  throwIfSupabaseError(error, 'salary write');
}
