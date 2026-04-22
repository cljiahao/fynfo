import { describe, expect, it } from 'vitest';

import { getMarket, getYahooSymbol } from '@/features/equity/lib/ticker-map';

describe('getYahooSymbol', () => {
  it('maps known SG tickers to their Yahoo Finance symbols', () => {
    expect(getYahooSymbol('DBS')).toBe('D05.SI');
    expect(getYahooSymbol('OCBC')).toBe('O39.SI');
    expect(getYahooSymbol('UOB')).toBe('U11.SI');
    expect(getYahooSymbol('SINGTEL')).toBe('Z74.SI');
    expect(getYahooSymbol('ASCENDAS')).toBe('A17U.SI');
  });

  it('returns the ticker as-is for US stocks', () => {
    expect(getYahooSymbol('AAPL')).toBe('AAPL');
    expect(getYahooSymbol('MSFT')).toBe('MSFT');
    expect(getYahooSymbol('NVDA')).toBe('NVDA');
  });

  it('returns an unknown ticker as-is (no mapping fallback)', () => {
    expect(getYahooSymbol('UNKNOWN')).toBe('UNKNOWN');
  });

  it('is case-insensitive for SG tickers', () => {
    expect(getYahooSymbol('dbs')).toBe('D05.SI');
    expect(getYahooSymbol('Ocbc')).toBe('O39.SI');
  });

  it('is case-insensitive for US tickers', () => {
    expect(getYahooSymbol('aapl')).toBe('AAPL');
  });
});

describe('getMarket', () => {
  it('returns SG for tickers in the SG map', () => {
    expect(getMarket('DBS')).toBe('SG');
    expect(getMarket('SUNTEC')).toBe('SG');
    expect(getMarket('MLT')).toBe('SG');
    expect(getMarket('KDC')).toBe('SG');
  });

  it('returns US for tickers not in the SG map', () => {
    expect(getMarket('AAPL')).toBe('US');
    expect(getMarket('META')).toBe('US');
    expect(getMarket('GOOGL')).toBe('US');
  });

  it('returns US for unrecognised tickers', () => {
    expect(getMarket('XYZ')).toBe('US');
  });

  it('is case-insensitive', () => {
    expect(getMarket('dbs')).toBe('SG');
    expect(getMarket('aapl')).toBe('US');
  });
});
