import * as fieldCrypto from '@/lib/crypto';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 4);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: DEK, supabase }),
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  vi.restoreAllMocks();
  setSupabase();
});

describe('snapshot-actions — getSnapshots', () => {
  it('decrypts entry account and amount on success', async () => {
    setSupabase({
      selectDataByTable: {
        monthly_snapshots: [{ id: 'snap-1', month: '2026-03' }],
        asset_entries: [
          {
            snapshot_id: 'snap-1',
            category: 'savings',
            account: await encryptPayload('DBS', DEK),
            amount: await encryptPayload('5000', DEK),
          },
        ],
      },
    });
    const { getSnapshots } =
      await import('@/features/assets/actions/snapshot-actions');
    expect(await getSnapshots()).toEqual([
      {
        id: '2026-03',
        entries: [{ category: 'savings', account: 'DBS', amount: 5000 }],
      },
    ]);
  });

  it('returns an empty array when the user has no snapshots', async () => {
    setSupabase({ selectData: [] });
    const { getSnapshots } =
      await import('@/features/assets/actions/snapshot-actions');
    expect(await getSnapshots()).toEqual([]);
  });

  // Regression (spec 032): a read error must surface as an opaque AppError, not
  // be swallowed into an empty list that masks RLS/connection failures.
  it('throws an opaque error instead of returning [] on a read failure', async () => {
    setSupabase({
      selectError: { message: 'permission denied for table monthly_snapshots' },
    });
    const { getSnapshots } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(getSnapshots()).rejects.toThrow('snapshots read failed');
  });
});

