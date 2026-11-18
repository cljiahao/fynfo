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

  it('costBasis stays at the average cost after a partial sell', () => {
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
    expect(holding.costBasis).toBe(100);
    expect(holding.avgBuyPrice).toBe(100);
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

  describe('average-cost method', () => {
    it('removes sold lots from remaining cost', () => {
      const [h] = computeHoldings([
        makeTrade({ ticker: 'A', action: 'buy', shares: 100, price: 10 }),
        makeTrade({ ticker: 'A', action: 'sell', shares: 50, price: 20 }),
      ]);
      expect(h.costBasis).toBe(10);
      expect(h.avgBuyPrice * h.shares).toBe(500);
    });

    it('blends later buys with the remaining cost', () => {
      const [h] = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 100,
          price: 10,
          date: '2025-01-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 50,
          price: 20,
          date: '2025-02-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 50,
          price: 30,
          date: '2025-03-01',
        }),
      ]);
      expect(h.shares).toBe(100);
      expect(h.avgBuyPrice).toBe(20);
      expect(h.costBasis).toBe(20);
    });

    it('starts fresh after a full sell and rebuy', () => {
      const [h] = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 10,
          price: 100,
          date: '2025-01-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 10,
          price: 150,
          date: '2025-02-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 10,
          price: 50,
          date: '2025-03-01',
        }),
      ]);
      expect(h.costBasis).toBe(50);
    });

    it('includes buy fees and ignores sell fees', () => {
      const [h] = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 100,
          price: 10,
          fees: 20,
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 50,
          price: 20,
          fees: 99,
        }),
      ]);
      expect(h.costBasis).toBe(10.2);
    });

    it('orders trades by date regardless of input order', () => {
      const [h] = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 50,
          price: 30,
          date: '2025-03-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 50,
          price: 20,
          date: '2025-02-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 100,
          price: 10,
          date: '2025-01-01',
        }),
      ]);
      expect(h.costBasis).toBe(20);
    });
  });

  describe('same-day ordering and float residue', () => {
    const d = '2025-03-01';

    it('same-day sell listed before buy leaves no holding', () => {
      const h = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 10,
          price: 12,
          date: d,
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 10,
          price: 10,
          date: d,
        }),
      ]);
      expect(h).toEqual([]);
    });

    it('same-day sell-first partial keeps remaining shares at the buy price', () => {
      const [h] = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 4,
          price: 12,
          date: d,
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 10,
          price: 10,
          date: d,
        }),
      ]);
      expect(h.shares).toBe(6);
      expect(h.avgBuyPrice).toBeCloseTo(10);
      expect(h.costBasis).toBeCloseTo(10);
    });

    it('float-sized partial sells summing to the position leave no phantom', () => {
      const h = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 9.9999999,
          price: 10,
          date: '2025-01-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 3.3333333,
          price: 11,
          date: '2025-02-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 3.3333333,
          price: 11,
          date: '2025-02-02',
        }),
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 3.3333333,
          price: 11,
          date: '2025-02-03',
        }),
      ]);
      expect(h).toEqual([]);
    });

    it('sorts a date-only string and a full ISO timestamp on different days', () => {
      const [h] = computeHoldings([
        makeTrade({
          ticker: 'A',
          action: 'sell',
          shares: 5,
          price: 20,
          date: '2025-01-02T09:00:00.000Z',
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 10,
          price: 10,
          date: '2025-01-01',
        }),
        makeTrade({
          ticker: 'A',
          action: 'buy',
          shares: 5,
          price: 30,
          date: '2025-01-03',
        }),
      ]);
      expect(h.shares).toBe(10);
      expect(h.avgBuyPrice).toBeCloseTo(20);
    });
  });
});
