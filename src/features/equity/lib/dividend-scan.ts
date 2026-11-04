import type { DividendCurrency, DividendData, EquityTradeData } from '../types';
import { type DividendPoint, sharesHeldBeforeExDate } from './dividend-suggest';
import { getMarket } from './ticker-map';

const MARKET_TIME_ZONE = {
  SG: 'Asia/Singapore',
  US: 'America/New_York',
} as const;

const DAY_MS = 86_400_000;
const DEDUPE_DAYS_BEFORE = 3;
const DEDUPE_DAYS_AFTER = 60;
const DEDUPE_MIN_TOLERANCE = 0.02;
const DEDUPE_RELATIVE_TOLERANCE = 0.02;

export interface DividendCandidate {
  ticker: string;
  // Feed ex-date, not a confirmed payment date.
  date: string;
  dpu: number;
  shares: number;
  amount: number;
  currency: DividendCurrency;
}

export type DividendSkipReason =
  | 'fetch'
  | 'malformed-trade'
  | 'currency-mismatch';

export interface DividendScanSkip {
  ticker: string;
  reason: DividendSkipReason;
}

export interface DividendScanResult {
  candidates: DividendCandidate[];
  skipped: DividendScanSkip[];
}

/** One ticker's market-data response. `currency` is absent when the feed omits it. */
export interface DividendFeed {
  points: DividendPoint[];
  currency?: string;
}

/** Calendar day (YYYY-MM-DD) of a feed timestamp in the exchange's own time zone. */
export function exchangeLocalDate(
  epochSeconds: number,
  market: 'SG' | 'US'
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIME_ZONE[market],
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(epochSeconds * 1000));
}

export function dividendScanTickers(trades: EquityTradeData[]): string[] {
  return [...new Set(trades.map((trade) => normalizeTicker(trade.ticker)))];
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function dayNumber(value: string): number | null {
  const ms = Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(ms) ? Math.round(ms / DAY_MS) : null;
}

/**
 * Candidates already covered by a recorded dividend. Payments usually land
 * weeks after the ex-date, so a match is any same-ticker row of similar amount
 * inside a window after it. Each recorded row suppresses one candidate, nearest
 * date first, so monthly payers are not swallowed by a single entry.
 */
function duplicateCandidates(
  candidates: DividendCandidate[],
  existing: DividendData[]
): Set<DividendCandidate> {
  const pairs: Array<{
    candidate: DividendCandidate;
    row: number;
    gap: number;
  }> = [];
  existing.forEach((row, rowIndex) => {
    const rowDay = dayNumber(row.date);
    if (rowDay === null) return;
    const rowTicker = normalizeTicker(row.ticker);
    for (const candidate of candidates) {
      if (candidate.ticker !== rowTicker) continue;
      const exDay = dayNumber(candidate.date);
      if (exDay === null) continue;
      const offset = rowDay - exDay;
      if (offset === 0) {
        pairs.push({ candidate, row: rowIndex, gap: 0 });
        continue;
      }
      if (offset < -DEDUPE_DAYS_BEFORE || offset > DEDUPE_DAYS_AFTER) continue;
      const tolerance = Math.max(
        DEDUPE_MIN_TOLERANCE,
        DEDUPE_RELATIVE_TOLERANCE * candidate.amount
      );
      if (Math.abs(row.amount - candidate.amount) > tolerance) continue;
      pairs.push({ candidate, row: rowIndex, gap: Math.abs(offset) });
    }
  });
  pairs.sort((a, b) => a.gap - b.gap);
  const usedRows = new Set<number>();
  const matched = new Set<DividendCandidate>();
  for (const pair of pairs) {
    if (usedRows.has(pair.row) || matched.has(pair.candidate)) continue;
    usedRows.add(pair.row);
    matched.add(pair.candidate);
  }
  return matched;
}

/**
 * Historical gross estimates; current ownership does not establish past
 * entitlement. `feeds` holds each ticker's market data and `fetchFailed` the
 * tickers whose fetch rejected; those are reported in `skipped` rather than
 * failing the whole scan.
 */
export function buildDividendScan(
  trades: EquityTradeData[],
  feeds: Record<string, DividendFeed>,
  existing: DividendData[],
  fetchFailed: readonly string[] = []
): DividendScanResult {
  const failed = new Set(fetchFailed.map(normalizeTicker));
  const skipped: DividendScanSkip[] = [];
  const found: DividendCandidate[] = [];

  for (const ticker of dividendScanTickers(trades)) {
    if (failed.has(ticker)) {
      skipped.push({ ticker, reason: 'fetch' });
      continue;
    }
    // A far-future date visits every trade for the ticker, so any unusable one
    // surfaces here.
    if (sharesHeldBeforeExDate(trades, ticker, '9999-12-31') === null) {
      skipped.push({ ticker, reason: 'malformed-trade' });
      continue;
    }
    const feed = feeds[ticker] ?? { points: [] };
    const currency: DividendCurrency =
      getMarket(ticker) === 'US' ? 'USD' : 'SGD';
    if (feed.currency && feed.currency.toUpperCase() !== currency) {
      skipped.push({ ticker, reason: 'currency-mismatch' });
      continue;
    }

    const seenDates = new Set<string>();
    for (const point of feed.points) {
      const date = point.exDate.slice(0, 10);
      if (seenDates.has(date)) continue;
      const shares = sharesHeldBeforeExDate(trades, ticker, point.exDate);
      if (shares === null || shares <= 0) continue;
      if (!Number.isFinite(point.dpu) || point.dpu <= 0) continue;
      const amount = Math.round(point.dpu * shares * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      seenDates.add(date);
      found.push({ ticker, date, dpu: point.dpu, shares, amount, currency });
    }
  }

  const duplicates = duplicateCandidates(found, existing);
  return {
    candidates: found
      .filter((candidate) => !duplicates.has(candidate))
      .sort((a, b) => b.date.localeCompare(a.date)),
    skipped,
  };
}
