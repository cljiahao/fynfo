export type Market = 'SG' | 'US';

const PREFIX_RE = /^(SG|US):(.+)$/;

/** The market is stored inside the encrypted ticker so no schema change leaks it. */
export function encodeTickerMarket(ticker: string, market?: Market): string {
  return market ? `${market}:${ticker}` : ticker;
}

/** Rows written before markets existed have no prefix and decode to `undefined`. */
export function decodeTickerMarket(stored: string): {
  ticker: string;
  market: Market | undefined;
} {
  const match = PREFIX_RE.exec(stored);
  if (!match) return { ticker: stored, market: undefined };
  return { ticker: match[2], market: match[1] as Market };
}
