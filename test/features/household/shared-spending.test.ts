import {
  inMonth,
  summarizeSpending,
} from '@/features/household/lib/shared-spending';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const PARTNER_ID = 'user-2';
const KH = Buffer.alloc(32, 5);
const SPACE_ID = '00000000-0000-4000-8000-0000000000c1';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KH, supabase }),
}));

function setSupabase(opts: Parameters<typeof makeFakeSupabase>[0] = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  setSupabase();
});

describe('summarizeSpending', () => {
  it('totals by payer and category, largest category first', () => {
    const summary = summarizeSpending([
      { category: 'Groceries', amount: 80.1, isSelf: true },
      { category: 'Utilities', amount: 120, isSelf: false },
      { category: 'Groceries', amount: 60.2, isSelf: false },
    ]);
    expect(summary.total).toBe(260.3);
    expect(summary.youPaid).toBe(80.1);
    expect(summary.partnerPaid).toBe(180.2);
    expect(summary.byCategory).toEqual([
      { category: 'Groceries', total: 140.3 },
      { category: 'Utilities', total: 120 },
    ]);
  });

  it('says who owes whom to split evenly, to the cent', () => {
    expect(
      summarizeSpending([
        { category: 'Rent', amount: 100, isSelf: true },
        { category: 'Food', amount: 40, isSelf: false },
      ]).settle
    ).toEqual({ owedBy: 'partner', amount: 30 });
    expect(
      summarizeSpending([
        { category: 'Food', amount: 0.1, isSelf: true },
        { category: 'Food', amount: 0.2, isSelf: false },
      ]).settle
    ).toEqual({ owedBy: 'you', amount: 0.05 });
  });

  it('reports nothing to settle when already even or empty', () => {
    expect(
      summarizeSpending([
        { category: 'Food', amount: 50, isSelf: true },
        { category: 'Food', amount: 50, isSelf: false },
      ]).settle
    ).toBeNull();
    expect(summarizeSpending([])).toEqual({
      total: 0,
      byCategory: [],
      youPaid: 0,
      partnerPaid: 0,
      settle: null,
    });
  });

  it('matches dates to a calendar month', () => {
    expect(inMonth('2026-10-31', '2026-10')).toBe(true);
    expect(inMonth('2026-11-01', '2026-10')).toBe(false);
  });
});

describe('spending actions', () => {
  it('decrypts spaces and their entries, flagging who paid', async () => {
    setSupabase({
      selectDataByTable: {
        household_spaces: [
          {
            id: SPACE_ID,
            kind: 'trip',
            name: encryptPayload('Japan', KH),
            start_date: '2026-12-01',
            end_date: '2026-12-10',
          },
        ],
        household_spending: [
          {
            id: 's1',
            space_id: SPACE_ID,
            payer_user_id: PARTNER_ID,
            date: '2026-12-02',
            category: encryptPayload('Hotel', KH),
            amount: encryptPayload('640.5', KH),
            note: encryptPayload('Kyoto', KH),
          },
        ],
      },
    });
    const { getSpaces } =
      await import('@/features/household/actions/spending-actions');
    expect(await getSpaces()).toEqual([
      {
        id: SPACE_ID,
        kind: 'trip',
        name: 'Japan',
        startDate: '2026-12-01',
        endDate: '2026-12-10',
        entries: [
          {
            id: 's1',
            date: '2026-12-02',
            category: 'Hotel',
            amount: 640.5,
            note: 'Kyoto',
            isSelf: false,
          },
        ],
      },
    ]);
  });

  it('skips the spending read when there are no spaces', async () => {
    const fake = setSupabase({ selectDataByTable: { household_spaces: [] } });
    const { getSpaces } =
      await import('@/features/household/actions/spending-actions');
    expect(await getSpaces()).toEqual([]);
    expect(fake.calls.from).not.toContain('household_spending');
  });

  it('creates a trip in the caller household with a sealed name', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
    });
    const { createSpace } =
      await import('@/features/household/actions/spending-actions');
    await createSpace({
      kind: 'trip',
      name: ' Japan ',
      startDate: '2026-12-01',
      endDate: '2026-12-10',
    });
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row).toMatchObject({
      household_id: 'h1',
      kind: 'trip',
      start_date: '2026-12-01',
      end_date: '2026-12-10',
      created_by: USER_ID,
    });
    expect(decryptPayload(row.name, KH)).toBe('Japan');
  });

  it('drops trip dates from an ongoing space', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
    });
    const { createSpace } =
      await import('@/features/household/actions/spending-actions');
    await createSpace({
      kind: 'ongoing',
      name: 'Household',
      startDate: '2026-12-01',
    });
    expect(fake.calls.insert[0]).toMatchObject({
      start_date: null,
      end_date: null,
    });
  });

  it('records spending as the caller with sealed category, amount and note', async () => {
    const fake = setSupabase();
    const { addSpending } =
      await import('@/features/household/actions/spending-actions');
    await addSpending({
      spaceId: SPACE_ID,
      date: '2026-10-05',
      category: ' Groceries ',
      amount: 82.45,
      note: 'NTUC',
    });
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row).toMatchObject({
      space_id: SPACE_ID,
      payer_user_id: USER_ID,
      date: '2026-10-05',
    });
    expect(decryptPayload(row.category, KH)).toBe('Groceries');
    expect(decryptPayload(row.amount, KH)).toBe('82.45');
    expect(decryptPayload(row.note, KH)).toBe('NTUC');
  });

  it.each([
    ['space', { kind: 'weekly', name: 'X' }],
    [
      'space',
      {
        kind: 'trip',
        name: 'X',
        startDate: '2026-12-10',
        endDate: '2026-12-01',
      },
    ],
    [
      'spending',
      { spaceId: SPACE_ID, date: '2026-10-05', category: '', amount: 5 },
    ],
    [
      'spending',
      { spaceId: SPACE_ID, date: '2026-10-05', category: 'Food', amount: 0 },
    ],
    [
      'spending',
      { spaceId: 'nope', date: '2026-10-05', category: 'Food', amount: 5 },
    ],
  ])('rejects an invalid %s before any write', async (kind, input) => {
    const fake = setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
    });
    const actions =
      await import('@/features/household/actions/spending-actions');
    const write = kind === 'space' ? actions.createSpace : actions.addSpending;
    await expect(write(input)).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });
});

