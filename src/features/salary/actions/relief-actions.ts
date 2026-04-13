'use server';

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { getVaultDekSession } from '@/lib/keystore';
import { randomUUID } from 'crypto';
import type { TaxReliefData } from '../types';

async function getDekOrThrow() {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

export async function getTaxReliefs(year: number): Promise<TaxReliefData[]> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('tax_relief_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year);

  if (error) throw new Error('Failed to fetch tax reliefs');

  return Promise.all(
    (data || []).map(async (e) => ({
      reliefKey: e.relief_key,
      amount: Number(await decryptPayload(e.amount, dek)),
    }))
  );
}

export async function upsertTaxReliefs(
  year: number,
  reliefs: TaxReliefData[]
): Promise<void> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  // Supabase RPC or batch transaction is tough via JS client natively without functions.
  // Instead, delete all for this year and insert sequentially.

  const { error: delErr } = await supabase
    .from('tax_relief_entries')
    .delete()
    .eq('user_id', userId)
    .eq('year', year);

  if (delErr)
    throw new Error('Failed to clear old tax reliefs: ' + delErr.message);

  if (reliefs.length === 0) return;

  const inserts = await Promise.all(
    reliefs.map(async (r) => ({
      id: randomUUID(),
      user_id: userId,
      year,
      relief_key: r.reliefKey,
      amount: await encryptPayload(r.amount.toString(), dek),
    }))
  );

  const { error: insErr } = await supabase
    .from('tax_relief_entries')
    .insert(inserts);

  if (insErr)
    throw new Error('Failed to insert new tax reliefs: ' + insErr.message);
}
