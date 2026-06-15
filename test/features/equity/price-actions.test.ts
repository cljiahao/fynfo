import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireUserId = vi.fn(async () => 'user-1');
vi.mock('@/lib/auth-guard', () => ({
  requireUserId: () => requireUserId(),
}));

function chartResponse(meta: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({ chart: { result: [{ meta }] } }),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  requireUserId.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('price-actions — fetchStockPrices', () => {
  it('requires auth before any fetch', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 1 }));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    await fetchStockPrices(['AAPL']);
    expect(requireUserId).toHaveBeenCalledOnce();
  });

  it('parses price, change, and percent and keys by internal ticker', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({
        regularMarketPrice: 110,
        previousClose: 100,
        currency: 'USD',
      })
    );
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchStockPrices(['AAPL']);
    expect(out.AAPL).toEqual({
      ticker: 'AAPL',
      symbol: 'AAPL',
      price: 110,
      currency: 'USD',
      change: 10,
      changePercent: 10,
    });
  });

  it('maps a SG internal ticker to its Yahoo symbol but keys by the internal name', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({ regularMarketPrice: 5, previousClose: 5 })
    );
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchStockPrices(['DBS']);
    expect(out.DBS.symbol).toBe('D05.SI');
    expect(out.DBS.currency).toBe('USD'); // default when meta omits currency
    expect(out.DBS.changePercent).toBe(0); // prevClose === price
  });

  it('dedupes and upper-cases tickers (one fetch per unique symbol)', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({ regularMarketPrice: 1, previousClose: 1 })
    );
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    await fetchStockPrices(['aapl', 'AAPL', 'aApL']);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('guards divide-by-zero when previousClose is 0', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({ regularMarketPrice: 7, previousClose: 0 })
    );
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchStockPrices(['AAPL']);
    // prevClose stays 0 (?? only replaces null/undefined), so the >0 guard
    // returns 0 instead of dividing by zero.
    expect(out.AAPL.changePercent).toBe(0);
  });

  it('drops a ticker whose response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchStockPrices(['AAPL'])).toEqual({});
  });

  it('drops a ticker whose payload has no meta', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ chart: { result: [{}] } }),
    } as Response);
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchStockPrices(['AAPL'])).toEqual({});
  });

  it('drops a ticker whose fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchStockPrices(['AAPL'])).toEqual({});
  });
});

describe('price-actions — fetchExchangeRate', () => {
  it('returns the rate on success', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 1.35 }));
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('USD', 'SGD')).toBe(1.35);
  });

  it('returns null when the response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('USD', 'SGD')).toBeNull();
  });

  it('returns null for a non-positive or non-numeric rate', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 0 }));
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('USD', 'SGD')).toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('USD', 'SGD')).toBeNull();
  });
});
