import { computeHoldings } from '@/features/equity/lib/holdings';
import type { EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

function makeTrade(
  overrides: Partial<EquityTradeData> &
    Pick<EquityTradeData, 'ticker' | 'action' | 'shares' | 'price'>
): EquityTradeData {
  return {
    id: 'trade_1',
    date: '2025-01-01',
    broker: 'test',
    fees: 0,
    ...overrides,
  };
}

describe('computeHoldings', () => {
  it('returns empty array when no trades', () => {
    expect(computeHoldings([])).toEqual([]);
  });

  it('accumulates shares from buy trades', () => {
    const trades = [
      makeTrade({ ticker: 'AAPL', action: 'buy', shares: 10, price: 100 }),
      makeTrade({ ticker: 'AAPL', action: 'buy', shares: 5, price: 120 }),
    ];
    const [holding] = computeHoldings(trades);
    expect(holding.ticker).toBe('AAPL');
    expect(holding.shares).toBe(15);
  });

  it('reduces shares from sell trades', () => {
    const trades = [
      makeTrade({ ticker: 'AAPL', action: 'buy', shares: 10, price: 100 }),
      makeTrade({ ticker: 'AAPL', action: 'sell', shares: 3, price: 130 }),
    ];
    const [holding] = computeHoldings(trades);
    expect(holding.shares).toBe(7);
  });

  it('excludes tickers with zero net shares', () => {
    const trades = [
      makeTrade({ ticker: 'AAPL', action: 'buy', shares: 5, price: 100 }),
      makeTrade({ ticker: 'AAPL', action: 'sell', shares: 5, price: 150 }),
    ];
    expect(computeHoldings(trades)).toHaveLength(0);
  });

  it('computes totalBuyCost including fees', () => {
    const trades = [
      makeTrade({
        ticker: 'AAPL',
        action: 'buy',
        shares: 10,
        price: 100,
        fees: 5,
      }),
    ];
    const [holding] = computeHoldings(trades);
    expect(holding.totalBuyCost).toBe(1005);
  });

  it('computes avgBuyPrice from totalBuyCost / totalBuyShares', () => {
    const trades = [
      makeTrade({
        ticker: 'AAPL',
        action: 'buy',
        shares: 10,
        price: 100,
        fees: 0,
      }),
      makeTrade({
        ticker: 'AAPL',
        action: 'buy',
        shares: 10,
        price: 200,
        fees: 0,
      }),
    ];
    const [holding] = computeHoldings(trades);
    expect(holding.avgBuyPrice).toBe(150);
  });

  it('costBasis only counts remaining shares after partial sell', () => {
    const trades = [
      makeTrade({
        ticker: 'AAPL',
        action: 'buy',
        shares: 10,
        price: 100,
        fees: 0,
      }),
      makeTrade({ ticker: 'AAPL', action: 'sell', shares: 5, price: 150 }),
    ];
    const [holding] = computeHoldings(trades);
    // totalBuyCost = 1000, remaining shares = 5
    expect(holding.costBasis).toBe(200);
    expect(holding.shares).toBe(5);
  });

  it('normalises ticker to uppercase', () => {
    const trades = [
      makeTrade({ ticker: 'aapl', action: 'buy', shares: 1, price: 100 }),
    ];
    const [holding] = computeHoldings(trades);
    expect(holding.ticker).toBe('AAPL');
  });

  it('identifies SG and US markets correctly', () => {
    const trades = [
      makeTrade({ ticker: 'DBS', action: 'buy', shares: 100, price: 30 }),
      makeTrade({ ticker: 'AAPL', action: 'buy', shares: 1, price: 180 }),
    ];
    const holdings = computeHoldings(trades);
    const dbs = holdings.find((h) => h.ticker === 'DBS');
    const aapl = holdings.find((h) => h.ticker === 'AAPL');
    expect(dbs?.market).toBe('SG');
    expect(aapl?.market).toBe('US');
  });

  it('handles multiple tickers independently', () => {
    const trades = [
      makeTrade({ ticker: 'AAPL', action: 'buy', shares: 5, price: 100 }),
      makeTrade({ ticker: 'MSFT', action: 'buy', shares: 3, price: 200 }),
    ];
    const holdings = computeHoldings(trades);
    expect(holdings).toHaveLength(2);
    const aapl = holdings.find((h) => h.ticker === 'AAPL');
    const msft = holdings.find((h) => h.ticker === 'MSFT');
    expect(aapl?.shares).toBe(5);
    expect(msft?.shares).toBe(3);
  });
});
