import {
  createDividend,
  createDividends,
  updateDividend,
} from '@/features/equity/actions/dividend-actions';
import {
  createTrade,
  updateTrade,
} from '@/features/equity/actions/equity-actions';
import {
  dividendInputSchema,
  equityTradeInputSchema,
} from '@/features/equity/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const boundaries = vi.hoisted(() => ({
  requireActionContext: vi.fn(),
  encryptPayload: vi.fn((value: string) => `synthetic-cipher:${value}`),
}));
vi.mock('@/lib/action-guard', () => ({
  requireActionContext: boundaries.requireActionContext,
}));
vi.mock('@/lib/crypto', () => ({
  encryptPayload: boundaries.encryptPayload,
  decryptPayload: vi.fn(),
}));

const TRADE = {
  date: '2026-02-28',
  broker: 'Synthetic broker',
  ticker: 'SYN',
  action: 'buy' as const,
  shares: 1,
  price: 10,
  fees: 0,
};
const DISTRIBUTION = {
  date: '2026-02-28',
  ticker: 'SYN',
  amount: 10,
  currency: 'SGD' as const,
};
const INVALID_DATES = [
  '2025-02-29',
  '2026-02-30',
  '2026-04-31',
  '2026-02-30T12:00:00.000Z',
  '2026-04-31T12:00:00+08:00',
  '2026-00-10',
  '2026-13-10',
  '2026-02',
  'not-a-date',
  '2026-04-30Tnot-a-time',
];
const VALID_DATES = [
  '2024-02-29',
  '2026-02-28',
  '2026-04-30',
  '2026-04-30T12:00:00.000Z',
  '2026-04-30T12:00:00+08:00',
  '2026-04-30T12:00:00-05:00',
  '2026-04-30T12:00:00',
  '2026-12-31T23:30:00-05:00',
];

let fake: ReturnType<typeof makeFakeSupabase>;
beforeEach(() => {
  vi.clearAllMocks();
  fake = makeFakeSupabase();
  boundaries.requireActionContext.mockResolvedValue({
    userId: 'synthetic-user',
    dek: Buffer.alloc(32, 3),
    supabase: fake.client,
  });
});

describe('equity calendar-date boundaries', () => {
  it.each(INVALID_DATES)('rejects invalid date %s in both schemas', (date) => {
    expect(equityTradeInputSchema.safeParse({ ...TRADE, date }).success).toBe(
      false
    );
    expect(
      dividendInputSchema.safeParse({ ...DISTRIBUTION, date }).success
    ).toBe(false);
  });

  it.each(VALID_DATES)('preserves supported input %s unchanged', (date) => {
    expect(equityTradeInputSchema.parse({ ...TRADE, date }).date).toBe(date);
    expect(dividendInputSchema.parse({ ...DISTRIBUTION, date }).date).toBe(
      date
    );
  });

  describe.each(['2025-02-29', '2026-02-30', '2026-04-31T12:00:00+08:00'])(
    'invalid action date %s',
    (date) => {
      it.each([
        'createTrade',
        'updateTrade',
        'createDividend',
        'createDividends',
        'updateDividend',
      ] as const)('rejects %s before guarded work', async (name) => {
        const trade = { ...TRADE, date };
        const distribution = { ...DISTRIBUTION, date };
        const writes = {
          createTrade: () => createTrade(trade),
          updateTrade: () => updateTrade('synthetic-trade', trade),
          createDividend: () => createDividend(distribution),
          createDividends: () => createDividends([DISTRIBUTION, distribution]),
          updateDividend: () =>
            updateDividend('synthetic-distribution', distribution),
        };
        await expect(writes[name]()).rejects.toMatchObject({
          code: 'VALIDATION',
        });
        expect(boundaries.requireActionContext).not.toHaveBeenCalled();
        expect(boundaries.encryptPayload).not.toHaveBeenCalled();
        expect(fake.calls.from).toEqual([]);
        expect(fake.calls.rpc).toEqual([]);
      });
    }
  );

  it.each([
    ['2024-02-29', '2024-02-29T00:00:00.000Z'],
    ['2026-04-30T12:00:00+08:00', '2026-04-30T04:00:00.000Z'],
    ['2026-12-31T23:30:00-05:00', '2027-01-01T04:30:00.000Z'],
  ])('keeps valid action storage for %s', async (date, expectedUtc) => {
    await createTrade({ ...TRADE, date });
    await updateTrade('synthetic-trade', { ...TRADE, date });
    await createDividend({ ...DISTRIBUTION, date });
    await createDividends([{ ...DISTRIBUTION, date }]);
    await updateDividend('synthetic-distribution', { ...DISTRIBUTION, date });

    expect(fake.calls.insert[0]).toMatchObject({
      date: expectedUtc,
      user_id: 'synthetic-user',
    });
    expect(fake.calls.update[0]).toMatchObject({ date: expectedUtc });
    expect(fake.calls.insert[1]).toMatchObject({ date: date.slice(0, 10) });
    expect(fake.calls.insert[2]).toEqual([
      expect.objectContaining({ date: date.slice(0, 10) }),
    ]);
    expect(fake.calls.update[1]).toMatchObject({ date: date.slice(0, 10) });
    expect(
      fake.calls.queries.filter((query) => query.operation === 'update')
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'equity_trades',
          eq: [
            { column: 'id', value: 'synthetic-trade' },
            { column: 'user_id', value: 'synthetic-user' },
          ],
        }),
        expect.objectContaining({
          table: 'equity_dividends',
          eq: [
            { column: 'id', value: 'synthetic-distribution' },
            { column: 'user_id', value: 'synthetic-user' },
          ],
        }),
      ])
    );
    expect(boundaries.requireActionContext).toHaveBeenCalledTimes(5);
    expect(boundaries.encryptPayload).toHaveBeenCalled();
  });

  it('keeps an empty distribution batch inert', async () => {
    await createDividends([]);
    expect(boundaries.requireActionContext).not.toHaveBeenCalled();
    expect(boundaries.encryptPayload).not.toHaveBeenCalled();
    expect(fake.calls.from).toEqual([]);
  });
});
