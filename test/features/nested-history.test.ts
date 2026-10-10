import {
  getSnapshot,
  getSnapshots,
} from '@/features/assets/actions/snapshot-actions';
import {
  getDistinctPeople,
  getExpenses,
} from '@/features/expenses/actions/expense-actions';
import { getGoals } from '@/features/household/actions/goal-actions';
import { encryptPayload } from '@/lib/crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../helpers/fake-supabase';

const USER_ID = 'synthetic-owner';
const KEY = Buffer.alloc(32, 7);
const TOTAL = 1003;
const CAP = 125;
let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: KEY, supabase }),
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KEY, supabase }),
}));

function setup(options: FakeSupabaseOptions) {
  const fake = makeFakeSupabase({ apiMaxRows: CAP, ...options });
  supabase = fake.client;
  return fake;
}

const amount = encryptPayload('1', KEY);
const name = encryptPayload('Fixture', KEY);
const assetEntries = Array.from({ length: TOTAL }, (_, index) => ({
  id: `entry-${index}`,
  snapshot_id: 'snapshot-0',
  category: 'savings',
  account: null,
  amount,
}));
const expenseSplits = Array.from({ length: TOTAL }, (_, index) => ({
  id: `split-${index}`,
  expense_id: 'expense-0',
  person: index === TOTAL - 1 ? 'Last person' : 'Repeated',
  amount,
  settled: false,
}));
const expense = {
  id: 'expense-0',
  date: '2026-01-01',
  type: 'shopping',
  item: name,
  info: null,
  amount,
  split_type: 'shared',
};
const goal = {
  id: 'goal-0',
  name,
  target_amount: encryptPayload('2000', KEY),
  target_date: null,
  created_at: '2026-01-01',
};

