'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { taxReliefListSchema } from '../schemas';
import type { TaxReliefData } from '../types';

export async function getTaxReliefs(year: number): Promise<TaxReliefData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const data = await readAllRows(
    (from, to) =>
      supabase
        .from('tax_relief_entries')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('year', year)
        .order('id', { ascending: true })
        .range(from, to),
    'tax_relief read'
  );

  return Promise.all(
    data.map(async (e) => ({
      reliefKey: e.relief_key,
      amount: await decryptNumber(e.amount, dek),
    }))
  );
}

/** Every tax-relief row for the user across all years (for data export). */
export async function getAllTaxReliefs(): Promise<
  Array<TaxReliefData & { year: number }>
> {
  const { userId, dek, supabase } = await requireActionContext();

  const data = await readAllRows(
    (from, to) =>
      supabase
        .from('tax_relief_entries')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('year', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'tax_relief read'
  );

  return Promise.all(
    data.map(async (e) => ({
      year: e.year as number,
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
  const validatedReliefs = parseOrThrow(
    taxReliefListSchema,
    reliefs,
    'tax_relief.reliefs'
  );
  const { dek, supabase } = await requireActionContext();

  const inserts = await Promise.all(
    validatedReliefs.map(async (r) => ({
      id: randomUUID(),
      relief_key: r.reliefKey,
      amount: await encryptPayload(r.amount.toString(), dek),
    }))
  );

  const { error } = await supabase.rpc('replace_tax_relief_year', {
    p_year: year,
    p_reliefs: inserts,
  });
  throwIfSupabaseError(error, 'tax_relief save');
}
