'use server';

import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalNumber } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { equityTradeInputSchema } from '../schemas';
import type { EquityTradeData } from '../types';

export async function getTrades(): Promise<EquityTradeData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('equity_trades')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  throwIfSupabaseError(error, 'trades read');

  return Promise.all(
    (data || []).map(async (t) => ({
      id: t.id,
      date: t.date,
      broker: t.broker,
      ticker: await decryptPayload(t.ticker, dek),
      action: t.action as EquityTradeData['action'],
      shares: await decryptNumber(t.shares, dek),
      price: await decryptNumber(t.price, dek),
      fees: await decryptOptionalNumber(t.fees, dek),
      isCdp: t.is_cdp ?? false,
      isPO: t.is_po ?? false,
    }))
  );
}

export async function createTrade(
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  const parsed = parseOrThrow(
    equityTradeInputSchema,
    data,
    'equity.trade.input'
  );
  const { userId, dek, supabase } = await requireActionContext();

  const { error } = await supabase.from('equity_trades').insert({
    id: randomUUID(),
    user_id: userId,
    date: new Date(parsed.date).toISOString(),
    broker: parsed.broker,
    ticker: await encryptPayload(parsed.ticker, dek),
    action: parsed.action,
    shares: await encryptPayload(parsed.shares.toString(), dek),
    price: await encryptPayload(parsed.price.toString(), dek),
    fees: await encryptPayload(parsed.fees.toString(), dek),
    is_cdp: parsed.isCdp ?? false,
    is_po: parsed.isPO ?? false,
  });

  throwIfSupabaseError(error, 'equity trade write');
}

export async function updateTrade(
  id: string,
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  const parsed = parseOrThrow(
    equityTradeInputSchema,
    data,
    'equity.trade.input'
  );
  const { userId, dek, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('equity_trades')
    .update({
      date: new Date(parsed.date).toISOString(),
      broker: parsed.broker,
      ticker: await encryptPayload(parsed.ticker, dek),
      action: parsed.action,
      shares: await encryptPayload(parsed.shares.toString(), dek),
      price: await encryptPayload(parsed.price.toString(), dek),
      fees: await encryptPayload(parsed.fees.toString(), dek),
      is_cdp: parsed.isCdp ?? false,
      is_po: parsed.isPO ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'equity trade write');
}

export async function deleteTrade(id: string): Promise<void> {
  const { userId, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('equity_trades')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'equity trade write');
}
