import { proxy } from '@/proxy';
import type { CookieOptions } from '@supabase/ssr';
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
  getUser.mockResolvedValue({ data: { user: null } });
  createClient.mockReturnValue({ auth: { getUser } });
});

describe('proxy boundaries', () => {
  it.each([
    ['/login', { id: 'fixture-user' }, 307, 'https://fynfo.example/dashboard'],
    ['/dashboard/assets', null, 307, 'https://fynfo.example/login'],
    ['/api/vault', null, 401, null],
  ])(
    'preserves refreshed cookies for %s',
    async (path, user, status, location) => {
      createClient.mockImplementation(
        (
          _url,
          _key,
          options: {
            cookies: {
              setAll: (
                cookies: {
                  name: string;
                  value: string;
                  options: CookieOptions;
                }[]
              ) => void;
            };
          }
        ) => ({
          auth: {
            getUser: async () => {
              options.cookies.setAll([
                {
                  name: 'fixture-session',
                  value: 'refreshed',
                  options: {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 120,
                  },
                },
              ]);
              return { data: { user }, error: null };
            },
          },
        })
      );
      const response = await proxy(
        new NextRequest(`https://fynfo.example${path}`)
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('location')).toBe(location);
      expect(response.headers.get('set-cookie')).toContain(
        'fixture-session=refreshed'
      );
      expect(response.headers.get('set-cookie')).toContain('HttpOnly');
      expect(response.headers.get('set-cookie')).toContain('Secure');
      expect(response.headers.get('set-cookie')).toContain('Max-Age=120');
    }
  );

  it('does not accept a user returned alongside an authentication error', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'fixture-user' } },
      error: { message: 'fixture auth failure' },
    });
    const response = await proxy(
      new NextRequest('https://fynfo.example/dashboard/assets')
    );
    expect(response.headers.get('location')).toBe(
      'https://fynfo.example/login'
    );
  });
  it('allows key-cookie teardown without an authentication dependency', async () => {
    const response = await proxy(
      new NextRequest('https://fynfo.example/api/vault/lock', {
        method: 'POST',
      })
    );
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createClient).not.toHaveBeenCalled();
    const other = await proxy(
      new NextRequest('https://fynfo.example/api/vault/lock-private', {
        method: 'POST',
      })
    );
    expect(other.status).toBe(401);
  });
  it('allows anonymous telemetry without an authentication round-trip', async () => {
    const response = await proxy(
      new NextRequest('https://fynfo.example/api/track', { method: 'POST' })
    );
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('allows health checks without depending on Supabase', async () => {
    await proxy(new NextRequest('https://fynfo.example/api/health'));
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not extend public access to similarly prefixed endpoints', async () => {
    const response = await proxy(
      new NextRequest('https://fynfo.example/api/health-private')
    );
    expect(response.status).toBe(401);
  });

  it('does not skip API authentication for a forged action header', async () => {
    const response = await proxy(
      new NextRequest('https://fynfo.example/api/vault', {
        method: 'POST',
        headers: { 'next-action': 'fixture' },
      })
    );
    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledOnce();
  });

  it('redirects anonymous dashboard navigation to login', async () => {
    const response = await proxy(
      new NextRequest('https://fynfo.example/dashboard')
    );
    expect(response.headers.get('location')).toBe(
      'https://fynfo.example/login'
    );
  });
});
