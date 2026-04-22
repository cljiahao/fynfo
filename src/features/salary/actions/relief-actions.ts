'use server';

import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { taxReliefDataSchema } from '../schemas';
import type { TaxReliefData } from '../types';

export async function getTaxReliefs(year: number): Promise<TaxReliefData[]> {
  const { userId, dek, supabase } = await requireActionContext();

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
  z.number().int().positive().parse(year);
  z.array(taxReliefDataSchema).parse(reliefs);
  const { userId, dek, supabase } = await requireActionContext();

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
