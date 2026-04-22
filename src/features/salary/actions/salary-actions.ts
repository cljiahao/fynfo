'use server';

import { requireActionContext, requireDbContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { randomUUID } from 'crypto';
import { salaryDataSchema } from '../schemas';
import type { SalaryData } from '../types';

export async function getSalaryRecords(): Promise<SalaryData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: true });

  if (error) throw new Error('Failed to fetch salary records');

  return Promise.all(
    (data || []).map(async (r) => ({
      id: r.month,
      salary: Number(await decryptPayload(r.salary, dek)),
      bonus: Number(await decryptPayload(r.bonus, dek)),
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
    .single();

  if (error || !data) return null;

  return {
    id: data.month,
    salary: Number(await decryptPayload(data.salary, dek)),
    bonus: Number(await decryptPayload(data.bonus, dek)),
  };
}

export async function upsertSalaryRecord(data: SalaryData): Promise<void> {
  salaryDataSchema.parse(data);
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

  if (error) throw new Error(error.message);
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  const { userId, supabase } = await requireDbContext();

  const { error } = await supabase
    .from('salary_records')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);

  if (error) throw new Error(error.message);
}
