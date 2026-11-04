import {
  buildDividendScan,
  dividendScanTickers,
  exchangeLocalDate,
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

const feedsOf = (byTicker: Record<string, DividendPoint[]>) =>
  Object.fromEntries(
    Object.entries(byTicker).map(([ticker, pts]) => [ticker, { points: pts }])
  );
const buildDividendCandidates = (
  trades: EquityTradeData[],
  byTicker: Record<string, DividendPoint[]>,
  existing: DividendData[]
) => buildDividendScan(trades, feedsOf(byTicker), existing).candidates;
const dividend = (over: Partial<DividendData>): DividendData => ({
  ticker: 'MLT',
  date: '2025-03-15',
  amount: 20,
  currency: 'SGD',
  ...over,
});

describe('exchangeLocalDate', () => {
  it('maps 23:30 UTC the day before to the next Singapore day', () => {
    const seconds = Date.UTC(2025, 2, 14, 23, 30) / 1000;
    expect(exchangeLocalDate(seconds, 'SG')).toBe('2025-03-15');
  });
  it('maps 01:00 UTC to the previous New York day', () => {
    const seconds = Date.UTC(2025, 2, 15, 1, 0) / 1000;
    expect(exchangeLocalDate(seconds, 'US')).toBe('2025-03-14');
  });
});

describe('buildDividendScan dedupe', () => {
  const one = { MLT: [{ exDate: '2025-03-15', dpu: 0.02 }] };
  const run = (existing: DividendData[]) =>
    buildDividendScan([trade({})], feedsOf(one), existing).candidates;

  it('suppresses a candidate matched by a payment-date entry in window', () => {
    expect(run([dividend({ date: '2025-04-20', amount: 20.3 })])).toEqual([]);
  });
  it('treats an exact same-date entry as a duplicate regardless of amount', () => {
    expect(run([dividend({ amount: 99 })])).toEqual([]);
  });
  it('keeps the candidate for a different amount on a different date', () => {
    expect(run([dividend({ date: '2025-04-20', amount: 25 })])).toHaveLength(1);
  });
  it('keeps the candidate when the entry is outside the window', () => {
    expect(run([dividend({ date: '2025-05-20' })])).toHaveLength(1);
    expect(run([dividend({ date: '2025-03-11' })])).toHaveLength(1);
    expect(run([dividend({ date: '2025-03-12' })])).toEqual([]);
  });
  it('lets one existing row suppress only one candidate, nearest date first', () => {
    const monthly = {
      MLT: [
        { exDate: '2025-03-15', dpu: 0.02 },
        { exDate: '2025-04-15', dpu: 0.02 },
      ],
    };
    const out = buildDividendScan([trade({})], feedsOf(monthly), [
      dividend({ date: '2025-04-20' }),
    ]).candidates;
    expect(out.map((c) => c.date)).toEqual(['2025-03-15']);
  });
});

describe('buildDividendScan skipped tickers', () => {
  const aapl = trade({ ticker: 'AAPL' });
  it('lists fetch failures and still returns the other candidates', () => {
    const result = buildDividendScan(
      [trade({}), aapl],
      feedsOf(points),
      [],
      ['AAPL']
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.skipped).toEqual([{ ticker: 'AAPL', reason: 'fetch' }]);
  });
  it('reports malformed trades instead of dropping them silently', () => {
    const result = buildDividendScan(
      [trade({}), trade({ ticker: 'AAPL', shares: 0 })],
      feedsOf(points),
      []
    );
    expect(result.skipped).toEqual([
      { ticker: 'AAPL', reason: 'malformed-trade' },
    ]);
    expect(result.candidates).toHaveLength(2);
  });
  it('skips a ticker whose feed currency disagrees, and passes an absent one', () => {
    const feeds = {
      MLT: { points: points.MLT, currency: 'USD' },
      AAPL: { points: [{ exDate: '2025-05-10', dpu: 0.24 }] },
    };
    const result = buildDividendScan([trade({}), aapl], feeds, []);
    expect(result.skipped).toEqual([
      { ticker: 'MLT', reason: 'currency-mismatch' },
    ]);
    expect(result.candidates.map((c) => c.ticker)).toEqual(['AAPL']);
  });
});

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

describe('malformed tickers', () => {
  it('excludes them from the fetch list and reports them as skipped', () => {
    const trades = [trade({ ticker: 'MLT' }), trade({ ticker: 'bad ticker!' })];
    expect(dividendScanTickers(trades)).toEqual(['MLT']);
    const { skipped } = buildDividendScan(trades, {}, []);
    expect(skipped).toContainEqual({
      ticker: 'BAD TICKER!',
      reason: 'malformed-trade',
    });
  });
  it('honours a stored per-trade market for the candidate currency', () => {
    const { candidates } = buildDividendScan(
      [trade({ ticker: 'D05', market: 'US' })],
      { D05: { points: [{ exDate: '2025-03-15', dpu: 0.02 }] } },
      []
    );
    expect(candidates[0].currency).toBe('USD');
  });
});