describe('complete nested histories', () => {
  it('reads every snapshot and independently pages children under the owner filter', async () => {
    const fake = setup({
      selectDataByTable: {
        monthly_snapshots: Array.from({ length: TOTAL }, (_, index) => ({
          id: `snapshot-${index}`,
          month: `month-${index}`,
          revision: '1',
        })),
        asset_entries: assetEntries,
      },
    });
    const snapshots = await getSnapshots();
    expect(snapshots).toHaveLength(TOTAL);
    expect(snapshots.at(-1)?.id).toBe(`month-${TOTAL - 1}`);
    expect(snapshots[0].entries).toHaveLength(TOTAL);
    expect(snapshots[1].entries).toEqual([]);
    for (const query of fake.calls.queries) {
      expect(query.eq).toEqual([
        {
          column:
            query.table === 'monthly_snapshots' ? 'user_id' : 'parent.user_id',
          value: USER_ID,
        },
      ]);
      expect(query.order.at(-1)?.column).toBe('id');
      expect(query.range).toBeDefined();
      if (query.table === 'asset_entries')
        expect(query.select).toContain(
          'parent:monthly_snapshots!inner(user_id)'
        );
    }
  });

  it('reads the full coherent edit payload through one RPC without client paging', async () => {
    const fake = setup({
      rpcData: {
        get_asset_snapshot_for_edit: {
          snapshotId: 'snapshot-0',
          id: '2026-01',
          revision: '1',
          entries: assetEntries,
        },
      },
    });
    const snapshot = await getSnapshot('2026-01');
    expect(snapshot?.entries).toHaveLength(TOTAL);
    expect(snapshot?.entries.at(-1)).toEqual({
      category: 'savings',
      account: '',
      amount: 1,
    });
    expect(fake.calls.from).toEqual([]);
    expect(fake.calls.rpc).toEqual([
      { name: 'get_asset_snapshot_for_edit', args: { p_month: '2026-01' } },
    ]);
  });

  it('skips children when a snapshot is absent or the history is empty', async () => {
    const single = setup({ selectData: null });
    expect(await getSnapshot('2026-01')).toBeNull();
    expect(single.calls.from).toEqual([]);
    const history = setup({ selectData: [] });
    expect(await getSnapshots()).toEqual([]);
    expect(history.calls.from).toEqual(['monthly_snapshots']);
  });

  it('reads every expense and every split without mixing parent groups', async () => {
    const fake = setup({
      selectDataByTable: {
        expense_records: Array.from({ length: TOTAL }, (_, index) => ({
          ...expense,
          id: `expense-${index}`,
        })),
        expense_splits: expenseSplits,
      },
    });
    const expenses = await getExpenses();
    expect(expenses).toHaveLength(TOTAL);
    expect(expenses.at(-1)?.id).toBe(`expense-${TOTAL - 1}`);
    expect(expenses[0].splits).toHaveLength(TOTAL);
    expect(expenses[0].splits.at(-1)?.person).toBe('Last person');
    expect(expenses[1].splits).toEqual([]);
    for (const query of fake.calls.queries) {
      expect(query.eq).toEqual([
        {
          column:
            query.table === 'expense_records' ? 'user_id' : 'parent.user_id',
          value: USER_ID,
        },
      ]);
      expect(query.order.at(-1)?.column).toBe('id');
      expect(query.range).toBeDefined();
      if (query.table === 'expense_splits')
        expect(query.select).toContain('parent:expense_records!inner(user_id)');
    }
  });

  it('includes a distinct person appearing only after the API cap', async () => {
    const fake = setup({
      selectDataByTable: { expense_splits: expenseSplits },
    });
    expect(await getDistinctPeople()).toEqual(['Last person', 'Repeated']);
    for (const query of fake.calls.queries) {
      expect(query.eq).toEqual([{ column: 'parent.user_id', value: USER_ID }]);
      expect(query.select).toContain('parent:expense_records!inner(user_id)');
      expect(query.order.at(-1)?.column).toBe('id');
    }
  });

  it('reads all household goals with bounded contribution ID filters', async () => {
    const fake = setup({
      selectDataByTable: {
        household_goals: Array.from({ length: TOTAL }, (_, index) => ({
          ...goal,
          id: `goal-${index}`,
        })),
        household_goal_contributions: [],
      },
    });
    expect(await getGoals()).toHaveLength(TOTAL);
    const childQueries = fake.calls.queries.filter(
      (query) => query.table === 'household_goal_contributions'
    );
    expect(childQueries).toHaveLength(Math.ceil(TOTAL / 100));
    const requestedIds: unknown[] = [];
    for (const query of childQueries) {
      const ids = query.in[0].values as string[];
      expect(ids.length).toBeLessThanOrEqual(100);
      requestedIds.push(...ids);
      expect(query.order.at(-1)?.column).toBe('id');
    }
    expect(requestedIds).toEqual(
      Array.from({ length: TOTAL }, (_, index) => `goal-${index}`)
    );
  });

  it('includes all contributions in household progress and preserves contributor identity', async () => {
    const fake = setup({
      selectDataByTable: {
        household_goals: [goal],
        household_goal_contributions: Array.from(
          { length: TOTAL },
          (_, index) => ({
            id: `contribution-${index}`,
            goal_id: goal.id,
            contributor_user_id:
              index === TOTAL - 1 ? USER_ID : 'synthetic-partner',
            amount,
            note: null,
            date: '2026-01-01',
          })
        ),
      },
    });
    const [result] = await getGoals();
    expect(result.contributions).toHaveLength(TOTAL);
    expect(result.contributed).toBe(TOTAL);
    expect(result.remaining).toBe(2000 - TOTAL);
    expect(result.contributions.at(-1)?.isSelf).toBe(true);
    expect(result.contributions[0].isSelf).toBe(false);
    for (const query of fake.calls.queries.slice(1))
      expect(query.in).toEqual([{ column: 'goal_id', values: [goal.id] }]);
  });

  it.each([
    ['snapshot history', getSnapshots, 'snapshot entries read failed'],
    ['expenses', getExpenses, 'expense splits read failed'],
    ['people', getDistinctPeople, 'people read failed'],
    ['household', getGoals, 'household contributions read failed'],
  ])(
    'rejects the whole %s on a later child-page failure',
    async (_label, read, message) => {
      const childFailure = (from: number) =>
        from >= CAP ? { message: 'private database constraint detail' } : null;
      setup({
        selectDataByTable: {
          monthly_snapshots: [
            { id: 'snapshot-0', month: '2026-01', revision: '1' },
          ],
          asset_entries: assetEntries,
          expense_records: [expense],
          expense_splits: expenseSplits,
          household_goals: [goal],
          household_goal_contributions: Array.from(
            { length: TOTAL },
            (_, index) => ({
              id: `c-${index}`,
              goal_id: goal.id,
              contributor_user_id: USER_ID,
              amount,
              date: '2026-01-01',
              note: null,
            })
          ),
        },
        selectErrorByTable: {
          asset_entries: childFailure,
          expense_splits: childFailure,
          household_goal_contributions: childFailure,
        },
      });
      await expect(read()).rejects.toThrow(message);
    }
  );
});
