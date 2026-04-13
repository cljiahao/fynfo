'use server';

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { getVaultDekSession } from '@/lib/keystore';
import { randomUUID } from 'crypto';
import type { SalaryData } from '../types';

async function getDekOrThrow() {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

export async function getSalaryRecords(): Promise<SalaryData[]> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

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
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

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
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  const encSalary = await encryptPayload(data.salary.toString(), dek);
  const encBonus = await encryptPayload(data.bonus.toString(), dek);

  // For Prisma's 'upsert', we use Supabase's upsert on the unique combination
  const { error } = await supabase.from('salary_records').upsert(
    {
      id: randomUUID(), // Ignored on update, required on insert
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
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('salary_records')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);

  if (error) throw new Error(error.message);
}
