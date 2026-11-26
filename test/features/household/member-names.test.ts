import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const OTHER = 'user-2';
const KH = Buffer.alloc(32, 9);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
let khSession: Buffer | null;

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KH, supabase }),
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

vi.mock('@/lib/household-keystore', () => ({
  setHouseholdKhSession: async () => undefined,
  getHouseholdKhSession: async () => khSession,
}));

function withUser(
  fake: ReturnType<typeof makeFakeSupabase>,
  user: Record<string, unknown> | null
) {
  supabase = Object.assign(fake.client, {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  });
}

const household = { id: 'h1', name: 'Home', created_at: '2026-06-26' };

beforeEach(() => {
  khSession = KH;
});

describe('setMemberDisplayName', () => {
  it('seals the trimmed name under K_h and calls the own-row RPC only', async () => {
    const fake = makeFakeSupabase();
    supabase = fake.client;
    const { setMemberDisplayName } =
      await import('@/features/household/actions/member-name-actions');
    await setMemberDisplayName({ name: '  Alex  ' });
    expect(fake.calls.rpc).toHaveLength(1);
    expect(fake.calls.rpc[0].name).toBe('set_household_member_name');
    const args = fake.calls.rpc[0].args as { p_display_name: string };
    expect(Object.keys(args)).toEqual(['p_display_name']);
    expect(args.p_display_name).not.toContain('Alex');
    expect(decryptPayload(args.p_display_name, KH)).toBe('Alex');
    expect(fake.calls.update).toHaveLength(0);
  });

  it.each([[''], ['   '], ['x'.repeat(41)], [42], [undefined]])(
    'rejects %j before any DB call',
    async (name) => {
      const fake = makeFakeSupabase();
      supabase = fake.client;
      const { setMemberDisplayName } =
        await import('@/features/household/actions/member-name-actions');
      await expect(setMemberDisplayName({ name })).rejects.toThrow();
      expect(fake.calls.rpc).toHaveLength(0);
    }
  );

  it('accepts exactly 40 characters', async () => {
    const fake = makeFakeSupabase();
    supabase = fake.client;
    const { setMemberDisplayName } =
      await import('@/features/household/actions/member-name-actions');
    await setMemberDisplayName({ name: 'x'.repeat(40) });
    expect(fake.calls.rpc).toHaveLength(1);
  });

  it('does not leak database text on failure', async () => {
    const fake = makeFakeSupabase({
      rpcError: {
        set_household_member_name: { message: 'relation household_members' },
      },
    });
    supabase = fake.client;
    const { setMemberDisplayName } =
      await import('@/features/household/actions/member-name-actions');
    const err = await setMemberDisplayName({ name: 'Alex' }).catch(
      (e: Error) => e
    );
    expect(String((err as Error).message)).not.toContain('household_members');
  });
});

describe('getHousehold names', () => {
  const rows = (own: string | null) => [
    {
      role: 'owner',
      user_id: USER_ID,
      display_name: own,
      households: household,
    },
    {
      role: 'member',
      user_id: OTHER,
      display_name: encryptPayload('Sam', KH),
      households: household,
    },
  ];

  it('decrypts roster names and skips undecryptable ones', async () => {
    const fake = makeFakeSupabase({
      selectData: [
        ...rows(encryptPayload('Alex', KH)),
        {
          role: 'member',
          user_id: 'user-3',
          display_name: 'not-ciphertext',
          households: household,
        },
      ],
    });
    withUser(fake, { email: 'a@b.c', user_metadata: {} });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    const summary = await getHousehold();
    expect(summary?.memberNames).toEqual({ [USER_ID]: 'Alex', [OTHER]: 'Sam' });
    expect(fake.calls.rpc).toHaveLength(0);
  });

  it('returns no names while locked', async () => {
    khSession = null;
    const fake = makeFakeSupabase({ selectData: rows(null) });
    withUser(fake, { email: 'a@b.c', user_metadata: {} });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    expect((await getHousehold())?.memberNames).toEqual({});
    expect(fake.calls.rpc).toHaveLength(0);
  });

  it('seeds the caller with their full name when the row has none', async () => {
    const fake = makeFakeSupabase({ selectData: rows(null) });
    withUser(fake, {
      email: 'a@b.c',
      user_metadata: { full_name: 'Alex Tan' },
    });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    const summary = await getHousehold();
    expect(summary?.memberNames[USER_ID]).toBe('Alex Tan');
    const args = fake.calls.rpc[0].args as { p_display_name: string };
    expect(decryptPayload(args.p_display_name, KH)).toBe('Alex Tan');
  });

  it('falls back to the email local part and caps at 40 characters', async () => {
    const fake = makeFakeSupabase({ selectData: rows(null) });
    withUser(fake, { email: `${'a'.repeat(50)}@b.c`, user_metadata: {} });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    expect((await getHousehold())?.memberNames[USER_ID]).toBe('a'.repeat(40));
  });

  it('still loads when seeding fails', async () => {
    const fake = makeFakeSupabase({
      selectData: rows(null),
      rpcError: { set_household_member_name: { message: 'boom' } },
    });
    withUser(fake, { email: 'a@b.c', user_metadata: {} });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    const summary = await getHousehold();
    expect(summary?.memberNames[USER_ID]).toBeUndefined();
    expect(summary?.memberNames[OTHER]).toBe('Sam');
  });
});
