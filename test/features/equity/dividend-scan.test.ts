import {
  buildDividendCandidates,
  dividendScanTickers,
} from '@/features/equity/lib/dividend-scan';
import type { DividendPoint } from '@/features/equity/lib/dividend-suggest';
import type { DividendData, EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

const trade = (over: Partial<EquityTradeData>): EquityTradeData => ({
  date: '2025-01-01',
  broker: 'Synthetic broker',
  ticker: 'MLT',
  action: 'buy',
  shares: 1000,
  price: 1,
  fees: 0,
  ...over,
});
const points: Record<string, DividendPoint[]> = {
  MLT: [
    { exDate: '2025-03-15', dpu: 0.02 },
    { exDate: '2025-09-15', dpu: 0.022 },
  ],
};

describe('buildDividendCandidates', () => {
  it('reconstructs rounded native-currency amounts newest first', () => {
    const out = buildDividendCandidates([trade({})], points, []);
    expect(out).toEqual([
      {
        ticker: 'MLT',
        date: '2025-09-15',
        dpu: 0.022,
        shares: 1000,
        amount: 22,
        currency: 'SGD',
      },
      {
        ticker: 'MLT',
        date: '2025-03-15',
        dpu: 0.02,
        shares: 1000,
        amount: 20,
        currency: 'SGD',
      },
    ]);
  });
  it('retains earlier entitlement for a fully sold position', () => {
    const out = buildDividendCandidates(
      [trade({}), trade({ date: '2025-06-01', action: 'sell' })],
      points,
      []
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2025-03-15', amount: 20 });
  });
  it.each(['MLT', 'AAPL'])(
    'excludes ex-date buys and retains ex-date sales for %s',
    (ticker) => {
      const feed = { [ticker]: [{ exDate: '2025-03-15', dpu: 0.02 }] };
      expect(
        buildDividendCandidates(
          [trade({ ticker, date: '2025-03-15' })],
          feed,
          []
        )
      ).toEqual([]);
      expect(
        buildDividendCandidates(
          [
            trade({ ticker }),
            trade({ ticker, date: '2025-03-15', action: 'sell' }),
          ],
          feed,
          []
        )[0]
      ).toMatchObject({ shares: 1000, amount: 20 });
    }
  );
  it('reduces entitlement for an earlier partial sale, independently of later purchases', () => {
    const out = buildDividendCandidates(
      [
        trade({}),
        trade({ date: '2025-02-01', action: 'sell', shares: 250 }),
        trade({ date: '2025-06-01', shares: 10 }),
      ],
      points,
      []
    );
    expect(out[1]).toMatchObject({ shares: 750, amount: 15 });
    expect(out[0]).toMatchObject({ shares: 760, amount: 16.72 });
  });
  it('skips points before purchase and tickers without feed data', () => {
    expect(
      buildDividendCandidates(
        [trade({ date: '2025-06-01' }), trade({ ticker: 'DBS' })],
        points,
        []
      ).map((candidate) => candidate.date)
    ).toEqual(['2025-09-15']);
    expect(buildDividendCandidates([], points, [])).toEqual([]);
  });
  it('dedupes normalized tickers and existing or repeated feed dates', () => {
    const existing: DividendData[] = [
      { ticker: 'mlt', date: '2025-03-15', amount: 19.5, currency: 'SGD' },
    ];
    const out = buildDividendCandidates(
      [
        trade({ ticker: 'mlt', shares: 500 }),
        trade({ ticker: 'MLT', shares: 500 }),
      ],
      { MLT: [...points.MLT, ...points.MLT] },
      existing
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2025-09-15', shares: 1000 });
  });
  it('retains USD inference for a US ticker', () => {
    expect(
      buildDividendCandidates(
        [trade({ ticker: 'AAPL' })],
        {
          AAPL: [{ exDate: '2025-05-10', dpu: 0.24 }],
        },
        []
      )[0]
    ).toMatchObject({ currency: 'USD', amount: 240 });
  });
  it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])(
    'rejects non-positive, invalid or overflowing DPU %s',
    (dpu) => {
      expect(
        buildDividendCandidates(
          [trade({})],
          { MLT: [{ exDate: '2025-03-15', dpu }] },
          []
        )
      ).toEqual([]);
    }
  );
  it('withholds invalid dates, tiny rounded amounts and accumulated share overflow', () => {
    expect(
      buildDividendCandidates(
        [trade({})],
        {
          MLT: [
            { exDate: 'invalid', dpu: 1 },
            { exDate: '2025-02-30', dpu: 1 },
            { exDate: '2025-03-15', dpu: 1e-10 },
          ],
        },
        []
      )
    ).toEqual([]);
    expect(
      buildDividendCandidates(
        [
          trade({ shares: Number.MAX_VALUE }),
          trade({ shares: Number.MAX_VALUE }),
        ],
        points,
        []
      )
    ).toEqual([]);
  });
});

describe('dividendScanTickers', () => {
  it('includes closed positions and normalizes distinct historical tickers', () => {
    expect(
      dividendScanTickers([
        trade({ ticker: ' mlt ' }),
        trade({ ticker: 'MLT', action: 'sell' }),
        trade({ ticker: 'aapl' }),
      ])
    ).toEqual(['MLT', 'AAPL']);
    expect(dividendScanTickers([])).toEqual([]);
  });
});
