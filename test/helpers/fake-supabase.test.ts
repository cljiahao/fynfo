import { describe, expect, it } from 'vitest';
import { makeFakeSupabase } from './fake-supabase';

describe('fake Supabase query isolation', () => {
  it('retains each query table when another query starts before resolution', async () => {
    const { client } = makeFakeSupabase({
      selectDataByTable: {
        first: [{ id: 'first-row' }],
        second: [{ id: 'second-row' }],
      },
    });
    const first = client.from('first');
    const second = client.from('second');

    const [firstResult, secondResult] = await Promise.all([
      Promise.resolve(first),
      Promise.resolve(second),
    ]);
    expect(firstResult).toEqual({ data: [{ id: 'first-row' }], error: null });
    expect(secondResult).toEqual({ data: [{ id: 'second-row' }], error: null });
  });

  it('records filters and order on their own query rather than another table', () => {
    const { client, calls } = makeFakeSupabase();
    const first = client.from('first');
    const second = client.from('second');
    (first.eq as (column: string, value: unknown) => unknown)('user_id', 'u1');
    (first.order as (column: string, options: unknown) => unknown)('date', {
      ascending: false,
    });
    (second.in as (column: string, values: unknown) => unknown)('id', ['b1']);

    expect(calls.queries).toEqual([
      {
        table: 'first',
        operation: 'read',
        eq: [{ column: 'user_id', value: 'u1' }],
        in: [],
        order: [{ column: 'date', options: { ascending: false } }],
      },
      {
        table: 'second',
        operation: 'read',
        eq: [],
        in: [{ column: 'id', values: ['b1'] }],
        order: [],
      },
    ]);
  });
});
