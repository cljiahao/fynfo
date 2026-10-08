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
  getUser.mockResolvedValue({ data: { user: null } });
  createClient.mockReturnValue({ auth: { getUser } });
});

describe('proxy boundaries', () => {
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
