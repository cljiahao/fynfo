import {
  deriveYahooSymbol,
  resolveMarket,
} from '@/features/equity/lib/ticker-map';
import {
  decodeTickerMarket,
  encodeTickerMarket,
} from '@/features/equity/lib/ticker-market';
import { describe, expect, it } from 'vitest';

describe('deriveYahooSymbol', () => {
  it('lets the legacy map win over the stored market', () => {
    expect(deriveYahooSymbol('DBS', 'SG')).toBe('D05.SI');
    expect(deriveYahooSymbol('SASSEUR', undefined)).toBe('CRPU.SI');
  });

  it('suffixes unmapped SG tickers with .SI', () => {
    expect(deriveYahooSymbol('Z74', 'SG')).toBe('Z74.SI');
  });

  it('keeps US and market-less tickers as is', () => {
    expect(deriveYahooSymbol('AAPL', 'US')).toBe('AAPL');
    expect(deriveYahooSymbol('aapl', undefined)).toBe('AAPL');
  });
});

describe('resolveMarket', () => {
  it('prefers the explicit market', () => {
    expect(resolveMarket({ ticker: 'DBS', market: 'US' })).toBe('US');
    expect(resolveMarket({ ticker: 'Z74', market: 'SG' })).toBe('SG');
  });

  it('falls back to the legacy map for trades without a market', () => {
    expect(resolveMarket({ ticker: 'DBS' })).toBe('SG');
    expect(resolveMarket({ ticker: 'AAPL' })).toBe('US');
  });
});

describe('ticker market prefix', () => {
  it('round-trips both markets', () => {
    for (const market of ['SG', 'US'] as const) {
      const stored = encodeTickerMarket('Z74', market);
      expect(stored).toBe(`${market}:Z74`);
      expect(decodeTickerMarket(stored)).toEqual({ ticker: 'Z74', market });
    }
  });

  it('leaves the ticker bare without a market', () => {
    expect(encodeTickerMarket('AAPL')).toBe('AAPL');
  });

  it('decodes an unprefixed value to an undefined market', () => {
    expect(decodeTickerMarket('DBS')).toEqual({
      ticker: 'DBS',
      market: undefined,
    });
  });
});
