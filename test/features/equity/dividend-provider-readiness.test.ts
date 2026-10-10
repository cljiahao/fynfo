import { fetchDividends } from '@/features/equity/actions/price-actions';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth-guard', () => ({
  requireUserId: vi.fn(async () => 'synthetic-user'),
}));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
it.each(['http', 'json', 'schema', 'network'])(
  'fails opaque rather than returning a verified empty feed: %s',
  async (kind) => {
    if (kind === 'http')
      fetchMock.mockResolvedValue({ ok: false, status: 503 });
    if (kind === 'json')
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('private parser detail');
        },
      });
    if (kind === 'schema')
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ chart: { result: null } }),
      });
    if (kind === 'network')
      fetchMock.mockRejectedValue(new Error('private network detail'));
    await expect(fetchDividends('DBS')).rejects.toMatchObject({
      code: 'EXTERNAL_API',
      message: 'Dividend data unavailable',
    });
  }
);
it('retains successful empty-array contract', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ chart: { result: [{ events: {} }] } }),
  });
  expect(await fetchDividends('DBS')).toEqual([]);
});
