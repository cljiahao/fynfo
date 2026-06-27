import {
  deriveInviteKey,
  hashInviteCode,
  unwrapKh,
  wrapKh,
} from '@/lib/household-key';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 4);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
let lastSetKh: Buffer | null;
let khSession: Buffer | null;

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: DEK, supabase }),
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

vi.mock('@/lib/household-keystore', () => ({
  setHouseholdKhSession: async (kh: Buffer) => {
    lastSetKh = kh;
  },
  getHouseholdKhSession: async () => khSession,
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  lastSetKh = null;
  khSession = null;
  setSupabase();
});

describe('household-actions — createHousehold', () => {
  it('inserts household + owner member with a wrapped K_h and opens the session', async () => {
    const fake = setSupabase();
    const { createHousehold } =
      await import('@/features/household/actions/household-actions');
    const { householdId } = await createHousehold({ name: 'Home' });

    expect(fake.calls.from).toContain('households');
    expect(fake.calls.from).toContain('household_members');

    const household = fake.calls.insert[0] as Record<string, string>;
    expect(household.id).toBe(householdId);
    expect(household.name).toBe('Home');
    expect(household.created_by).toBe(USER_ID);

    const member = fake.calls.insert[1] as Record<string, string>;
    expect(member.role).toBe('owner');
    // wrapped_kh is ciphertext that unwraps to the session K_h under the DEK
    const recovered = unwrapKh(member.wrapped_kh, DEK);
    expect(recovered).toHaveLength(32);
    expect((lastSetKh as Buffer).equals(recovered)).toBe(true);
  });

  it('rejects a blank name before any DB write', async () => {
    const fake = setSupabase();
    const { createHousehold } =
      await import('@/features/household/actions/household-actions');
    await expect(createHousehold({ name: '   ' })).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });
});

describe('household-actions — getHousehold', () => {
  it('returns the caller household summary, locked when no key in session', async () => {
    khSession = null;
    setSupabase({
      selectData: [
        {
          role: 'owner',
          households: { id: 'h1', name: 'Home', created_at: '2026-06-26' },
        },
      ],
    });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    expect(await getHousehold()).toEqual({
      id: 'h1',
      name: 'Home',
      role: 'owner',
      createdAt: '2026-06-26',
      locked: true,
    });
  });

  it('reports locked:false when the household key is in session', async () => {
    khSession = Buffer.alloc(32, 1);
    setSupabase({
      selectData: [
        {
          role: 'member',
          households: { id: 'h1', name: 'Home', created_at: '2026-06-26' },
        },
      ],
    });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    const summary = await getHousehold();
    expect(summary?.locked).toBe(false);
    expect(summary?.role).toBe('member');
  });

  it('returns null when the caller is in no household', async () => {
    setSupabase({ selectData: [] });
    const { getHousehold } =
      await import('@/features/household/actions/household-actions');
    expect(await getHousehold()).toBeNull();
  });
});

describe('household-actions — unlockHousehold', () => {
  it('recovers K_h from the wrapped member row and opens the session', async () => {
    const kh = Buffer.alloc(32, 2);
    setSupabase({
      selectData: [
        { household_id: 'h1', role: 'owner', wrapped_kh: wrapKh(kh, DEK) },
      ],
    });
    const { unlockHousehold } =
      await import('@/features/household/actions/household-actions');
    expect(await unlockHousehold()).toEqual({ ok: true });
    expect((lastSetKh as Buffer).equals(kh)).toBe(true);
  });

  it('throws when the caller is not in a household', async () => {
    setSupabase({ selectData: [] });
    const { unlockHousehold } =
      await import('@/features/household/actions/household-actions');
    await expect(unlockHousehold()).rejects.toThrow('No household to unlock');
    expect(lastSetKh).toBeNull();
  });
});

describe('household-actions — createInvite', () => {
  it('owner mints an invite that stores only the hash + wrapped K_h', async () => {
    const kh = Buffer.alloc(32, 5);
    const fake = setSupabase({
      selectData: [
        { household_id: 'h1', role: 'owner', wrapped_kh: wrapKh(kh, DEK) },
      ],
    });
    const { createInvite } =
      await import('@/features/household/actions/household-actions');
    const { secret } = await createInvite();

    const row = fake.calls.insert[0] as Record<string, string>;
    // never stores the raw secret
    expect(JSON.stringify(row)).not.toContain(secret);
    expect(row.invite_code_hash).toBe(hashInviteCode(secret));
    // the wrapped blob recovers K_h when re-derived from the secret + salt
    const inviteKey = deriveInviteKey(secret, row.kdf_salt);
    expect(unwrapKh(row.wrapped_kh_under_invite, inviteKey).equals(kh)).toBe(
      true
    );
    expect(typeof row.expires_at).toBe('string');
  });

  it('rejects a non-owner', async () => {
    const kh = Buffer.alloc(32, 5);
    const fake = setSupabase({
      selectData: [
        { household_id: 'h1', role: 'member', wrapped_kh: wrapKh(kh, DEK) },
      ],
    });
    const { createInvite } =
      await import('@/features/household/actions/household-actions');
    await expect(createInvite()).rejects.toThrow('owner');
    expect(fake.calls.insert).toHaveLength(0);
  });
});

describe('household-actions — acceptInvite', () => {
  it('re-wraps K_h under the accepter DEK, consumes the invite, opens session', async () => {
    const kh = Buffer.alloc(32, 6);
    const secret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // base64url-shaped
    const saltB64 = Buffer.alloc(16, 1).toString('base64');
    const inviteKey = deriveInviteKey(secret, saltB64);

    const fake = setSupabase({
      rpcData: {
        accept_household_invite: [
          {
            invite_id: 'inv-1',
            household_id: 'h1',
            wrapped_kh_under_invite: wrapKh(kh, inviteKey),
            kdf_salt: saltB64,
          },
        ],
        consume_household_invite: 'h1',
      },
    });
    const { acceptInvite } =
      await import('@/features/household/actions/household-actions');
    const result = await acceptInvite({ secret });

    expect(result).toEqual({ householdId: 'h1' });
    // consume RPC was called with K_h re-wrapped under the accepter's own DEK
    const consume = fake.calls.rpc.find(
      (c) => c.name === 'consume_household_invite'
    );
    const args = consume?.args as { p_user_id: string; p_wrapped_kh: string };
    expect(args.p_user_id).toBe(USER_ID);
    expect(unwrapKh(args.p_wrapped_kh, DEK).equals(kh)).toBe(true);
    expect((lastSetKh as Buffer).equals(kh)).toBe(true);
  });

  it('throws on an unknown / expired invite (RPC returns no row)', async () => {
    const secret = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    setSupabase({ rpcData: { accept_household_invite: [] } });
    const { acceptInvite } =
      await import('@/features/household/actions/household-actions');
    await expect(acceptInvite({ secret })).rejects.toThrow('Invite not valid');
    expect(lastSetKh).toBeNull();
  });
});
