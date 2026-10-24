import { rejectUnsafeRequest } from '@/lib/request-guard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  createClient: vi.fn(),
  recordEvent: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: boundary.createClient,
}));
vi.mock('@/integrations/services/security-rpc', () => ({
  recordMarketingEvent: boundary.recordEvent,
  reserveVaultUnlock: vi.fn(),
  finishVaultUnlock: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: boundary.cookies }));

const URL_ = 'https://fynfo.test/api/vault';
const JSON_HEADERS = { 'content-type': 'application/json' };

function req(
  headers: Record<string, string> = {},
  init: RequestInit = { method: 'POST', body: '{}' },
  url = URL_
) {
  return new Request(url, { ...init, headers });
}

beforeEach(() => vi.clearAllMocks());

describe('rejectUnsafeRequest', () => {
  it('accepts same-origin Fetch Metadata and matching Origin', () => {
    expect(
      rejectUnsafeRequest(
        req({ ...JSON_HEADERS, 'sec-fetch-site': 'same-origin' }),
        { json: true }
      )
    ).toBeNull();
    expect(
      rejectUnsafeRequest(
        req({ ...JSON_HEADERS, origin: 'https://fynfo.test' }),
        { json: true }
      )
    ).toBeNull();
  });

  it('accepts requests with no browser headers (non-browser clients)', () => {
    expect(rejectUnsafeRequest(req(JSON_HEADERS), { json: true })).toBeNull();
  });

  it.each(['cross-site', 'same-site'])(
    'rejects Sec-Fetch-Site: %s with 403',
    (site) => {
      const res = rejectUnsafeRequest(
        req({ ...JSON_HEADERS, 'sec-fetch-site': site })
      );
      expect(res?.status).toBe(403);
    }
  );

  it('rejects a mismatched or malformed Origin when Fetch Metadata is absent', () => {
    expect(
      rejectUnsafeRequest(req({ origin: 'https://evil.test' }))?.status
    ).toBe(403);
    expect(rejectUnsafeRequest(req({ origin: 'null' }))?.status).toBe(403);
  });

  it('prefers Fetch Metadata over a matching Origin', () => {
    expect(
      rejectUnsafeRequest(
        req({ origin: 'https://fynfo.test', 'sec-fetch-site': 'cross-site' })
      )?.status
    ).toBe(403);
  });

  it('requires an application/json content type when asked', () => {
    for (const type of ['text/plain', 'application/jsonp', '']) {
      const headers: Record<string, string> = type
        ? { 'content-type': type }
        : {};
      expect(rejectUnsafeRequest(req(headers), { json: true })?.status).toBe(
        415
      );
    }
    expect(
      rejectUnsafeRequest(
        req({ 'content-type': 'application/json; charset=utf-8' }),
        { json: true }
      )
    ).toBeNull();
  });

  it('does not require a content type on DELETE', () => {
    expect(
      rejectUnsafeRequest(req({}, { method: 'DELETE' }), { json: true })
    ).toBeNull();
  });

  it('rejects a declared body above the limit with 413', () => {
    const res = rejectUnsafeRequest(
      req({ ...JSON_HEADERS, 'content-length': '5000' }),
      { json: true, maxBodyBytes: 1024 }
    );
    expect(res?.status).toBe(413);
  });
});

describe('/api/track boundary', () => {
  const post = async (headers: Record<string, string>, body: string) => {
    const { POST } = await import('@/app/api/track/route');
    return POST(
      new Request('https://fynfo.test/api/track', {
        method: 'POST',
        headers,
        body,
      })
    );
  };
  const event = JSON.stringify({ eventType: 'page_view', path: '/' });

  it('accepts a same-origin JSON beacon', async () => {
    boundary.recordEvent.mockResolvedValue(undefined);
    const res = await post(
      { ...JSON_HEADERS, 'sec-fetch-site': 'same-origin' },
      event
    );
    expect(res.status).toBe(202);
    expect(boundary.recordEvent).toHaveBeenCalledOnce();
  });

  it.each([
    ['cross-site', { ...JSON_HEADERS, 'sec-fetch-site': 'cross-site' }, 403],
    ['text/plain', { 'content-type': 'text/plain' }, 415],
    ['oversized declared', { ...JSON_HEADERS, 'content-length': '99999' }, 413],
  ])('rejects %s before recording', async (_label, headers, status) => {
    const res = await post(headers, event);
    expect(res.status).toBe(status);
    expect(boundary.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects an oversized body that under-declares its length', async () => {
    const padded = JSON.stringify({
      eventType: 'page_view',
      path: '/',
      pad: 'x'.repeat(2000),
    });
    const res = await post(JSON_HEADERS, padded);
    expect(res.status).toBe(400);
    expect(boundary.recordEvent).not.toHaveBeenCalled();
  });
});

describe('/api/vault boundary', () => {
  const call = async (method: 'POST' | 'DELETE', headers: HeadersInit) => {
    const route = await import('@/app/api/vault/route');
    return route[method](
      new Request(URL_, {
        method,
        headers,
        body: method === 'POST' ? '{}' : null,
      })
    );
  };

  it.each([
    ['POST', { ...JSON_HEADERS, 'sec-fetch-site': 'cross-site' }, 403],
    ['DELETE', { 'sec-fetch-site': 'cross-site' }, 403],
    ['POST', { 'content-type': 'text/plain' }, 415],
    ['POST', { ...JSON_HEADERS, origin: 'https://evil.test' }, 403],
  ] as const)(
    '%s %j is rejected with %i before any session or cookie work',
    async (method, headers, status) => {
      const res = await call(method, headers);
      expect(res.status).toBe(status);
      expect(boundary.createClient).not.toHaveBeenCalled();
      expect(boundary.cookies).not.toHaveBeenCalled();
    }
  );

  it('lets a same-origin JSON POST reach authentication', async () => {
    boundary.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    });
    const res = await call('POST', {
      ...JSON_HEADERS,
      'sec-fetch-site': 'same-origin',
    });
    expect(boundary.createClient).toHaveBeenCalled();
    expect(res.status).toBe(400);
  });
});
