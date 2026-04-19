import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { getVaultDekSession } from '@/lib/keystore';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getDekOrThrow(): Promise<Buffer> {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

// For actions that need auth + vault + DB (encrypted reads/writes)
export async function requireActionContext(): Promise<{
  userId: string;
  dek: Buffer;
  supabase: SupabaseClient;
}> {
  const [userId, dek] = await Promise.all([requireUserId(), getDekOrThrow()]);
  const supabase = await createSupabaseServerClient();
  return { userId, dek, supabase };
}

// For actions that only need auth + DB (deletes, non-encrypted data)
export async function requireDbContext(): Promise<{
  userId: string;
  supabase: SupabaseClient;
}> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  return { userId, supabase };
}
