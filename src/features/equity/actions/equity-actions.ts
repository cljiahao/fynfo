'use server';

import { requireActionContext, requireDbContext } from '@/lib/action-guard';
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
  parseOrThrow(equityTradeInputSchema, data, 'equity.trade.input');
  const { userId, dek, supabase } = await requireActionContext();

  const { error } = await supabase.from('equity_trades').insert({
    id: randomUUID(),
    user_id: userId,
    date: new Date(data.date).toISOString(),
    broker: data.broker,
    ticker: await encryptPayload(data.ticker.toUpperCase(), dek),
    action: data.action,
    shares: await encryptPayload(data.shares.toString(), dek),
    price: await encryptPayload(data.price.toString(), dek),
    fees: await encryptPayload(data.fees.toString(), dek),
    is_cdp: data.isCdp ?? false,
    is_po: data.isPO ?? false,
  });

  throwIfSupabaseError(error, 'equity trade write');
}

export async function updateTrade(
  id: string,
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  parseOrThrow(equityTradeInputSchema, data, 'equity.trade.input');
  const { userId, dek, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('equity_trades')
    .update({
      date: new Date(data.date).toISOString(),
      broker: data.broker,
      ticker: await encryptPayload(data.ticker.toUpperCase(), dek),
      action: data.action,
      shares: await encryptPayload(data.shares.toString(), dek),
      price: await encryptPayload(data.price.toString(), dek),
      fees: await encryptPayload(data.fees.toString(), dek),
      is_cdp: data.isCdp ?? false,
      is_po: data.isPO ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'equity trade write');
}

export async function deleteTrade(id: string): Promise<void> {
  const { userId, supabase } = await requireDbContext();

  const { error } = await supabase
    .from('equity_trades')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'equity trade write');
}
