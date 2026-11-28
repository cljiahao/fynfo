import { proxy } from '@/proxy';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, createClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock('@/lib/constants/env', () => ({
  getSupabaseEnv: () => ({ url: 'https://fixture.example', key: 'fixture' }),
}));
vi.mock('@supabase/ssr', () => ({ createServerClient: createClient }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  createClient.mockReturnValue({ auth: { getUser } });
});

describe('proxy and /api/v1', () => {
  it.each([
    '/api/v1/summary',
    '/api/v1/journal',
    '/api/v1/journal/meta',
    '/api/v1/journal/public-key',
  ])(
    'passes %s through without a session check, redirect or cookie',
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://fynfo.example${path}`)
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    }
  );

  it('still requires a session for other api routes', async () => {
    const response = await proxy(
      new NextRequest('https://fynfo.example/api/vault')
    );
    expect(response.status).toBe(401);
  });
});
