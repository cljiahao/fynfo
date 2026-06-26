import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-1111-1111-111111111111';

let getUserResult: {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};
let dekResult: Buffer | null;
let khResult: Buffer | null;

vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => getUserResult },
  }),
}));

vi.mock('@/lib/keystore', () => ({
  getVaultDekSession: async () => dekResult,
}));

vi.mock('@/lib/household-keystore', () => ({
  getHouseholdKhSession: async () => khResult,
}));

beforeEach(() => {
  getUserResult = { data: { user: { id: USER_ID } }, error: null };
  dekResult = Buffer.alloc(32, 1);
  khResult = Buffer.alloc(32, 2);
});

describe('action-guard — requireActionContext (auth + vault + db)', () => {
  it('returns userId, dek, and supabase on the happy path', async () => {
    const { requireActionContext } = await import('@/lib/action-guard');
    const ctx = await requireActionContext();
    expect(ctx.userId).toBe(USER_ID);
    expect(ctx.dek.length).toBe(32);
    expect(ctx.supabase).toBeTruthy();
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    getUserResult = { data: { user: null }, error: { message: 'no session' } };
    const { requireActionContext } = await import('@/lib/action-guard');
    await expect(requireActionContext()).rejects.toThrow('Unauthorized');
  });

  it('throws when the vault is locked (no DEK in session)', async () => {
    dekResult = null;
    const { requireActionContext } = await import('@/lib/action-guard');
    await expect(requireActionContext()).rejects.toThrow('Vault is locked');
  });
});

describe('action-guard — requireDbContext (auth + db, no vault)', () => {
  it('returns userId and supabase on the happy path', async () => {
    const { requireDbContext } = await import('@/lib/action-guard');
    const ctx = await requireDbContext();
    expect(ctx.userId).toBe(USER_ID);
    expect(ctx.supabase).toBeTruthy();
  });

  it('throws Unauthorized when unauthenticated', async () => {
    getUserResult = { data: { user: null }, error: { message: 'no session' } };
    const { requireDbContext } = await import('@/lib/action-guard');
    await expect(requireDbContext()).rejects.toThrow('Unauthorized');
  });
});

describe('action-guard — requireHouseholdContext (auth + household key + db)', () => {
  it('returns userId, kh, and supabase on the happy path', async () => {
    const { requireHouseholdContext } = await import('@/lib/action-guard');
    const ctx = await requireHouseholdContext();
    expect(ctx.userId).toBe(USER_ID);
    expect(ctx.kh.length).toBe(32);
    expect(ctx.supabase).toBeTruthy();
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    getUserResult = { data: { user: null }, error: { message: 'no session' } };
    const { requireHouseholdContext } = await import('@/lib/action-guard');
    await expect(requireHouseholdContext()).rejects.toThrow('Unauthorized');
  });

  it('throws when the household is locked (no K_h in session)', async () => {
    khResult = null;
    const { requireHouseholdContext } = await import('@/lib/action-guard');
    await expect(requireHouseholdContext()).rejects.toThrow(
      'Household is locked'
    );
  });
});