describe('snapshot-actions — getSnapshot', () => {
  it('returns null when the month is absent', async () => {
    setSupabase({ selectData: null });
    const { getSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    expect(await getSnapshot('2026-03')).toBeNull();
  });
  it('decrypts a single month by id', async () => {
    setSupabase({
      selectDataByTable: {
        monthly_snapshots: { id: 'snap-1', month: '2026-03' },
        asset_entries: [
          {
            snapshot_id: 'snap-1',
            category: 'savings',
            account: await encryptPayload('OCBC', DEK),
            amount: await encryptPayload('8000', DEK),
          },
        ],
      },
    });
    const { getSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    expect(await getSnapshot('2026-03')).toEqual({
      id: '2026-03',
      entries: [{ category: 'savings', account: 'OCBC', amount: 8000 }],
    });
  });

  it('throws an opaque error on a failed single-record read', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { getSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(getSnapshot('2026-03')).rejects.toThrow(
      'snapshot read failed'
    );
  });
});

const VALID_SNAPSHOT = {
  id: '2026-03',
  entries: [{ category: 'savings' as const, account: 'DBS', amount: 5000 }],
};

describe('snapshot-actions — upsertSnapshot', () => {
  it('stops replacement when child deletion fails', async () => {
    const fake = setSupabase({
      upsertData: { id: 'snap-1' },
      selectError: { message: 'permission denied' },
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow(
      'asset_entries delete failed'
    );
    expect(fake.calls.insert).toHaveLength(0);
  });
  it('does not delete children after a parent failure', async () => {
    const fake = setSupabase({ upsertError: { message: 'parent failed' } });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow();
    expect(fake.calls.delete).toBe(0);
    expect(fake.calls.insert).toHaveLength(0);
  });
  it('prepares child ciphertext before any replacement mutation', async () => {
    const fake = setSupabase({ upsertData: { id: 'snap-1' } });
    const encrypt = fieldCrypto.encryptPayload;
    vi.spyOn(fieldCrypto, 'encryptPayload').mockImplementation((text, dek) => {
      if (text === '5000') throw new Error('child encryption failed');
      return encrypt(text, dek);
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow(
      'child encryption failed'
    );
    expect(fake.calls.delete).toBe(0);
    expect(fake.calls.upsert).toHaveLength(0);
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('upserts the month then encrypts entry account/amount before insert', async () => {
    const fake = setSupabase({ upsertData: { id: 'snap-1' } });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await upsertSnapshot(VALID_SNAPSHOT);

    expect(fake.calls.from).toContain('monthly_snapshots');
    const month = fake.calls.upsert[0] as Record<string, unknown>;
    expect(month.month).toBe('2026-03');
    expect(month.user_id).toBe(USER_ID);

    const entries = fake.calls.insert[0] as Array<Record<string, string>>;
    expect(entries).toHaveLength(1);
    expect(entries[0].snapshot_id).toBe('snap-1');
    expect(entries[0].category).toBe('savings');
    expect(await decryptPayload(entries[0].account, DEK)).toBe('DBS');
    expect(await decryptPayload(entries[0].amount, DEK)).toBe('5000');
  });

  it('skips the entry insert when no entry has a positive amount', async () => {
    const fake = setSupabase({ upsertData: { id: 'snap-1' } });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await upsertSnapshot({
      id: '2026-03',
      entries: [{ category: 'savings', account: 'DBS', amount: 0 }],
    });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('rejects an invalid month before any DB call', async () => {
    const fake = setSupabase({ upsertData: { id: 'snap-1' } });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(
      upsertSnapshot({ ...VALID_SNAPSHOT, id: 'not-a-month' })
    ).rejects.toThrow();
    expect(fake.calls.upsert).toHaveLength(0);
  });

  it('surfaces an opaque error when the snapshot upsert fails', async () => {
    setSupabase({ upsertError: { message: 'deadlock detected' } });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow(
      'snapshot upsert failed'
    );
  });

  it('surfaces an opaque error when the entry insert fails', async () => {
    setSupabase({
      upsertData: { id: 'snap-1' },
      insertError: { message: 'value too long for type' },
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow(
      'asset_entries insert failed'
    );
  });

  it('renames the existing row when originalId differs from the new month', async () => {
    const fake = setSupabase({ selectData: { id: 'snap-1' } });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await upsertSnapshot({ ...VALID_SNAPSHOT, id: '2026-04' }, '2026-03');

    expect(fake.calls.upsert).toHaveLength(0);
    const moved = fake.calls.update[0] as Record<string, unknown>;
    expect(moved.month).toBe('2026-04');
    expect(
      fake.calls.queries.find((query) => query.operation === 'update')?.eq
    ).toEqual([
      { column: 'user_id', value: USER_ID },
      { column: 'month', value: '2026-03' },
    ]);
    expect(
      fake.calls.queries.find(
        (query) =>
          query.table === 'asset_entries' && query.operation === 'delete'
      )?.eq
    ).toEqual([{ column: 'snapshot_id', value: 'snap-1' }]);

    const entries = fake.calls.insert[0] as Array<Record<string, string>>;
    expect(entries[0].snapshot_id).toBe('snap-1');
    expect(await decryptPayload(entries[0].account, DEK)).toBe('DBS');
  });

  it('surfaces an opaque error when a rename collides with an existing month', async () => {
    const fake = setSupabase({
      selectError: {
        message: 'duplicate key value violates unique constraint',
      },
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(
      upsertSnapshot({ ...VALID_SNAPSHOT, id: '2026-04' }, '2026-03')
    ).rejects.toThrow('snapshot rename failed');
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('preserves the parent ID and saves new values when the edited month is unchanged', async () => {
    const fake = setSupabase({
      selectData: { id: 'snap-1' },
      upsertError: {
        code: '23503',
        message: 'existing child foreign key would be broken',
      },
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await upsertSnapshot(
      {
        ...VALID_SNAPSHOT,
        entries: [{ category: 'savings', account: 'DBS', amount: 7500 }],
      },
      '2026-03'
    );
    expect(fake.calls.upsert).toHaveLength(0);
    expect(fake.calls.update).toHaveLength(1);
    expect(fake.calls.update[0]).toEqual(
      expect.objectContaining({ month: '2026-03' })
    );
    expect(fake.calls.update[0]).not.toHaveProperty('id');
    expect(
      fake.calls.queries.find((q) => q.operation === 'update')?.eq
    ).toEqual([
      { column: 'user_id', value: USER_ID },
      { column: 'month', value: '2026-03' },
    ]);
    const entries = fake.calls.insert[0] as Array<Record<string, string>>;
    expect(entries[0].snapshot_id).toBe('snap-1');
    expect(decryptPayload(entries[0].amount, DEK)).toBe('7500');
  });
});

describe('snapshot-actions — deleteSnapshot', () => {
  it('issues a scoped delete on monthly_snapshots', async () => {
    const fake = setSupabase();
    const { deleteSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await deleteSnapshot('2026-03');
    expect(fake.calls.from).toContain('monthly_snapshots');
    expect(fake.calls.delete).toBe(1);
    expect(
      fake.calls.queries.find(
        (query) =>
          query.table === 'monthly_snapshots' && query.operation === 'delete'
      )?.eq
    ).toEqual([
      { column: 'user_id', value: USER_ID },
      { column: 'month', value: '2026-03' },
    ]);
  });

  it('surfaces an opaque error on a delete failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { deleteSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(deleteSnapshot('2026-03')).rejects.toThrow(
      'snapshot write failed'
    );
  });
});
