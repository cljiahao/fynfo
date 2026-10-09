import { computeHoldings } from '@/features/equity/lib/holdings';
import { buildCashFlows, verifiedIRR } from '@/features/equity/lib/mwr';
import {
  holdingPrice,
  marketValue,
  validExchangeRate,
} from '@/features/equity/lib/valuation';
import { describe, expect, it } from 'vitest';
const holdings = computeHoldings([
  {
    date: '2026-01-01',
    ticker: 'DBS',
    broker: '',
    action: 'buy',
    shares: 100,
    price: 10,
    fees: 0,
  },
]);
describe('complete native market valuation', () => {
  it('does not substitute absent or mismatched quotes with zero', () => {
    expect(marketValue(holdings, {})).toBeNull();
    expect(
      marketValue(holdings, { DBS: { price: 1, currency: 'USD' } })
    ).toBeNull();
    expect(
      marketValue(holdings, { DBS: { price: NaN, currency: 'SGD' } })
    ).toBeNull();
    expect(
      holdingPrice(holdings[0], { DBS: { price: -1, currency: 'SGD' } })
    ).toBeNull();
  });
  it('retains genuine zero, complete native prices and empty portfolios', () => {
    expect(marketValue(holdings, { DBS: { price: 0, currency: 'SGD' } })).toBe(
      0
    );
    expect(marketValue(holdings, { DBS: { price: 12, currency: 'SGD' } })).toBe(
      1200
    );
    expect(marketValue([], undefined)).toBe(0);
  });
  it('rejects overflow and invalid conversion rates', () => {
    expect(
      marketValue(holdings, {
        DBS: { price: Number.MAX_VALUE, currency: 'SGD' },
      })
    ).toBeNull();
    for (const rate of [null, undefined, 0, -1, Infinity, NaN])
      expect(validExchangeRate(rate)).toBe(false);
    expect(validExchangeRate(1.3)).toBe(true);
  });
});

it('does not invent an annualised return without elapsed time or a solved root', () => {
  expect(
    verifiedIRR([
      { date: new Date('2026-01-01'), amount: -100 },
      { date: new Date('2026-01-01'), amount: 110 },
    ])
  ).toBeNull();
  expect(
    verifiedIRR([{ date: new Date('2026-01-01'), amount: -100 }])
  ).toBeNull();
  expect(
    verifiedIRR([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2026-01-01'), amount: 0.000001 },
    ])
  ).toBeNull();
  expect(
    verifiedIRR([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2026-01-01'), amount: 110 },
    ])
  ).toBeCloseTo(10, 1);
});

it('does not accept a solver guess on tiny financial cash flows', () => {
  expect(
    verifiedIRR([
      { date: new Date('2025-01-01'), amount: -1e-12 },
      { date: new Date('2026-01-01'), amount: 2e-12 },
    ])
  ).toBeNull();
});

it('rejects invalid dates and nonfinite cash flows before presenting a return', () => {
  expect(
    verifiedIRR([
      { date: new Date('invalid'), amount: -100 },
      { date: new Date('2026-01-01'), amount: 110 },
    ])
  ).toBeNull();
  expect(
    verifiedIRR([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2026-01-01'), amount: Infinity },
    ])
  ).toBeNull();
});

it('keeps foreign market holdings out of native cash flows', () => {
  const trades = [
    {
      date: '2025-01-01',
      ticker: 'DBS',
      broker: '',
      action: 'buy' as const,
      shares: 1,
      price: 10,
      fees: 0,
    },
    {
      date: '2025-01-01',
      ticker: 'AAPL',
      broker: '',
      action: 'buy' as const,
      shares: 1,
      price: 100,
      fees: 0,
    },
  ];
  const flows = buildCashFlows(
    trades,
    computeHoldings(trades),
    { DBS: { price: 12 }, AAPL: { price: 110 } },
    'SG',
    new Date('2026-01-01')
  );
  expect(flows.map((flow) => flow.amount)).toEqual([-10, 12]);
});
