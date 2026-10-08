import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: exchange },
  }),
}));

import { GET } from '@/app/auth/callback/route';

beforeEach(() => exchange.mockResolvedValue({ error: null }));

describe('auth callback redirects', () => {
  it.each([
    '@evil.example',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    '/\n/evil.example',
    '/\u007f/evil.example',
  ])(
    'rejects external redirect target %s after code exchange',
    async (next) => {
      const url = new URL('https://fynfo.example/auth/callback');
      url.searchParams.set('code', 'fixture-code');
      url.searchParams.set('next', next);
      const response = await GET(new NextRequest(url));
      expect(response.headers.get('location')).toBe(
        'https://fynfo.example/dashboard'
      );
    }
  );

  it('preserves a local destination and its query', async () => {
    const response = await GET(
      new NextRequest(
        'https://fynfo.example/auth/callback?code=fixture-code&next=%2Fdashboard%2Fassets%3Ftab%3Dsummary'
      )
    );
    expect(response.headers.get('location')).toBe(
      'https://fynfo.example/dashboard/assets?tab=summary'
    );
  });

  it('returns to login when code exchange fails', async () => {
    exchange.mockResolvedValue({ error: { message: 'fixture failure' } });
    const response = await GET(
      new NextRequest('https://fynfo.example/auth/callback?code=fixture-code')
    );
    expect(response.headers.get('location')).toBe(
      'https://fynfo.example/login?error=auth_callback_failed'
    );
  });

  it('returns to login without exchanging a missing code', async () => {
    exchange.mockClear();
    const response = await GET(
      new NextRequest('https://fynfo.example/auth/callback')
    );
    expect(response.headers.get('location')).toBe(
      'https://fynfo.example/login?error=auth_callback_failed'
    );
    expect(exchange).not.toHaveBeenCalled();
  });
});
