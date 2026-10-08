import type { Holding } from '@/features/equity/lib/holdings';
import { buildCashFlows, computeIRR } from '@/features/equity/lib/mwr';
import type { EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

const trade = (o: Partial<EquityTradeData>): EquityTradeData => ({
  date: '2025-06-25',
  broker: 'IBKR',
  ticker: 'AAPL',
  action: 'buy',
  shares: 10,
  price: 5,
  fees: 1,
  ...o,
});

const holding = (o: Partial<Holding>): Holding => ({
  ticker: 'AAPL',
  market: 'US',
  shares: 10,
  totalBuyCost: 51,
  totalBuyShares: 10,
  avgBuyPrice: 5.1,
  costBasis: 5.1,
  ...o,
});

describe('computeIRR', () => {
  it('returns 0 for fewer than two cash flows', () => {
    expect(computeIRR([])).toBe(0);
    expect(computeIRR([{ date: new Date('2025-01-01'), amount: -100 }])).toBe(
      0
    );
  });

  it('solves ~10% for a 100 → 110 gain over one year', () => {
    const r = computeIRR([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2026-01-01'), amount: 110 },
    ]);
    expect(r).toBeCloseTo(10, 0);
  });

  it('returns a negative rate for a loss', () => {
    const r = computeIRR([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2026-01-01'), amount: 90 },
    ]);
    expect(r).toBeLessThan(0);
    expect(r).toBeCloseTo(-10, 0);
  });

  it('stays finite (clamped) for an extreme overnight gain', () => {
    const r = computeIRR([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2025-01-02'), amount: 1_000_000 },
    ]);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
});

describe('buildCashFlows', () => {
  it('records a buy as money out (negative, incl. fees)', () => {
    const flows = buildCashFlows([trade({ action: 'buy' })], [], {});
    expect(flows).toHaveLength(1);
    // -(10*5 + 1)
    expect(flows[0].amount).toBe(-51);
  });

  it('records a sell as net proceeds after fees', () => {
    const flows = buildCashFlows(
      [trade({ action: 'sell', shares: 10, price: 6, fees: 1 })],
      [],
      {}
    );
    expect(flows[0].amount).toBe(59);
  });

  it('adds current holding value as a positive flow dated at `now`', () => {
    const now = new Date('2026-06-25');
    const flows = buildCashFlows(
      [],
      [holding({ ticker: 'AAPL', shares: 10 })],
      { AAPL: { price: 20 } },
      undefined,
      now
    );
    expect(flows).toHaveLength(1);
    expect(flows[0].amount).toBe(200);
    expect(flows[0].date).toBe(now);
  });

  it('skips holdings with no/zero price', () => {
    const flows = buildCashFlows([], [holding({ ticker: 'AAPL' })], {});
    expect(flows).toHaveLength(0);
  });

  it('applies the market filter to trades', () => {
    const flows = buildCashFlows(
      [trade({ ticker: 'AAPL' }), trade({ ticker: 'DBS' })],
      [],
      {},
      'US'
    );
    // only the US (AAPL) trade
    expect(flows).toHaveLength(1);
  });

  it('sorts flows ascending by date', () => {
    const now = new Date('2026-06-25');
    const flows = buildCashFlows(
      [
        trade({ date: '2026-01-01', ticker: 'AAPL' }),
        trade({ date: '2025-01-01', ticker: 'AAPL' }),
      ],
      [holding({ ticker: 'AAPL', shares: 10 })],
      { AAPL: { price: 20 } },
      undefined,
      now
    );
    const times = flows.map((f) => f.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
