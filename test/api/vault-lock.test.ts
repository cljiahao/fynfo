import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon';

const USER_ID = '11111111-1111-1111-1111-111111111111';

interface CookieJar {
  set: ReturnType<typeof vi.fn>;
  get: (name: string) => { value: string } | undefined;
}

let cookieJar: CookieJar;
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
  }),
}));

async function freshPost() {
  vi.resetModules();
  const mod = await import('@/app/api/vault/lock/route');
  return mod.POST;
}

function makeRequest(): Request {
  return new Request('http://localhost/api/vault/lock', { method: 'POST' });
}

describe('POST /api/vault/lock', () => {
  beforeEach(() => {
    cookieJar = { set: vi.fn(), get: () => undefined };
    getUserResult = {
      data: { user: { id: USER_ID, email: 'user@test' } },
      error: null,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clears the DEK cookie (maxAge 0) and returns success when authed', async () => {
    const POST = await freshPost();

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(cookieJar.set).toHaveBeenCalledWith(
      'fynfo_vault_dek',
      '',
      expect.objectContaining({ maxAge: 0, httpOnly: true, path: '/' })
    );
  });

  it('returns 401 and does not touch the cookie when unauthenticated', async () => {
    getUserResult = { data: { user: null }, error: { message: 'no session' } };
    const POST = await freshPost();

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });
});
