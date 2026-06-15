import { buildDividendCandidates } from '@/features/equity/lib/dividend-scan';
import type { DividendPoint } from '@/features/equity/lib/dividend-suggest';
import type { Holding } from '@/features/equity/lib/holdings';
import type { DividendData, EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

const trade = (over: Partial<EquityTradeData>): EquityTradeData => ({
  date: '2025-01-01',
  broker: 'DBS Vickers',
  ticker: 'MLT',
  action: 'buy',
  shares: 1000,
  price: 1,
  fees: 0,
  ...over,
});

const holding = (over: Partial<Holding>): Holding => ({
  ticker: 'MLT',
  market: 'SG',
  shares: 1000,
  totalBuyCost: 1000,
  totalBuyShares: 1000,
  avgBuyPrice: 1,
  costBasis: 1,
  ...over,
});

const points: Record<string, DividendPoint[]> = {
  MLT: [
    { exDate: '2025-03-15', dpu: 0.02 },
    { exDate: '2025-09-15', dpu: 0.022 },
  ],
};

describe('buildDividendCandidates', () => {
  it('estimates amount = DPU × shares-held and tags SGD for an SG ticker', () => {
    const out = buildDividendCandidates([trade({})], [holding({})], points, []);
    expect(out).toHaveLength(2);
    // newest first
    expect(out[0]).toMatchObject({
      ticker: 'MLT',
      date: '2025-09-15',
      shares: 1000,
      amount: 22,
      currency: 'SGD',
    });
    expect(out[1]).toMatchObject({ date: '2025-03-15', amount: 20 });
  });

  it('skips ex-dates where no shares were held', () => {
    const out = buildDividendCandidates(
      [trade({ date: '2025-06-01' })], // bought after the March ex-date
      [holding({})],
      points,
      []
    );
    expect(out.map((c) => c.date)).toEqual(['2025-09-15']);
  });

  it('dedupes against already-recorded dividends (ticker + date)', () => {
    const existing: DividendData[] = [
      { ticker: 'MLT', date: '2025-03-15', amount: 19.5, currency: 'SGD' },
    ];
    const out = buildDividendCandidates(
      [trade({})],
      [holding({})],
      points,
      existing
    );
    expect(out.map((c) => c.date)).toEqual(['2025-09-15']);
  });

  it('tags USD for a US ticker', () => {
    const out = buildDividendCandidates(
      [trade({ ticker: 'AAPL' })],
      [holding({ ticker: 'AAPL', market: 'US' })],
      { AAPL: [{ exDate: '2025-05-10', dpu: 0.24 }] },
      []
    );
    expect(out[0]).toMatchObject({ currency: 'USD', amount: 240 });
  });
});
