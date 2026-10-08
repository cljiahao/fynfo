'use server';

import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { decryptNumber } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { dividendInputSchema } from '../schemas';
import type { DividendData } from '../types';

export async function getDividends(): Promise<DividendData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('equity_dividends')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  throwIfSupabaseError(error, 'dividends read');

  return (data || []).map((d) => ({
    id: d.id,
    ticker: decryptPayload(d.ticker, dek),
    amount: decryptNumber(d.amount, dek),
    currency: d.currency as DividendData['currency'],
    date: d.date,
  }));
}

export async function createDividend(
  data: Omit<DividendData, 'id'>
): Promise<void> {
  const parsed = parseOrThrow(dividendInputSchema, data, 'dividend.input');
  const { userId, dek, supabase } = await requireActionContext();

  const { error } = await supabase.from('equity_dividends').insert({
    id: randomUUID(),
    user_id: userId,
    ticker: encryptPayload(parsed.ticker, dek),
    amount: encryptPayload(parsed.amount.toString(), dek),
    currency: parsed.currency,
    date: parsed.date.slice(0, 10),
  });

  throwIfSupabaseError(error, 'dividend write');
}

export async function createDividends(
  rows: Omit<DividendData, 'id'>[]
): Promise<void> {
  if (rows.length === 0) return;
  const parsed = rows.map((r) =>
    parseOrThrow(dividendInputSchema, r, 'dividend.input')
  );
  const { userId, dek, supabase } = await requireActionContext();

  const inserts = parsed.map((r) => ({
    id: randomUUID(),
    user_id: userId,
    ticker: encryptPayload(r.ticker, dek),
    amount: encryptPayload(r.amount.toString(), dek),
    currency: r.currency,
    date: r.date.slice(0, 10),
  }));

  const { error } = await supabase.from('equity_dividends').insert(inserts);
  throwIfSupabaseError(error, 'dividend write');
}

export async function updateDividend(
  id: string,
  data: Omit<DividendData, 'id'>
): Promise<void> {
  const parsed = parseOrThrow(dividendInputSchema, data, 'dividend.input');
  const { userId, dek, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('equity_dividends')
    .update({
      ticker: encryptPayload(parsed.ticker, dek),
      amount: encryptPayload(parsed.amount.toString(), dek),
      currency: parsed.currency,
      date: parsed.date.slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'dividend write');
}

export async function deleteDividend(id: string): Promise<void> {
  const { userId, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('equity_dividends')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'dividend write');
}
