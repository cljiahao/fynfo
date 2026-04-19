'use server';

import { requireDbContext } from '@/lib/action-guard';
import type { ProfileData } from '../types';

export async function getProfile(): Promise<ProfileData | null> {
  const { userId, supabase } = await requireDbContext();

  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    birthYear: data.birth_year,
    isNsman: data.is_nsman,
    residencyStatus: data.residency_status as ProfileData['residencyStatus'],
  };
}

export async function upsertProfile(data: ProfileData): Promise<void> {
  const { userId, supabase } = await requireDbContext();

  const { error } = await supabase
    .from('users_profile')
    .update({
      birth_year: data.birthYear,
      is_nsman: data.isNsman,
      residency_status: data.residencyStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}
