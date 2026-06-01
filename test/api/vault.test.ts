import { encryptPayload } from '@/lib/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon';

const VAULT_CANARY = 'fynfo_vault_ok';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const DEK = Buffer.alloc(32, 2);

type ProfileRow = {
  vault_check_v2: string | null;
  vault_version: number;
};

interface CookieJar {
  set: ReturnType<typeof vi.fn>;
  get: (name: string) => { value: string } | undefined;
}

let cookieJar: CookieJar;
let profileRow: ProfileRow | null;
let upsertSpy: ReturnType<typeof vi.fn>;
let getUserResult: {
  data: { user: { id: string; email: string } | null };
  error: { message: string } | null;
};
let rpcLocked: { data: unknown; error: unknown };
let rpcRecord: { data: unknown; error: unknown };

vi.mock('next/headers', () => ({
  cookies: async () => cookieJar,
}));

vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => getUserResult },
    from: (table: string) => buildFromBuilder(table),
    rpc: async (fn: string) =>
      fn === 'vault_unlock_locked' ? rpcLocked : rpcRecord,
  }),
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
    getUserResult = {
      data: { user: { id: USER_ID, email: 'user@test' } },
      error: null,
    };
    profileRow = null;
    rpcLocked = { data: false, error: null };
    rpcRecord = { data: false, error: null };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('first unlock: writes v2 canary, vault_version=2, sets cookie', async () => {
    profileRow = null;
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const upsertArg = upsertSpy.mock.calls[0][0];
    expect(upsertArg.vault_version).toBe(2);
    expect(upsertArg.vault_check_v2).toBeTruthy();
    expect(cookieJar.set).toHaveBeenCalledWith(
      'fynfo_vault_dek',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('returning v2 user: verifies canary, returns success, no upsert', async () => {
    profileRow = {
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(cookieJar.set).toHaveBeenCalledTimes(1);
  });

  it('wrong PIN: 401, no cookie set', async () => {
    profileRow = {
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    const POST = await freshPost();

    const wrong = Buffer.alloc(32, 8);
    const res = await POST(
      makeRequest({ derivedKey: wrong.toString('base64') })
    );

    expect(res.status).toBe(401);
    expect(cookieJar.set).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed body with 400', async () => {
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: 'not-base64-32-bytes' }));

    expect(res.status).toBe(400);
  });

  it('rejects missing derivedKey with 400', async () => {
    const POST = await freshPost();

    const res = await POST(
      new Request('http://localhost/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));

    expect(res.status).toBe(401);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('rate-limit: returns 429 and skips the canary check when locked', async () => {
    profileRow = {
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    rpcLocked = { data: true, error: null };
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));

    expect(res.status).toBe(429);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('rate-limit: a wrong PIN that trips the lock returns 429', async () => {
    profileRow = {
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    rpcRecord = { data: true, error: null }; // record() reports now-locked
    const POST = await freshPost();

    const wrong = Buffer.alloc(32, 8);
    const res = await POST(
      makeRequest({ derivedKey: wrong.toString('base64') })
    );

    expect(res.status).toBe(429);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('rate-limit: fails open (still unlocks) when the throttle RPC errors', async () => {
    profileRow = {
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    rpcLocked = { data: null, error: { code: '42883' } }; // function missing
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));

    expect(res.status).toBe(200);
    expect(cookieJar.set).toHaveBeenCalledTimes(1);
  });
});