describe('spending actions — failure and delete paths', () => {
  it('refuses to create a space when the caller has no household', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_members: [] },
    });
    const { createSpace } =
      await import('@/features/household/actions/spending-actions');
    await expect(
      createSpace({ kind: 'ongoing', name: 'Household' })
    ).rejects.toThrow('No household');
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('surfaces an opaque error when a member, space or spending write fails', async () => {
    const actions =
      await import('@/features/household/actions/spending-actions');
    setSupabase({
      selectError: { message: 'relation "household_members" denied' },
    });
    await expect(
      actions.createSpace({ kind: 'ongoing', name: 'Household' })
    ).rejects.toThrow();

    setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
      insertError: { message: 'duplicate key household_spaces_pkey' },
    });
    await expect(
      actions.createSpace({ kind: 'ongoing', name: 'Household' })
    ).rejects.toThrow();

    setSupabase({
      insertError: { message: 'violates household_spending_fkey' },
    });
    await expect(
      actions.addSpending({
        spaceId: SPACE_ID,
        date: '2026-10-05',
        category: 'Food',
        amount: 5,
      })
    ).rejects.toThrow();
  });

  it('stores a null note when none is given', async () => {
    const fake = setSupabase();
    const { addSpending } =
      await import('@/features/household/actions/spending-actions');
    await addSpending({
      spaceId: SPACE_ID,
      date: '2026-10-05',
      category: 'Food',
      amount: 5,
    });
    expect((fake.calls.insert[0] as { note: unknown }).note).toBeNull();
  });

  it('returns a null note for entries read without one', async () => {
    setSupabase({
      selectDataByTable: {
        household_spaces: [
          {
            id: SPACE_ID,
            kind: 'ongoing',
            name: encryptPayload('Home', KH),
            start_date: null,
            end_date: null,
          },
        ],
        household_spending: [
          {
            id: 's1',
            space_id: SPACE_ID,
            payer_user_id: USER_ID,
            date: '2026-12-02',
            category: encryptPayload('Rent', KH),
            amount: encryptPayload('100', KH),
            note: null,
          },
        ],
      },
    });
    const { getSpaces } =
      await import('@/features/household/actions/spending-actions');
    const [space] = await getSpaces();
    expect(space.entries[0]).toMatchObject({ note: null, isSelf: true });
  });

  it('deletes a space and a spending entry by id, and hides write errors', async () => {
    const { deleteSpace, deleteSpending } =
      await import('@/features/household/actions/spending-actions');
    const fake = setSupabase();
    await deleteSpace(SPACE_ID);
    await deleteSpending('s1');
    expect(fake.calls.delete).toBe(2);
    expect(fake.calls.queries.map((q) => q.eq[0]?.value)).toEqual([
      SPACE_ID,
      's1',
    ]);

    setSupabase({ selectError: { message: 'permission denied for table x' } });
    await expect(deleteSpace(SPACE_ID)).rejects.toThrow();
    await expect(deleteSpending('s1')).rejects.toThrow();
  });
});
