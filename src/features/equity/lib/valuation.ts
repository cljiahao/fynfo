import type { Holding } from './holdings';

export interface ValuationQuote {
  price: number;
  currency: string;
  asOf?: string | null;
}

export function nativeCurrency(market: 'SG' | 'US'): 'SGD' | 'USD' {
  return market === 'SG' ? 'SGD' : 'USD';
}

export function holdingPrice(
  holding: Holding,
  prices: Record<string, ValuationQuote> | undefined
): number | null {
  const quote = prices?.[holding.ticker];
  return quote &&
    quote.currency === nativeCurrency(holding.market) &&
    Number.isFinite(quote.price) &&
    quote.price >= 0
    ? quote.price
    : null;
}

export function marketValue(
  holdings: Holding[],
  prices: Record<string, ValuationQuote> | undefined
): number | null {
  let total = 0;
  for (const holding of holdings) {
    const price = holdingPrice(holding, prices);
    if (price === null) return null;
    total += holding.shares * price;
  }
  return Number.isFinite(total) ? total : null;
}

export function validExchangeRate(
  rate: number | null | undefined
): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

export function finiteProduct(value: number, rate: number): number | null {
  const result = value * rate;
  return Number.isFinite(result) ? result : null;
}
