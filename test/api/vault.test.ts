import { encryptPayload } from '@/lib/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon';

const VAULT_CANARY = 'fynfo_vault_ok';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const DEK = Buffer.alloc(32, 2);
const ATTEMPT_ID = '71111111-1111-4111-8111-111111111111';
const securityRpc = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: securityRpc }),
}));

type ProfileRow = {
  vault_check_v2: string | null;
  vault_version: number;
  email?: string;
};

interface CookieJar {
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  get: (name: string) => { value: string } | undefined;
}

let cookieJar: CookieJar;
let profileRow: ProfileRow | null;
let profileError: { code: string } | null;
let upsertSpy: ReturnType<typeof vi.fn>;
let readBarrier: (() => Promise<void>) | null;
let updateSpy: ReturnType<typeof vi.fn>;
let fromSpy: ReturnType<typeof vi.fn<typeof buildFromBuilder>>;
let updatePredicateSpy: ReturnType<typeof vi.fn>;
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
    from: (table: string) => fromSpy(table),
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
        maybeSingle: async () => {
          const data = profileRow ? { ...profileRow } : null;
          await readBarrier?.();
          return { data, error: profileError };
        },
      }),
    }),
    upsert: upsertSpy,
    update: updateSpy,
  };
}

function makeRequest(body: Record<string, string>): Request {
  return new Request('http://localhost/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function storedProfile(): ProfileRow | null {
  return profileRow;
}

async function freshPost() {
  vi.resetModules();
  const mod = await import('@/app/api/vault/route');
  return mod.POST;
}

describe('/api/vault lifecycle', () => {
  it.each([
    DEK.toString('base64') + '!'.repeat(100),
    DEK.toString('base64').replace('=', ''),
    ' ' + DEK.toString('base64'),
  ])(
    'rejects noncanonical key input before storing a canary',
    async (derivedKey) => {
      const POST = await freshPost();
      const response = await POST(makeRequest({ derivedKey }));
      expect(response.status).toBe(400);
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(cookieJar.set).not.toHaveBeenCalled();
    }
  );
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'fixture-secret-key');
    securityRpc.mockImplementation(async (name) =>
      name === 'reserve_vault_unlock'
        ? {
            data: rpcLocked.error
              ? null
              : rpcLocked.data === true
                ? null
                : ATTEMPT_ID,
            error: rpcLocked.error,
          }
        : rpcRecord
    );
    cookieJar = {
      set: vi.fn(),
      delete: vi.fn(),
      get: () => undefined,
    };
    readBarrier = null;
    fromSpy = vi.fn(buildFromBuilder);
    updatePredicateSpy = vi.fn();
    upsertSpy = vi.fn(
      async (row: ProfileRow, options?: { ignoreDuplicates?: boolean }) => {
        if (!options?.ignoreDuplicates || !profileRow) profileRow = { ...row };
        return { error: null };
      }
    );
    updateSpy = vi.fn((row: Partial<ProfileRow>) => ({
      eq: (column: string, id: string) => ({
        is: async (canaryColumn: string, value: null) => {
          expect([column, id, canaryColumn, value]).toEqual([
            'id',
            USER_ID,
            'vault_check_v2',
            null,
          ]);
          if (profileRow && profileRow.vault_check_v2 === null)
            profileRow = { ...profileRow, ...row };
          return { error: null };
        },
      }),
    }));
    getUserResult = {
      data: { user: { id: USER_ID, email: 'user@test' } },
      error: null,
    };
    profileRow = null;
    profileError = null;
    rpcLocked = { data: false, error: null };
    rpcRecord = { data: false, error: null };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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
    expect(storedProfile()?.vault_version).toBe(2);
    expect(storedProfile()?.vault_check_v2).toBeTruthy();
    expect(upsertArg.email).toBe('user@test');
    expect(cookieJar.set).toHaveBeenCalledWith(
      'fynfo_vault_dek',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('returns only no-store lifecycle metadata without writing a profile or cookie', async () => {
    profileRow = {
      vault_check_v2: encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    const { GET } = await import('@/app/api/vault/route');
    const response = await GET(new Request('http://localhost/api/vault'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ initialized: true });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('reports a new vault only after a successful authenticated read', async () => {
    const { GET } = await import('@/app/api/vault/route');
    const response = await GET(new Request('http://localhost/api/vault'));
    expect(await response.json()).toEqual({ initialized: false });
    profileError = { code: 'private detail' };
    const failed = await GET(new Request('http://localhost/api/vault'));
    expect(failed.status).toBe(500);
    expect(await failed.json()).not.toHaveProperty('initialized');
    getUserResult.data.user = null;
    expect((await GET(new Request('http://localhost/api/vault'))).status).toBe(
      401
    );
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('concurrent first unlock preserves the winning key and rejects the loser', async () => {
    profileRow = {
      vault_check_v2: null,
      vault_version: 1,
      email: 'preserved@test',
    };
    let release: () => void = () => {};
    const bothReads = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    readBarrier = async () => {
      reads += 1;
      if (reads === 2) {
        readBarrier = null;
        release();
      }
      await bothReads;
    };
    const POST = await freshPost();
    const responses = await Promise.all([
      POST(makeRequest({ derivedKey: DEK.toString('base64') })),
      POST(makeRequest({ derivedKey: Buffer.alloc(32, 8).toString('base64') })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    expect(profileRow?.email).toBe('preserved@test');
    expect(cookieJar.set).toHaveBeenCalledTimes(1);
    const finishes = securityRpc.mock.calls.filter(
      ([name]) => name === 'finish_vault_unlock'
    );
    expect(finishes.map(([, args]) => args.p_success).sort()).toEqual([
      false,
      true,
    ]);
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

  it.each(['insert', 'update', 'winner-read'])(
    'fails closed when initialization %s fails',
    async (stage) => {
      if (stage === 'insert')
        upsertSpy.mockResolvedValue({ error: { code: '08006' } });
      if (stage === 'update') {
        updateSpy.mockReturnValue({
          eq: () => ({ is: async () => ({ error: { code: '08006' } }) }),
        });
      }
      if (stage === 'winner-read') {
        upsertSpy.mockImplementation(async (row: ProfileRow) => {
          profileRow = { ...row };
          profileError = { code: '08006' };
          return { error: null };
        });
      }
      const POST = await freshPost();
      const response = await POST(
        makeRequest({ derivedKey: DEK.toString('base64') })
      );
      expect(response.status).toBe(500);
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(
        securityRpc.mock.calls.filter(
          ([name]) => name === 'finish_vault_unlock'
        )
      ).toEqual([]);
    }
  );

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
    // record() reports now-locked
    rpcRecord = { data: true, error: null };
    const POST = await freshPost();

    const wrong = Buffer.alloc(32, 8);
    const res = await POST(
      makeRequest({ derivedKey: wrong.toString('base64') })
    );

    expect(res.status).toBe(429);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('fails closed (500, no re-init) when the profile read errors', async () => {
    // connection failure
    profileError = { code: '08006' };
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));

    expect(res.status).toBe(500);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it('rate-limit: fails closed without a cookie when the throttle RPC errors', async () => {
    profileRow = {
      vault_check_v2: await encryptPayload(VAULT_CANARY, DEK),
      vault_version: 2,
    };
    // function missing
    rpcLocked = { data: null, error: { code: '42883' } };
    const POST = await freshPost();

    const res = await POST(makeRequest({ derivedKey: DEK.toString('base64') }));

    expect(res.status).toBe(500);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });
  describe('DELETE /api/vault', () => {
    it('resets only the authenticated profile before clearing the personal vault cookie', async () => {
      let finishWrite: () => void = () => {};
      const writeCompleted = vi.fn();
      const write = new Promise<{ error: null }>((resolve) => {
        finishWrite = () => {
          writeCompleted();
          resolve({ error: null });
        };
      });
      updatePredicateSpy.mockReturnValue(write);
      updateSpy.mockReturnValue({ eq: updatePredicateSpy });
      const { DELETE } = await import('@/app/api/vault/route');
      const pending = DELETE(
        new Request('http://localhost/api/vault', { method: 'DELETE' })
      );
      await vi.waitFor(() =>
        expect(updatePredicateSpy).toHaveBeenCalledExactlyOnceWith(
          'id',
          USER_ID
        )
      );
      expect(cookieJar.delete).not.toHaveBeenCalled();
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(writeCompleted).not.toHaveBeenCalled();
      finishWrite();
      const response = await pending;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(fromSpy).toHaveBeenCalledExactlyOnceWith('users_profile');
      expect(updateSpy).toHaveBeenCalledExactlyOnceWith({
        vault_check_v2: null,
        vault_version: 1,
      });
      expect(updatePredicateSpy).toHaveBeenCalledExactlyOnceWith('id', USER_ID);
      expect(cookieJar.delete).toHaveBeenCalledExactlyOnceWith(
        'fynfo_vault_dek'
      );
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(securityRpc).not.toHaveBeenCalled();
      expect(writeCompleted.mock.invocationCallOrder[0]).toBeLessThan(
        cookieJar.delete.mock.invocationCallOrder[0]
      );
    });

    it.each(['missing-user', 'auth-error'] as const)(
      'rejects %s without database or cookie changes',
      async (mode) => {
        getUserResult =
          mode === 'missing-user'
            ? { data: { user: null }, error: null }
            : {
                data: { user: { id: USER_ID, email: 'user@test' } },
                error: { message: 'private auth provider detail' },
              };
        const { DELETE } = await import('@/app/api/vault/route');
        const response = await DELETE(
          new Request('http://localhost/api/vault', { method: 'DELETE' })
        );
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        expect(fromSpy).not.toHaveBeenCalled();
        expect(updateSpy).not.toHaveBeenCalled();
        expect(cookieJar.delete).not.toHaveBeenCalled();
        expect(cookieJar.set).not.toHaveBeenCalled();
        expect(securityRpc).not.toHaveBeenCalled();
      }
    );

    it('keeps the cookie when the owner-scoped reset write fails and returns an opaque error', async () => {
      updatePredicateSpy.mockResolvedValue({
        error: { code: 'private-reset-constraint' },
      });
      updateSpy.mockReturnValue({ eq: updatePredicateSpy });
      const { DELETE } = await import('@/app/api/vault/route');
      const response = await DELETE(
        new Request('http://localhost/api/vault', { method: 'DELETE' })
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Failed to reset vault',
        code: 'INTERNAL',
      });
      expect(updateSpy).toHaveBeenCalledExactlyOnceWith({
        vault_check_v2: null,
        vault_version: 1,
      });
      expect(updatePredicateSpy).toHaveBeenCalledExactlyOnceWith('id', USER_ID);
      expect(cookieJar.delete).not.toHaveBeenCalled();
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(securityRpc).not.toHaveBeenCalled();
    });
  });

  it.each([
    Buffer.alloc(31, 2).toString('base64'),
    DEK.toString('base64').slice(0, -2) + 'J=',
  ])(
    'rejects a noncanonical 44-character key without profile or cookie changes',
    async (derivedKey) => {
      expect(derivedKey).toHaveLength(44);
      const POST = await freshPost();
      const response = await POST(makeRequest({ derivedKey }));
      expect(response.status).toBe(400);
      expect(fromSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(securityRpc).not.toHaveBeenCalled();
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(cookieJar.delete).not.toHaveBeenCalled();
    }
  );

  it.each(['short', 'fynfo_vault_no'])(
    'rejects a decrypted wrong canary without reinitializing or setting a cookie',
    async (plaintext) => {
      expect(plaintext.length === VAULT_CANARY.length).toBe(
        plaintext === 'fynfo_vault_no'
      );
      profileRow = {
        vault_check_v2: encryptPayload(plaintext, DEK),
        vault_version: 2,
      };
      const POST = await freshPost();
      const response = await POST(
        makeRequest({ derivedKey: DEK.toString('base64') })
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Incorrect PIN' });
      expect(securityRpc).toHaveBeenCalledWith('finish_vault_unlock', {
        p_user_id: USER_ID,
        p_attempt_id: ATTEMPT_ID,
        p_success: false,
      });
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(cookieJar.delete).not.toHaveBeenCalled();
    }
  );

  it.each(['correct', 'incorrect'] as const)(
    'fails closed when finalization fails after a %s canary',
    async (mode) => {
      profileRow = {
        vault_check_v2: encryptPayload(
          mode === 'correct' ? VAULT_CANARY : 'fynfo_vault_no',
          DEK
        ),
        vault_version: 2,
      };
      rpcRecord = { data: null, error: { code: 'private-finalization-error' } };
      const POST = await freshPost();
      const response = await POST(
        makeRequest({ derivedKey: DEK.toString('base64') })
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal Server Error' });
      expect(securityRpc).toHaveBeenCalledWith('finish_vault_unlock', {
        p_user_id: USER_ID,
        p_attempt_id: ATTEMPT_ID,
        p_success: mode === 'correct',
      });
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(cookieJar.set).not.toHaveBeenCalled();
      expect(cookieJar.delete).not.toHaveBeenCalled();
    }
  );
});
