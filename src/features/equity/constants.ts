// Bounds server work independently of the caller's holdings UI.
export const MAX_PRICE_TICKERS = 100;
export const MAX_PRICE_CONCURRENCY = 5;
export const PRICE_FETCH_TIMEOUT_MS = 10_000;

export const VALUATION_MARKETS = ['SG', 'US'] as const;
