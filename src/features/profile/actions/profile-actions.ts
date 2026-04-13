'use server';

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import type { ProfileData } from '../types';

export async function getProfile(): Promise<ProfileData | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

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
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

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
