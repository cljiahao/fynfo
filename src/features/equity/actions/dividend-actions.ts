'use server';

import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { decryptNumber } from '@/lib/crypto-fields';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { RECORD_ID } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import { MAX_PRICE_CONCURRENCY } from '../constants';
import {
  buildDividendScan,
  dividendScanMarkets,
  dividendScanTickers,
  type DividendFeed,
} from '../lib/dividend-scan';
import { dividendInputSchema } from '../schemas';
import type { DividendData } from '../types';
import { getTrades } from './equity-actions';
import { fetchDividends } from './price-actions';

export async function getDividends(): Promise<DividendData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const data = await readAllRows(
    (from, to) =>
      supabase
        .from('equity_dividends')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    'dividends read'
  );

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
  parseOrThrow(RECORD_ID, id, 'dividend.id');
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
  parseOrThrow(RECORD_ID, id, 'dividend.id');
  const { userId, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('equity_dividends')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  throwIfSupabaseError(error, 'dividend write');
}

/**
 * Inserts dividends the market feed shows but the vault lacks. Unlike the
 * manual dialog there is no confirmation, so only the hardened scan's
 * non-duplicate candidates are written. Rejects only when nothing could be
 * scanned, so the caller does not mark a failed run as complete.
 */
export async function autoScanDividends(): Promise<{ added: number }> {
  await requireActionContext();
  try {
    const [trades, existing] = await Promise.all([getTrades(), getDividends()]);
    const tickers = dividendScanTickers(trades);
    const markets = dividendScanMarkets(trades);
    const feeds: Record<string, DividendFeed> = {};
    const fetchFailed: string[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < tickers.length) {
        const ticker = tickers[cursor++];
        try {
          feeds[ticker] = await fetchDividends(ticker, markets[ticker]);
        } catch {
          fetchFailed.push(ticker);
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(MAX_PRICE_CONCURRENCY, tickers.length) },
        worker
      )
    );
    if (tickers.length > 0 && fetchFailed.length === tickers.length) {
      throw new AppError('EXTERNAL_API', 'Dividend data unavailable');
    }

    const { candidates } = buildDividendScan(
      trades,
      feeds,
      existing,
      fetchFailed
    );
    await createDividends(
      candidates.map((c) => ({
        ticker: c.ticker,
        date: c.date,
        amount: c.amount,
        currency: c.currency,
      }))
    );
    return { added: candidates.length };
  } catch (error) {
    logger.error({ err: error }, 'dividend auto-scan failed');
    throw new AppError('INTERNAL', 'Dividend scan failed');
  }
}
