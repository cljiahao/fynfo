import type { Market } from './ticker-market';

// Map internal ticker names to Yahoo Finance symbols. Legacy fallback for
// trades saved before a market was stored with them.
const SG_TICKER_MAP: Record<string, string> = {
  SASSEUR: 'CRPU.SI',
  SINGTEL: 'Z74.SI',
  SUNTEC: 'T82U.SI',
  LENDLEASE: 'JYEU.SI',
  DBS: 'D05.SI',
  KDC: 'AJBU.SI',
  FCT: 'J69U.SI',
  OCBC: 'O39.SI',
  ASCENDAS: 'A17U.SI',
  FLCT: 'BUOU.SI',
  MLT: 'M44U.SI',
  MIT: 'ME8U.SI',
  UOB: 'U11.SI',
  NETLINK: 'CJLU.SI',
};

export function getYahooSymbol(ticker: string): string {
  const upper = ticker.toUpperCase();
  if (SG_TICKER_MAP[upper]) return SG_TICKER_MAP[upper];
  // US tickers work as-is
  return upper;
}

export function getMarket(ticker: string): Market {
  const upper = ticker.toUpperCase();
  if (SG_TICKER_MAP[upper]) return 'SG';
  return 'US';
}

/** Legacy map entries win so internal names such as SASSEUR keep resolving. */
export function deriveYahooSymbol(
  ticker: string,
  market: Market | undefined
): string {
  const upper = ticker.toUpperCase();
  if (SG_TICKER_MAP[upper]) return SG_TICKER_MAP[upper];
  return market === 'SG' ? `${upper}.SI` : upper;
}

export function resolveMarket(trade: {
  ticker: string;
  market?: Market;
}): Market {
  return trade.market ?? getMarket(trade.ticker);
}
