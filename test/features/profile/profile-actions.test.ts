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

describe('profile-actions — getProfile', () => {
  it('maps snake_case columns to the camelCase ProfileData shape', async () => {
    setSupabase({
      selectData: {
        birth_year: 1995,
        is_nsman: true,
        residency_status: 'resident',
      },
    });
    const { getProfile } =
      await import('@/features/profile/actions/profile-actions');
    expect(await getProfile()).toEqual({
      birthYear: 1995,
      isNsman: true,
      residencyStatus: 'resident',
    });
  });

  it('returns null when the row is missing', async () => {
    setSupabase({ selectData: null });
    const { getProfile } =
      await import('@/features/profile/actions/profile-actions');
    expect(await getProfile()).toBeNull();
  });

  it('returns null on a read error (no throw, no leak)', async () => {
    setSupabase({
      selectError: { message: 'permission denied for table users_profile' },
    });
    const { getProfile } =
      await import('@/features/profile/actions/profile-actions');
    expect(await getProfile()).toBeNull();
  });
});

describe('profile-actions — upsertProfile', () => {
  const valid = {
    birthYear: 1990,
    isNsman: false,
    residencyStatus: 'resident' as const,
  };

  it('writes mapped columns on valid input', async () => {
    const fake = setSupabase();
    const { upsertProfile } =
      await import('@/features/profile/actions/profile-actions');
    await upsertProfile(valid);
    expect(fake.calls.from).toContain('users_profile');
    const payload = fake.calls.update[0] as Record<string, unknown>;
    expect(payload.birth_year).toBe(1990);
    expect(payload.is_nsman).toBe(false);
    expect(payload.residency_status).toBe('resident');
    expect(typeof payload.updated_at).toBe('string');
  });

  it('rejects invalid input before touching the database', async () => {
    const fake = setSupabase();
    const { upsertProfile } =
      await import('@/features/profile/actions/profile-actions');
    await expect(
      // residencyStatus not in the enum
      upsertProfile({ ...valid, residencyStatus: 'alien' as never })
    ).rejects.toThrow();
    expect(fake.calls.update).toHaveLength(0);
    expect(fake.calls.from).toHaveLength(0);
  });

  it('surfaces an opaque error on a write failure', async () => {
    setSupabase({
      selectError: {
        message: 'duplicate key value violates unique constraint',
      },
    });
    const { upsertProfile } =
      await import('@/features/profile/actions/profile-actions');
    await expect(upsertProfile(valid)).rejects.toThrow('profile write failed');
  });
});
