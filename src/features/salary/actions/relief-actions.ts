'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
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

  throwIfSupabaseError(error, 'tax_relief read');

  return Promise.all(
    (data || []).map(async (e) => ({
      reliefKey: e.relief_key,
      amount: await decryptNumber(e.amount, dek),
    }))
  );
}

export async function upsertTaxReliefs(
  year: number,
  reliefs: TaxReliefData[]
): Promise<void> {
  parseOrThrow(z.number().int().positive(), year, 'tax_relief.year');
  parseOrThrow(z.array(taxReliefDataSchema), reliefs, 'tax_relief.reliefs');
  const { userId, dek, supabase } = await requireActionContext();

  const { error: delErr } = await supabase
    .from('tax_relief_entries')
    .delete()
    .eq('user_id', userId)
    .eq('year', year);

  throwIfSupabaseError(delErr, 'tax_relief delete');

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

  throwIfSupabaseError(insErr, 'tax_relief insert');
}
