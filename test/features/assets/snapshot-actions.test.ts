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
  it('encrypts entries in one RPC with database-owned parent and owner fields', async () => {
    const fake = setSupabase();
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await upsertSnapshot(VALID_SNAPSHOT);
    expect(fake.calls.from).toEqual([]);
    expect(fake.calls.rpc).toHaveLength(1);
    const { name } = fake.calls.rpc[0];
    const args = fake.calls.rpc[0].args as Record<string, unknown>;
    expect(name).toBe('replace_asset_snapshot');
    expect(args).toMatchObject({ p_month: '2026-03', p_original_month: null });
    expect(args).not.toHaveProperty('user_id');
    const entries = args.p_entries as Array<Record<string, string>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty('snapshot_id');
    expect(entries[0]).not.toHaveProperty('user_id');
    expect(entries[0].category).toBe('savings');
    expect(await decryptPayload(entries[0].account, DEK)).toBe('DBS');
    expect(await decryptPayload(entries[0].amount, DEK)).toBe('5000');
  });
  it('prepares all ciphertext before any database access', async () => {
    const fake = setSupabase();
    const encrypt = fieldCrypto.encryptPayload;
    vi.spyOn(fieldCrypto, 'encryptPayload').mockImplementation((text, key) => {
      if (text === '5000') throw new Error('child encryption failed');
      return encrypt(text, key);
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow(
      'child encryption failed'
    );
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.from).toEqual([]);
  });
  it('replaces entries with an empty list when none are positive', async () => {
    const fake = setSupabase();
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await upsertSnapshot({
      id: '2026-03',
      entries: [{ category: 'savings', account: '', amount: 0 }],
    });
    expect(
      (fake.calls.rpc[0].args as Record<string, unknown>).p_entries
    ).toEqual([]);
  });
  it.each(['not-a-month', '2026-13'])(
    'rejects invalid target and original month %s before DB access',
    async (month) => {
      const fake = setSupabase();
      const { upsertSnapshot } =
        await import('@/features/assets/actions/snapshot-actions');
      await expect(
        upsertSnapshot({ ...VALID_SNAPSHOT, id: month })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(upsertSnapshot(VALID_SNAPSHOT, month)).rejects.toMatchObject(
        { code: 'VALIDATION' }
      );
      expect(fake.calls.rpc).toEqual([]);
      expect(fake.calls.from).toEqual([]);
    }
  );
  it.each(['2026-03', '2026-04'])(
    'passes original month when edited to %s',
    async (month) => {
      const fake = setSupabase();
      const { upsertSnapshot } =
        await import('@/features/assets/actions/snapshot-actions');
      await upsertSnapshot({ ...VALID_SNAPSHOT, id: month }, '2026-03');
      expect(fake.calls.rpc[0].args).toMatchObject({
        p_month: month,
        p_original_month: '2026-03',
      });
      expect(fake.calls.from).toEqual([]);
    }
  );
  it('fails closed with an opaque RPC error', async () => {
    const fake = setSupabase({
      rpcError: {
        replace_asset_snapshot: { message: 'private constraint details' },
      },
    });
    const { upsertSnapshot } =
      await import('@/features/assets/actions/snapshot-actions');
    await expect(upsertSnapshot(VALID_SNAPSHOT)).rejects.toThrow(
      'snapshot save failed'
    );
    expect(fake.calls.from).toEqual([]);
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
