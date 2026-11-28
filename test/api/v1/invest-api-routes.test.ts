import { GET as getMeta } from '@/app/api/v1/journal/meta/route';
import { GET as getPublicKey } from '@/app/api/v1/journal/public-key/route';
import { POST as postJournal } from '@/app/api/v1/journal/route';
import { GET as getSummary } from '@/app/api/v1/summary/route';
import { buildCanonicalString } from '@/lib/api-v1/request-signature';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => ({
  authenticateKey: vi.fn(),
  consumeNonce: vi.fn(),
  getSealedSummary: vi.fn(),
  getJournalPublicKey: vi.fn(),
  appendJournal: vi.fn(),
  listJournalMeta: vi.fn(),
  writeAudit: vi.fn(),
  pruneInvestApi: vi.fn(),
  consumeRateLimit: vi.fn(),
}));
vi.mock('@/integrations/services/invest-api-rpc', () => ({
  authenticateKey: rpc.authenticateKey,
  consumeNonce: rpc.consumeNonce,
  getSealedSummary: rpc.getSealedSummary,
  getJournalPublicKey: rpc.getJournalPublicKey,
  appendJournal: rpc.appendJournal,
  listJournalMeta: rpc.listJournalMeta,
  writeAudit: rpc.writeAudit,
  pruneInvestApi: rpc.pruneInvestApi,
}));
vi.mock('@/integrations/services/security-rpc', () => ({
  consumeRateLimit: rpc.consumeRateLimit,
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    void task();
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const KEY_ID = '5b0f6c1e-3f55-4c5f-8f4e-2f0c8d7b9a11';
const CALLER_ID = '0a1b2c3d-1111-4222-8333-444455556666';
const USER_ID = '99999999-1111-4222-8333-444455556666';
const ROW_ID = 'aaaaaaaa-1111-4222-8333-444455556666';
const BASE = 'https://fynfo.example';

const pair = crypto.generateKeyPairSync('ed25519');
const publicRaw = Buffer.from(
  pair.publicKey.export({ format: 'jwk' }).x ?? '',
  'base64url'
).toString('base64');

type Scope =
  | 'summary:read'
  | 'journal:meta'
  | 'journal:append:plan'
  | 'journal:append:sell_flag'
  | 'journal:append:verdict';

function authed(scopes: Scope[]) {
  return {
    callerId: CALLER_ID,
    userId: USER_ID,
    callerName: 'ballast',
    publicKey: publicRaw,
    scopes,
  };
}

type Overrides = {
  keyId?: string;
  timestamp?: string;
  tamperSignature?: boolean;
  headers?: Record<string, string | null>;
  rawBody?: string;
  signedBody?: string;
};

function signed(
  method: string,
  pathWithQuery: string,
  body: string,
  o: Overrides = {}
): Request {
  const timestamp = o.timestamp ?? String(Math.floor(Date.now() / 1000));
  const keyId = o.keyId ?? KEY_ID;
  const canonical = buildCanonicalString({
    keyId: KEY_ID,
    timestamp,
    method,
    pathWithQuery,
    body: o.signedBody ?? body,
  });
  let signature = crypto
    .sign(null, Buffer.from(canonical), pair.privateKey)
    .toString('base64');
  if (o.tamperSignature) {
    const bytes = Buffer.from(signature, 'base64');
    bytes[0] ^= 1;
    signature = bytes.toString('base64');
  }
  const headers: Record<string, string> = {
    Authorization: `Fynfo-Ed25519 keyId=${keyId}`,
    'X-Fynfo-Timestamp': timestamp,
    'X-Fynfo-Signature': signature,
    'Content-Type': 'application/json',
  };
  for (const [name, value] of Object.entries(o.headers ?? {})) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  return new Request(`${BASE}${pathWithQuery}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : (o.rawBody ?? body),
  });
}

const APPEND_BODY = JSON.stringify({
  event_type: 'plan',
  occurred_at: '2026-11-27T10:00:00Z',
  sealed: 'c2VhbGVk',
});

beforeEach(() => {
  vi.resetAllMocks();
  rpc.authenticateKey.mockResolvedValue(authed(['summary:read']));
  rpc.consumeNonce.mockResolvedValue(true);
  rpc.consumeRateLimit.mockResolvedValue(true);
  rpc.writeAudit.mockResolvedValue(undefined);
  rpc.pruneInvestApi.mockResolvedValue(undefined);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/summary', () => {
  it('returns the sealed summary with no-store caching and audits without a body', async () => {
    rpc.getSealedSummary.mockResolvedValue({
      sealed: 'abc',
      publishedAt: '2026-11-27T00:00:00Z',
    });
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      sealed: 'abc',
      published_at: '2026-11-27T00:00:00Z',
    });
    expect(rpc.getSealedSummary).toHaveBeenCalledWith(CALLER_ID);
    expect(rpc.writeAudit).toHaveBeenCalledWith(
      CALLER_ID,
      KEY_ID,
      'GET /api/v1/summary',
      200
    );
    expect(rpc.writeAudit.mock.calls[0]).toHaveLength(4);
  });

  it('returns 404 when nothing is published', async () => {
    rpc.getSealedSummary.mockResolvedValue(null);
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(404);
  });

  it('needs no session cookie', async () => {
    rpc.getSealedSummary.mockResolvedValue({ sealed: 's', publishedAt: 'p' });
    const request = signed('GET', '/api/v1/summary', '');
    expect(request.headers.get('cookie')).toBeNull();
    expect((await getSummary(request)).status).toBe(200);
  });
});

describe('authentication failures', () => {
  async function bodyOf(response: Response): Promise<string> {
    return response.text();
  }

  it('returns an identical 401 for every failure mode', async () => {
    const responses: Response[] = [];
    // malformed headers
    responses.push(
      await getSummary(
        signed('GET', '/api/v1/summary', '', {
          headers: { Authorization: 'Bearer nope' },
        })
      )
    );
    responses.push(
      await getSummary(
        signed('GET', '/api/v1/summary', '', {
          headers: { 'X-Fynfo-Signature': null },
        })
      )
    );
    // unknown / revoked / expired key
    rpc.authenticateKey.mockResolvedValueOnce(null);
    responses.push(await getSummary(signed('GET', '/api/v1/summary', '')));
    // stale timestamp
    responses.push(
      await getSummary(
        signed('GET', '/api/v1/summary', '', {
          timestamp: String(Math.floor(Date.now() / 1000) - 3600),
        })
      )
    );
    // bad signature
    responses.push(
      await getSummary(
        signed('GET', '/api/v1/summary', '', { tamperSignature: true })
      )
    );
    // signature over a different path
    responses.push(
      await getSummary(
        new Request(`${BASE}/api/v1/summary`, {
          headers: signed('GET', '/api/v1/summary?x=1', '').headers,
        })
      )
    );
    // replay
    rpc.consumeNonce.mockResolvedValueOnce(false);
    responses.push(await getSummary(signed('GET', '/api/v1/summary', '')));

    const bodies = await Promise.all(responses.map(bodyOf));
    for (const response of responses) expect(response.status).toBe(401);
    expect(new Set(bodies)).toEqual(new Set(['{"error":"unauthorized"}']));
    expect(rpc.getSealedSummary).not.toHaveBeenCalled();
  });

  it('rejects a replayed signature', async () => {
    rpc.getSealedSummary.mockResolvedValue({ sealed: 's', publishedAt: 'p' });
    const request = signed('GET', '/api/v1/summary', '');
    expect((await getSummary(request.clone())).status).toBe(200);
    rpc.consumeNonce.mockResolvedValue(false);
    expect((await getSummary(request.clone())).status).toBe(401);
  });

  it('rejects a body that differs from the signed body', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:append:plan']));
    const response = await postJournal(
      signed('POST', '/api/v1/journal', APPEND_BODY, {
        signedBody: '{}',
      })
    );
    expect(response.status).toBe(401);
    expect(rpc.appendJournal).not.toHaveBeenCalled();
  });

  it('audits failures with no caller for an unknown key', async () => {
    rpc.authenticateKey.mockResolvedValueOnce(null);
    await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(rpc.writeAudit).toHaveBeenCalledWith(
      null,
      expect.any(String),
      'GET /api/v1/summary',
      401
    );
  });

  it('writes no audit row when the headers are malformed', async () => {
    const response = await getSummary(
      signed('GET', '/api/v1/summary', '', {
        headers: { Authorization: 'Bearer nope' },
      })
    );
    expect(response.status).toBe(401);
    expect(rpc.writeAudit).not.toHaveBeenCalled();
  });
});

describe('scope enforcement', () => {
  it('returns 403 for a missing scope', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:meta']));
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(403);
    expect(rpc.getSealedSummary).not.toHaveBeenCalled();
    expect(rpc.writeAudit).toHaveBeenCalledWith(
      CALLER_ID,
      KEY_ID,
      'GET /api/v1/summary',
      403
    );
  });

  it('returns 403 on public-key without any append scope', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['summary:read']));
    const response = await getPublicKey(
      signed('GET', '/api/v1/journal/public-key', '')
    );
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/journal/public-key', () => {
  it.each([
    'journal:append:plan',
    'journal:append:sell_flag',
    'journal:append:verdict',
  ] as const)('succeeds with %s', async (scope) => {
    rpc.authenticateKey.mockResolvedValue(authed([scope]));
    rpc.getJournalPublicKey.mockResolvedValue('pubkey');
    const response = await getPublicKey(
      signed('GET', '/api/v1/journal/public-key', '')
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ v: 1, public_key: 'pubkey' });
  });
});

describe('POST /api/v1/journal', () => {
  it.each([
    ['plan', 'journal:append:plan'],
    ['sell_flag', 'journal:append:sell_flag'],
    ['verdict', 'journal:append:verdict'],
  ] as const)('appends a %s event with its scope', async (type, scope) => {
    rpc.authenticateKey.mockResolvedValue(authed([scope]));
    rpc.appendJournal.mockResolvedValue(ROW_ID);
    const body = JSON.stringify({
      event_type: type,
      occurred_at: '2026-11-27T10:00:00Z',
      sealed: 'c2VhbGVk',
    });
    const response = await postJournal(signed('POST', '/api/v1/journal', body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ROW_ID });
    expect(rpc.appendJournal).toHaveBeenCalledWith(
      CALLER_ID,
      type,
      new Date('2026-11-27T10:00:00Z'),
      'c2VhbGVk'
    );
    expect(JSON.stringify(rpc.writeAudit.mock.calls)).not.toContain('c2VhbGVk');
  });

  it('returns 403 when event_type does not match a held append scope', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:append:sell_flag']));
    const response = await postJournal(
      signed('POST', '/api/v1/journal', APPEND_BODY)
    );
    expect(response.status).toBe(403);
    expect(rpc.appendJournal).not.toHaveBeenCalled();
  });

  it('returns 403 without any append scope', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['summary:read']));
    const response = await postJournal(
      signed('POST', '/api/v1/journal', APPEND_BODY)
    );
    expect(response.status).toBe(403);
  });

  it.each([
    ['not json', 'nope'],
    [
      'unknown event type',
      '{"event_type":"x","occurred_at":"2026-11-27T10:00:00Z","sealed":"abc"}',
    ],
    [
      'bad timestamp',
      '{"event_type":"plan","occurred_at":"yesterday","sealed":"abc"}',
    ],
    [
      'non base64url sealed',
      '{"event_type":"plan","occurred_at":"2026-11-27T10:00:00Z","sealed":"a b"}',
    ],
  ])('returns 400 for %s without leaking internals', async (_name, body) => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:append:plan']));
    const response = await postJournal(signed('POST', '/api/v1/journal', body));
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('invalid_request');
    expect(text).not.toMatch(/postgres|sql|stack/i);
    expect(rpc.appendJournal).not.toHaveBeenCalled();
  });

  it('returns 413 for a declared oversized body before authenticating', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(17 * 1024) });
    const response = await postJournal(signed('POST', '/api/v1/journal', big));
    expect(response.status).toBe(413);
    expect(rpc.authenticateKey).not.toHaveBeenCalled();
  });

  it('returns 413 for an oversized streamed body with no content-length', async () => {
    const big = 'x'.repeat(17 * 1024);
    const encoder = new TextEncoder();
    const request = new Request(`${BASE}/api/v1/journal`, {
      method: 'POST',
      headers: { Authorization: 'x' },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(big));
          controller.close();
        },
      }),
      // @ts-expect-error duplex is required for streamed request bodies in Node
      duplex: 'half',
    });
    expect((await postJournal(request)).status).toBe(413);
  });
});

describe('GET /api/v1/journal/meta', () => {
  const rows = [
    {
      id: ROW_ID,
      caller: 'ballast',
      event_type: 'plan',
      created_at: '2026-11-27T10:00:00.123456+00:00',
    },
  ];

  it('lists metadata from the start and returns the next cursor', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:meta']));
    rpc.listJournalMeta.mockResolvedValue(rows);
    const response = await getMeta(signed('GET', '/api/v1/journal/meta', ''));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(rows);
    expect(rpc.listJournalMeta).toHaveBeenCalledWith(USER_ID, null);
    expect(response.headers.get('x-next-since')).toBe(rows[0].created_at);
    expect(response.headers.get('x-next-since-id')).toBe(ROW_ID);
  });

  it('pages from a cursor and omits the next cursor on an empty page', async () => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:meta']));
    rpc.listJournalMeta.mockResolvedValue([]);
    const query = `?since=${encodeURIComponent(rows[0].created_at)}&since_id=${ROW_ID}`;
    const response = await getMeta(
      signed('GET', `/api/v1/journal/meta${query}`, '')
    );
    expect(response.status).toBe(200);
    expect(rpc.listJournalMeta).toHaveBeenCalledWith(USER_ID, {
      createdAt: rows[0].created_at,
      id: ROW_ID,
    });
    expect(response.headers.get('x-next-since')).toBeNull();
  });

  it.each([
    '?since=2026-11-27T10:00:00Z',
    `?since_id=${ROW_ID}`,
    `?since=garbage&since_id=${ROW_ID}`,
  ])('returns 400 for the invalid cursor %s', async (query) => {
    rpc.authenticateKey.mockResolvedValue(authed(['journal:meta']));
    const response = await getMeta(
      signed('GET', `/api/v1/journal/meta${query}`, '')
    );
    expect(response.status).toBe(400);
    expect(rpc.listJournalMeta).not.toHaveBeenCalled();
  });
});

describe('limits, audit and pruning', () => {
  it('returns 429 with Retry-After when the per-key limiter denies', async () => {
    rpc.consumeRateLimit.mockResolvedValue(false);
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(rpc.consumeRateLimit).toHaveBeenCalledWith(
      `invest-api:${KEY_ID}`,
      expect.any(Number),
      expect.any(Number)
    );
    expect(rpc.getSealedSummary).not.toHaveBeenCalled();
  });

  it('does not change the response when the audit write fails', async () => {
    rpc.getSealedSummary.mockResolvedValue({ sealed: 's', publishedAt: 'p' });
    rpc.writeAudit.mockRejectedValue(new Error('db down'));
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(200);
  });

  it('returns an opaque 503 when a backing call fails', async () => {
    rpc.getSealedSummary.mockRejectedValue(
      new Error('relation x does not exist')
    );
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"unavailable"}');
  });

  it('prunes opportunistically and swallows prune errors', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    rpc.pruneInvestApi.mockRejectedValue(new Error('boom'));
    rpc.getSealedSummary.mockResolvedValue({ sealed: 's', publishedAt: 'p' });
    const response = await getSummary(signed('GET', '/api/v1/summary', ''));
    expect(response.status).toBe(200);
    expect(rpc.pruneInvestApi).toHaveBeenCalledTimes(1);
  });
});

describe('method restrictions', () => {
  it('exports only the documented methods', async () => {
    const modules = await Promise.all([
      import('@/app/api/v1/summary/route'),
      import('@/app/api/v1/journal/public-key/route'),
      import('@/app/api/v1/journal/route'),
      import('@/app/api/v1/journal/meta/route'),
    ]);
    const methods = modules.map((m) =>
      Object.keys(m).filter((k) => /^[A-Z]+$/.test(k))
    );
    expect(methods).toEqual([['GET'], ['GET'], ['POST'], ['GET']]);
  });
});
