import { encryptPayload } from '@/lib/crypto';
import { describe, expect, it, vi } from 'vitest';

const DEK = Buffer.alloc(32, 3);

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface Started {
  table: string;
  from: number;
}

let supabase: unknown;
vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: 'user-1', dek: DEK, supabase }),
}));

// Each range() call is logged at call time and resolves on a later tick, so
// the log order shows which reads were started before any of them finished.
function makeClient(tables: Record<string, unknown[]>, started: Started[]) {
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const name of ['select', 'eq', 'order', 'gte', 'lte', 'in']) {
        builder[name] = () => builder;
      }
      builder.range = async (from: number, to: number) => {
        started.push({ table, from });
        await new Promise((r) => setTimeout(r, 5));
        const data = tables[table];
        return {
          data: data.slice(from, to + 1),
          count: data.length,
          error: null,
        };
      };
      return builder;
    },
  };
}

async function encRecord(id: string, amount: number, split = false) {
  return {
    id,
    date: '2026-06-01',
    type: 'food_drink',
    item: await encryptPayload(`item-${id}`, DEK),
    info: await encryptPayload('', DEK),
    amount: await encryptPayload(String(amount), DEK),
    split_type: split ? 'shared' : 'self',
  };
}

describe('getExpenses parallel read', () => {
  it('starts the records and splits reads before either completes', async () => {
    const started: Started[] = [];
    const template = await encRecord('r', 1);
    const records = Array.from({ length: 1200 }, (_, i) => ({
      ...template,
      id: `r${i}`,
    }));
    const splits = [
      {
        expense_id: 'r0',
        person: 'Alice',
        amount: await encryptPayload('5', DEK),
        settled: false,
      },
    ];
    supabase = makeClient(
      { expense_records: records, expense_splits: splits },
      started
    );
    const { getExpenses } =
      await import('@/features/expenses/actions/expense-actions');

    const result = await getExpenses();

    expect(result.map((r) => r.id)).toEqual(records.map((r) => r.id));
    expect(result[0].splits).toEqual([
      { person: 'Alice', amount: 5, settled: false },
    ]);
    expect(
      started
        .slice(0, 2)
        .map((s) => s.table)
        .sort()
    ).toEqual(['expense_records', 'expense_splits']);
    expect(started.slice(0, 2).every((s) => s.from === 0)).toBe(true);
  });

  it('ignores a split whose record is not in the result', async () => {
    const started: Started[] = [];
    supabase = makeClient(
      {
        expense_records: [await encRecord('a', 7)],
        expense_splits: [
          {
            expense_id: 'newer-than-records-read',
            person: 'Bob',
            amount: await encryptPayload('3', DEK),
            settled: false,
          },
        ],
      },
      started
    );
    const { getExpenses } =
      await import('@/features/expenses/actions/expense-actions');

    const result = await getExpenses();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'a', amount: 7, splits: [] });
  });

  it('returns no expenses when there are no records, even with splits', async () => {
    const started: Started[] = [];
    supabase = makeClient(
      {
        expense_records: [],
        expense_splits: [
          {
            expense_id: 'x',
            person: 'Bob',
            amount: await encryptPayload('3', DEK),
            settled: false,
          },
        ],
      },
      started
    );
    const { getExpenses } =
      await import('@/features/expenses/actions/expense-actions');

    expect(await getExpenses()).toEqual([]);
  });
});
