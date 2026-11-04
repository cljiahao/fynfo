// Bounds server work independently of the caller's holdings UI.
export const MAX_PRICE_TICKERS = 100;
export const MAX_PRICE_CONCURRENCY = 5;
export const PRICE_FETCH_TIMEOUT_MS = 10_000;

// Shared by the price/dividend fetch boundary and the scan pre-filter.
export const SCAN_TICKER_PATTERN = /^[A-Z0-9.\-:]{1,16}$/;

export const VALUATION_MARKETS = ['SG', 'US'] as const;

export const DIVIDEND_SUGGESTED_MESSAGE =
  'Amount suggested. Review before saving.';
