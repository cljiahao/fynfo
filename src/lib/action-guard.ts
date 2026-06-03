import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { getVaultDekSession } from '@/lib/keystore';
import type { SupabaseClient } from '@supabase/supabase-js';

async function getDekOrThrow(): Promise<Buffer> {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

async function getVerifiedUserId(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) throw new Error('Unauthorized');
  return user.id;
}

// For actions that need auth + vault + DB (encrypted reads/writes)
export async function requireActionContext(): Promise<{
  userId: string;
  dek: Buffer;
  supabase: SupabaseClient;
}> {
  const supabase = await createSupabaseServerClient();
  const [userId, dek] = await Promise.all([
    getVerifiedUserId(supabase),
    getDekOrThrow(),
  ]);
  return { userId, dek, supabase };
}

// For actions that only need auth + DB (deletes, non-encrypted data)
export async function requireDbContext(): Promise<{
  userId: string;
  supabase: SupabaseClient;
}> {
  const supabase = await createSupabaseServerClient();
  const userId = await getVerifiedUserId(supabase);
  return { userId, supabase };
}
