import { requireAdmin } from '@/features/admin/lib/require-admin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: boundary.getUser },
  }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('fixture 404');
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ADMIN_EMAILS', 'owner@example.test');
  boundary.getUser.mockResolvedValue({
    data: { user: { email: 'owner@example.test' } },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('requireAdmin', () => {
  it('passes for an admin email', async () => {
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it.each([null, { email: 'visitor@example.test' }, { email: undefined }])(
    '404s for no user or a non-admin %#',
    async (user) => {
      boundary.getUser.mockResolvedValue({ data: { user } });
      await expect(requireAdmin()).rejects.toThrow('fixture 404');
    }
  );

  it('404s on an auth error', async () => {
    boundary.getUser.mockResolvedValue({
      data: { user: { email: 'owner@example.test' } },
      error: new Error('auth failed'),
    });
    await expect(requireAdmin()).rejects.toThrow('fixture 404');
  });

  it('fails closed when ADMIN_EMAILS is unset', async () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    await expect(requireAdmin()).rejects.toThrow('fixture 404');
  });
});
