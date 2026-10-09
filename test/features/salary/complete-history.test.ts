import { encryptPayload } from '@/lib/crypto';
import { describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const dek = Buffer.alloc(32, 7);
let supabase: ReturnType<typeof makeFakeSupabase>['client'];
vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: 'fixture-user', dek, supabase }),
}));

describe('complete flat encrypted histories', () => {
  it('reads every salary record beyond the API limit with owner filtering on every page', async () => {
    const salary = encryptPayload('123.45', dek);
    const bonus = encryptPayload('0', dek);
    const rows = Array.from({ length: 1203 }, (_, id) => ({
      id: `row-${id}`,
      month: `month-${id}`,
      salary,
      bonus,
    }));
    const fake = makeFakeSupabase({ selectData: rows, apiMaxRows: 125 });
    supabase = fake.client;
    const { getSalaryRecords } =
      await import('@/features/salary/actions/salary-actions');
    const result = await getSalaryRecords();
    expect(result).toHaveLength(1203);
    expect(result.at(-1)).toEqual({
      id: 'month-1202',
      salary: 123.45,
      bonus: 0,
    });
    expect(fake.calls.queries).toHaveLength(10);
    for (const query of fake.calls.queries) {
      expect(query.eq).toEqual([{ column: 'user_id', value: 'fixture-user' }]);
      expect(query.order.map(({ column }) => column)).toEqual(['month', 'id']);
    }
  });

  it.each(['trades', 'dividends', 'all reliefs', 'year reliefs'])(
    'reads %s beyond1000 rows',
    async (domain) => {
      const encrypted = encryptPayload('10', dek);
      const rows = Array.from({ length: 1003 }, (_, id) => ({
        id: `row-${id}`,
        date: '2026-01-01',
        broker: 'fixture-broker',
        ticker: encryptPayload('FIXTURE', dek),
        action: 'buy',
        shares: encrypted,
        price: encrypted,
        fees: encrypted,
        amount: encrypted,
        currency: 'SGD',
        year: 2026,
        relief_key: `relief-${id}`,
      }));
      const fake = makeFakeSupabase({ selectData: rows, apiMaxRows: 333 });
      supabase = fake.client;
      const { getTrades } =
        await import('@/features/equity/actions/equity-actions');
      const { getDividends } =
        await import('@/features/equity/actions/dividend-actions');
      const { getAllTaxReliefs, getTaxReliefs } =
        await import('@/features/salary/actions/relief-actions');
      const result = await (domain === 'trades'
        ? getTrades()
        : domain === 'dividends'
          ? getDividends()
          : domain === 'all reliefs'
            ? getAllTaxReliefs()
            : getTaxReliefs(2026));
      expect(result).toHaveLength(1003);
      expect(result.at(-1)).toMatchObject(
        domain.includes('reliefs')
          ? { reliefKey: 'relief-1002', amount: 10 }
          : { id: 'row-1002' }
      );
      expect(fake.calls.queries).toHaveLength(4);
      for (const query of fake.calls.queries) {
        expect(query.eq).toContainEqual({
          column: 'user_id',
          value: 'fixture-user',
        });
        expect(query.order.at(-1)?.column).toBe('id');
        if (domain === 'year reliefs')
          expect(query.eq).toContainEqual({ column: 'year', value: 2026 });
      }
    }
  );
});
