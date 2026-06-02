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

describe('relief-actions — getAllTaxReliefs', () => {
  it('decrypts amount and carries the year across all years', async () => {
    setSupabase({
      selectData: [
        {
          year: 2025,
          relief_key: 'cpf',
          amount: await encryptPayload('1000', DEK),
        },
        {
          year: 2026,
          relief_key: 'srs',
          amount: await encryptPayload('500', DEK),
        },
      ],
    });
    const { getAllTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    expect(await getAllTaxReliefs()).toEqual([
      { year: 2025, reliefKey: 'cpf', amount: 1000 },
      { year: 2026, reliefKey: 'srs', amount: 500 },
    ]);
  });

  it('returns [] when there are no rows', async () => {
    setSupabase({ selectData: [] });
    const { getAllTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    expect(await getAllTaxReliefs()).toEqual([]);
  });

  it('surfaces an opaque error on a read failure', async () => {
    setSupabase({
      selectError: { message: 'permission denied on tax_relief_entries' },
    });
    const { getAllTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(getAllTaxReliefs()).rejects.toThrow('tax_relief read failed');
  });
});
