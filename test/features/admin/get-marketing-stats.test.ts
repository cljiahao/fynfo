import { getMarketingStats } from '@/features/admin/lib/get-marketing-stats';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => boundary,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: boundary.rpc }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: boundary.error } }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('fixture 404');
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ADMIN_EMAILS', 'owner@example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'fixture-secret-key');
  Object.assign(boundary, { auth: { getUser: boundary.getUser } });
  boundary.getUser.mockResolvedValue({
    data: { user: { email: 'owner@example.test' } },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('admin aggregate authorization', () => {
  it.each([null, { email: 'visitor@example.test' }, { email: undefined }])(
    'hides the route from unauthorized users %#',
    async (user) => {
      boundary.getUser.mockResolvedValue({ data: { user } });
      await expect(getMarketingStats()).rejects.toThrow('fixture 404');
      expect(boundary.rpc).not.toHaveBeenCalled();
    }
  );

  it('fails closed with an empty allowlist', async () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    await expect(getMarketingStats()).rejects.toThrow('fixture 404');
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it('sums event counts, sorts days and separates signups', async () => {
    boundary.rpc.mockImplementation(async (name) => ({
      data:
        name === 'get_signup_stats'
          ? [
              { day: '2026-01-01', signups: '2' },
              { day: '2026-01-02', signups: 3 },
            ]
          : [
              { day: '2026-01-02', event_type: 'page_view', events: '20' },
              { day: '2026-01-01', event_type: 'cta_click', events: 2 },
              { day: '2026-01-01', event_type: 'page_view', events: 10 },
              { day: '2026-01-02', event_type: 'cta_click', events: 1 },
              { day: '2026-01-02', event_type: 'future_event', events: 999 },
            ],
      error: null,
    }));
    expect(await getMarketingStats()).toEqual({
      totals: { pageViews: 30, ctaClicks: 3, clickRate: 0.1, signups: 5 },
      daily: [
        { day: '2026-01-01', pageViews: 10, ctaClicks: 2 },
        { day: '2026-01-02', pageViews: 20, ctaClicks: 1 },
      ],
    });
  });

  it('returns zeros when aggregate rows are absent', async () => {
    boundary.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getMarketingStats()).toEqual({
      totals: { pageViews: 0, ctaClicks: 0, clickRate: 0, signups: 0 },
      daily: [],
    });
  });

  it.each(['get_signup_stats', 'get_marketing_event_stats'])(
    'reports opaque failure for %s',
    async (failed) => {
      boundary.rpc.mockImplementation(async (name) => ({
        data: [],
        error:
          name === failed
            ? { code: 'XX000', message: 'private database detail' }
            : null,
      }));
      await expect(getMarketingStats()).rejects.toThrow(
        'Failed to load telemetry'
      );
      expect(JSON.stringify(boundary.error.mock.calls)).not.toContain(
        'private database detail'
      );
    }
  );
});
