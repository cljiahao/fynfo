// Map internal ticker names to Yahoo Finance symbols
const SG_TICKER_MAP: Record<string, string> = {
  SASSEUR: 'CRPU.SI',
  SINGTEL: 'Z74.SI',
  SUNTEC: 'T82U.SI',
  LENDLEASE: 'JYEU.SI',
  DBS: 'D05.SI',
  KDC: 'EB5.SI',
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

export function getMarket(ticker: string): 'SG' | 'US' {
  const upper = ticker.toUpperCase();
  if (SG_TICKER_MAP[upper]) return 'SG';
  return 'US';
}
