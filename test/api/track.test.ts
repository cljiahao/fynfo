import { POST } from '@/app/api/track/route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  insert: vi.fn(),
  create: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: boundary.create,
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: boundary.warn, error: boundary.error, info: boundary.info },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'fixture-secret-key');
  boundary.create.mockReturnValue({ rpc: boundary.insert });
  boundary.insert.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
const request = (body: string) =>
  new Request('http://localhost/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

describe('anonymous telemetry boundary', () => {
  it.each([
    '/?email=private@example.test',
    '/#private@example.test',
    '/dashboard/private@example.test',
    'https://private@example.test',
    '/\\private@example.test',
    '/\nprivate@example.test',
  ])(
    'rejects private path %s without persistence or reflection',
    async (path) => {
      const response = await POST(
        request(JSON.stringify({ eventType: 'page_view', path }))
      );
      expect(response.status).toBe(400);
      expect(boundary.create).not.toHaveBeenCalled();
      expect(boundary.insert).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain('private@example.test');
    }
  );

  it.each([
    '{',
    '{}',
    '{"eventType":"unknown","path":"/"}',
    '{"eventType":"page_view","path":""}',
  ])('rejects invalid payload %s before database access', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid request');
    expect(boundary.create).not.toHaveBeenCalled();
  });

  it('returns 429 without persisting once the per-client budget is spent', async () => {
    boundary.insert.mockImplementation(async (name: string) =>
      name === 'consume_rate_limit'
        ? { data: false, error: null }
        : { error: null }
    );
    const response = await POST(
      new Request('http://localhost/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.9, 10.0.0.1',
        },
        body: '{"eventType":"page_view","path":"/"}',
      })
    );
    expect(response.status).toBe(429);
    expect(boundary.insert).toHaveBeenCalledTimes(1);
    const [name, params] = boundary.insert.mock.calls[0];
    expect(name).toBe('consume_rate_limit');
    expect(params.p_key).toMatch(/^track:[0-9a-f]{32}$/);
    expect(JSON.stringify(params)).not.toContain('203.0.113.9');
  });

  it('fails open when the limiter errors', async () => {
    boundary.insert.mockImplementation(async (name: string) =>
      name === 'consume_rate_limit'
        ? { data: null, error: { message: 'down' } }
        : { error: null }
    );
    const response = await POST(
      request('{"eventType":"page_view","path":"/"}')
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('persists only event type and path, omitting supplied identity', async () => {
    const response = await POST(
      request(
        JSON.stringify({
          eventType: 'cta_click',
          path: '/',
          userId: 'untrusted',
          salary: 9000,
        })
      )
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(boundary.insert).toHaveBeenCalledWith('record_marketing_event', {
      p_event_type: 'cta_click',
      p_path: '/',
    });
  });

  it('contains database failures without exposing details', async () => {
    boundary.insert.mockResolvedValue({
      error: { code: 'XX000', message: 'private database detail' },
    });
    const response = await POST(
      request('{"eventType":"page_view","path":"/"}')
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: false });
    expect(JSON.stringify(boundary.warn.mock.calls)).not.toContain(
      'private database detail'
    );
  });

  it('keeps unavailable telemetry best-effort without exposing details', async () => {
    boundary.create.mockImplementation(() => {
      throw new Error('private service detail');
    });
    const response = await POST(
      request('{"eventType":"page_view","path":"/"}')
    );
    expect(response.status).toBe(202);
    expect(await response.text()).not.toContain('private service detail');
  });
});
