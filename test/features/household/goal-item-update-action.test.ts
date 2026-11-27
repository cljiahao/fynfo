import { decryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const KH = Buffer.alloc(32, 9);
const ITEM_ID = '11111111-1111-4111-8111-111111111111';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({
    userId: 'user-1',
    kh: KH,
    supabase,
  }),
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

const VALID = {
  id: ITEM_ID,
  name: 'Sofa',
  budget: 1200,
  quote: 1100,
  dueDate: '2026-12-01',
  description: ' Corner unit ',
};
const UPDATED = {
  selectDataByTable: { household_goal_items: [{ id: ITEM_ID }] },
};

beforeEach(() => {
  setSupabase();
});

describe('updateGoalItem', () => {
  it('seals the fields under K_h and updates one row by id', async () => {
    const fake = setSupabase(UPDATED);
    const { updateGoalItem } =
      await import('@/features/household/actions/goal-actions');
    await updateGoalItem(VALID);

    const row = fake.calls.update[0] as Record<string, string | null>;
    expect(row.name).not.toBe('Sofa');
    expect(decryptPayload(row.name as string, KH)).toBe('Sofa');
    expect(decryptPayload(row.budget as string, KH)).toBe('1200');
    expect(decryptPayload(row.quote as string, KH)).toBe('1100');
    expect(decryptPayload(row.description as string, KH)).toBe('Corner unit');
    expect(row.due_date).toBe('2026-12-01');
    expect(
      fake.calls.queries.find((q) => q.operation === 'update')?.eq
    ).toEqual([{ column: 'id', value: ITEM_ID }]);
  });

  it('clears quote, date and description when they are omitted or blank', async () => {
    const fake = setSupabase(UPDATED);
    const { updateGoalItem } =
      await import('@/features/household/actions/goal-actions');
    await updateGoalItem({
      id: ITEM_ID,
      name: 'Sofa',
      budget: 1200,
      quote: null,
      description: '  ',
    });
    expect(fake.calls.update[0]).toMatchObject({
      quote: null,
      due_date: null,
      description: null,
    });
  });

  it.each([
    ['bad uuid', { id: 'nope' }],
    ['empty name', { name: '   ' }],
    ['zero budget', { budget: 0 }],
    ['negative quote', { quote: -1 }],
    ['non-finite budget', { budget: Number.POSITIVE_INFINITY }],
    ['bad date', { dueDate: '01/12/2026' }],
    ['long description', { description: 'x'.repeat(121) }],
  ])('rejects %s before any DB call', async (_label, patch) => {
    const fake = setSupabase(UPDATED);
    const { updateGoalItem } =
      await import('@/features/household/actions/goal-actions');
    await expect(updateGoalItem({ ...VALID, ...patch })).rejects.toMatchObject({
      name: 'AppError',
      code: 'VALIDATION',
    });
    expect(fake.calls.from).toHaveLength(0);
    expect(fake.calls.update).toHaveLength(0);
  });

  it('throws NOT_FOUND when RLS hides the row from another household', async () => {
    setSupabase({ selectDataByTable: { household_goal_items: [] } });
    const { updateGoalItem } =
      await import('@/features/household/actions/goal-actions');
    await expect(updateGoalItem(VALID)).rejects.toMatchObject({
      name: 'AppError',
      code: 'NOT_FOUND',
    });
  });

  it('surfaces an opaque error on an update failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { updateGoalItem } =
      await import('@/features/household/actions/goal-actions');
    await expect(updateGoalItem(VALID)).rejects.toThrow(
      'household goal item update failed'
    );
  });
});
