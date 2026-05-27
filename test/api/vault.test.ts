import { encryptPayload } from '@/lib/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon';

const VAULT_CANARY = 'fynfo_vault_ok';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const DEK_V1 = Buffer.alloc(32, 1);
const DEK_V2 = Buffer.alloc(32, 2);

type ProfileRow = {
  vault_check: string | null;
  vault_check_v2: string | null;
  vault_version: number;
};

interface CookieJar {
  set: ReturnType<typeof vi.fn>;
  get: (name: string) => { value: string } | undefined;
}

let cookieJar: CookieJar;
let profileRow: ProfileRow | null;
let rpcSpy: ReturnType<typeof vi.fn>;
let upsertSpy: ReturnType<typeof vi.fn>;
let getUserResult: {
  data: { user: { id: string; email: string } | null };
  error: { message: string } | null;
};

vi.mock('next/headers', () => ({
  cookies: async () => cookieJar,
}));

vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => getUserResult },
    from: (table: string) => buildFromBuilder(table),
    rpc: rpcSpy,
  }),
}));

vi.mock('@/lib/vault-rekey/rekey', () => ({
  rekeyUserVault: async (
    _supabase: unknown,
    _userId: string,
    _dekV1: Buffer,
    _dekV2: Buffer
  ) => {
    // Simulate RPC success — rekey logic itself is tested via integration in DB.
    if (profileRow) {
      profileRow.vault_check = null;
      profileRow.vault_check_v2 = 'v2_canary_after_rekey';
      profileRow.vault_version = 2;
    }
  },
}));

function buildFromBuilder(table: string) {
  if (table !== 'users_profile') {
    return {
      select: () => ({
        eq: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
      upsert: upsertSpy,
    };
  }
  return {
    select: () => ({
      eq: () => ({
        single: async () => ({ data: profileRow, error: null }),
      }),
    }),
    upsert: upsertSpy,
  };
}

function makeRequest(body: Record<string, string>): Request {
  return new Request('http://localhost/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function freshPost() {
  vi.resetModules();
  const mod = await import('@/app/api/vault/route');
  return mod.POST;
}

describe('POST /api/vault', () => {
  beforeEach(() => {
    cookieJar = {
      set: vi.fn(),
      get: () => undefined,
    };
    upsertSpy = vi.fn(async () => ({ error: null }));
    rpcSpy = vi.fn(async () => ({ error: null }));
    getUserResult = {
      data: { user: { id: USER_ID, email: 'user@test' } },
      error: null,
    };
    profileRow = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('(c) first unlock: writes v2 canary, vault_version=2, sets cookie', async () => {
    profileRow = null;
    const POST = await freshPost();

    const res = await POST(
      makeRequest({
        derivedKey: DEK_V1.toString('base64'),
        derivedKeyV2: DEK_V2.toString('base64'),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const upsertArg = upsertSpy.mock.calls[0][0];
    expect(upsertArg.vault_version).toBe(2);
    expect(upsertArg.vault_check_v2).toBeTruthy();
    expect(upsertArg.vault_check).toBeUndefined();
    expect(cookieJar.set).toHaveBeenCalledWith(
      'fynfo_vault_dek',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('(b) v2 unlock: verifies v2 canary, no rekey, returns success', async () => {
    profileRow = {
      vault_check: null,
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK_V2),
      vault_version: 2,
    };
    const POST = await freshPost();

    const res = await POST(
      makeRequest({
        derivedKey: DEK_V1.toString('base64'),
        derivedKeyV2: DEK_V2.toString('base64'),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(body.rekeyed).toBeUndefined();
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(cookieJar.set).toHaveBeenCalledTimes(1);
  });

  it('(a) v1 unlock: verifies v1 canary, runs rekey, returns {rekeyed:true}', async () => {
    profileRow = {
      vault_check: await encryptPayload(VAULT_CANARY, DEK_V1),
      vault_check_v2: null,
      vault_version: 1,
    };
    const POST = await freshPost();

    const res = await POST(
      makeRequest({
        derivedKey: DEK_V1.toString('base64'),
        derivedKeyV2: DEK_V2.toString('base64'),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, rekeyed: true });
    expect(cookieJar.set).toHaveBeenCalledTimes(1);
  });

  it('(d) wrong PIN on v1 vault: 401, no rekey, no cookie set', async () => {
    profileRow = {
      vault_check: await encryptPayload(VAULT_CANARY, DEK_V1),
      vault_check_v2: null,
      vault_version: 1,
    };
    const POST = await freshPost();

    const wrongV1 = Buffer.alloc(32, 9);
    const wrongV2 = Buffer.alloc(32, 8);
    const res = await POST(
      makeRequest({
        derivedKey: wrongV1.toString('base64'),
        derivedKeyV2: wrongV2.toString('base64'),
      })
    );

    expect(res.status).toBe(401);
    expect(cookieJar.set).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(profileRow.vault_version).toBe(1);
    expect(profileRow.vault_check).not.toBeNull();
    expect(profileRow.vault_check_v2).toBeNull();
  });

  it('(d2) wrong PIN on v2 vault: 401, no cookie set', async () => {
    profileRow = {
      vault_check: null,
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK_V2),
      vault_version: 2,
    };
    const POST = await freshPost();

    const wrongV2 = Buffer.alloc(32, 8);
    const res = await POST(
      makeRequest({
        derivedKey: DEK_V1.toString('base64'),
        derivedKeyV2: wrongV2.toString('base64'),
      })
    );

    expect(res.status).toBe(401);
    expect(cookieJar.set).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed body with 400', async () => {
    const POST = await freshPost();

    const res = await POST(
      makeRequest({
        derivedKey: 'not-base64-32-bytes',
        derivedKeyV2: DEK_V2.toString('base64'),
      })
    );

    expect(res.status).toBe(400);
  });

  it('rejects missing derivedKeyV2 with 400 (forces transitional contract)', async () => {
    const POST = await freshPost();

    const res = await POST(
      new Request('http://localhost/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ derivedKey: DEK_V1.toString('base64') }),
      })
    );

    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    getUserResult = {
      data: { user: null },
      error: { message: 'no session' },
    };
    const POST = await freshPost();

    const res = await POST(
      makeRequest({
        derivedKey: DEK_V1.toString('base64'),
        derivedKeyV2: DEK_V2.toString('base64'),
      })
    );

    expect(res.status).toBe(401);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });
});
