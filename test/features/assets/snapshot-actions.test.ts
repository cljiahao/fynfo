import { encryptPayload } from '@/lib/crypto';
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
  setSupabase();
});

describe('snapshot-actions — getSnapshots', () => {
  it('decrypts entry account and amount on success', async () => {
    setSupabase({
      selectData: [
        {
          month: '2026-03',
          entries: [
            {
              category: 'savings',
              account: await encryptPayload('DBS', DEK),
              amount: await encryptPayload('5000', DEK),
            },
          ],
        },
      ],
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
