'use server';

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { getVaultDekSession } from '@/lib/keystore';
import { randomUUID } from 'crypto';
import type { EquityTradeData } from '../types';

async function getDekOrThrow() {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

export async function getTrades(): Promise<EquityTradeData[]> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('equity_trades')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error || !data) return [];

  return Promise.all(
    data.map(async (t) => ({
      id: t.id,
      date: t.date,
      broker: t.broker,
      ticker: await decryptPayload(t.ticker, dek),
      action: t.action as EquityTradeData['action'],
      shares: Number(await decryptPayload(t.shares, dek)),
      price: Number(await decryptPayload(t.price, dek)),
      fees: Number(await decryptPayload(t.fees || '0', dek)),
    }))
  );
}

export async function createTrade(
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

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
  });

  if (error) throw new Error(error.message);
}

export async function updateTrade(
  id: string,
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function deleteTrade(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('equity_trades')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
