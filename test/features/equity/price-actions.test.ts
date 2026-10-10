import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireUserId = vi.fn(async () => 'user-1');
vi.mock('@/lib/auth-guard', () => ({
  requireUserId: () => requireUserId(),
}));

function chartResponse(meta: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      chart: { result: [{ meta: { currency: 'USD', ...meta } }] },
    }),
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
  it.each([
    { currency: 'USD' },
    { regularMarketPrice: null, currency: 'USD' },
    { regularMarketPrice: 1, currency: null },
    { regularMarketPrice: 1, currency: undefined },
  ])('does not fabricate missing prices or currencies: %j', async (meta) => {
    fetchMock.mockResolvedValue(chartResponse(meta));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchStockPrices(['AAPL'])).toEqual({});
  });

  it('retains an actual zero and provider source time', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({
        regularMarketPrice: 0,
        regularMarketTime: 0,
        currency: 'USD',
      })
    );
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    expect((await fetchStockPrices(['AAPL'])).AAPL).toMatchObject({
      price: 0,
      asOf: '1970-01-01T00:00:00.000Z',
    });
  });
  it('rejects oversized ticker arrays before issuing requests', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 1 }));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchStockPrices(
      Array.from({ length: 101 }, (_, i) => `T${i}`)
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out).toEqual({});
  });

  it.each([['../AAPL'], ['A'.repeat(17)], [''], ['AAPL', 42]])(
    'rejects malformed ticker input %j before any fetch',
    async (...tickers) => {
      fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 1 }));
      const { fetchStockPrices } =
        await import('@/features/equity/actions/price-actions');
      expect(await fetchStockPrices(tickers as string[])).toEqual({});
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('canonicalizes whitespace and case to stable ticker keys', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 5 }));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchStockPrices([' dbs ', 'DBS']);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(Object.keys(out)).toEqual(['DBS']);
    expect(out.DBS.symbol).toBe('D05.SI');
  });

  it.each([
    { regularMarketPrice: '110' },
    { regularMarketPrice: Infinity },
    { regularMarketPrice: -1 },
    { regularMarketPrice: 1, previousClose: '0' },
    { regularMarketPrice: 1, previousClose: NaN },
    { regularMarketPrice: 1, currency: { code: 'USD' } },
    { regularMarketPrice: 1e308, previousClose: 1e-300 },
  ])('drops malformed quote metadata %j', async (meta) => {
    fetchMock.mockResolvedValue(chartResponse(meta));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchStockPrices(['AAPL'])).toEqual({});
  });

  it('limits simultaneous quote requests and returns every valid result', async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return chartResponse({ regularMarketPrice: 10 });
    });
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const tickers = Array.from({ length: 12 }, (_, i) => `T${i}`);
    expect(Object.keys(await fetchStockPrices(tickers))).toEqual(tickers);
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it('attaches a deadline signal and handles an aborted quote as empty', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    try {
      expect(await fetchStockPrices(['AAPL'])).toEqual({});
      expect(timeoutSpy).toHaveBeenCalledWith(10_000);
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

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
      asOf: null,
    });
  });

  it('maps a SG internal ticker to its Yahoo symbol but keys by the internal name', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({
        regularMarketPrice: 5,
        previousClose: 5,
        currency: 'SGD',
      })
    );
    const { fetchStockPrices } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchStockPrices(['DBS']);
    expect(out.DBS.symbol).toBe('D05.SI');
    expect(out.DBS.currency).toBe('SGD');
    expect(out.DBS.changePercent).toBe(0);
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
  it('rejects path/query fragments in currency input before any fetch', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 1.35 }));
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('USD?range=5y&', 'SGD')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('canonicalizes currency codes and encodes the FX path', async () => {
    fetchMock.mockResolvedValue(chartResponse({ regularMarketPrice: 1.35 }));
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('usd', 'sgd')).toBe(1.35);
    expect(fetchMock.mock.calls[0][0]).toContain('/USDSGD%3DX?');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects a nonfinite upstream exchange rate', async () => {
    fetchMock.mockResolvedValue(
      chartResponse({ regularMarketPrice: Infinity })
    );
    const { fetchExchangeRate } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchExchangeRate('USD', 'SGD')).toBeNull();
  });

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

function dividendsResponse(
  events: Record<string, { amount: number; date: number }>
) {
  return {
    ok: true,
    json: async () => ({
      chart: { result: [{ events: { dividends: events } }] },
    }),
  } as Response;
}

describe('price-actions — fetchDividends', () => {
  it('rejects malformed ticker input before any request', async () => {
    fetchMock.mockResolvedValue(dividendsResponse({}));
    const { fetchDividends } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchDividends('../AAPL')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retains valid dividends while rejecting malformed entries', async () => {
    const date = Math.floor(Date.UTC(2026, 1, 15) / 1000);
    fetchMock.mockResolvedValue(
      dividendsResponse({
        valid: { amount: 0.02, date },
        negative: { amount: -1, date },
        nonfinite: { amount: Infinity, date },
        invalidDate: { amount: 1, date: 1e20 },
        expandedYear: { amount: 1, date: 253_402_300_800 },
      })
    );
    const { fetchDividends } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchDividends('MLT')).toEqual([
      { exDate: '2026-02-15', dpu: 0.02 },
    ]);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('requires auth and parses ex-date + DPU, sorted ascending', async () => {
    const t1 = Math.floor(Date.UTC(2026, 1, 15) / 1000);
    const t2 = Math.floor(Date.UTC(2026, 4, 30) / 1000);
    fetchMock.mockResolvedValue(
      dividendsResponse({
        [t2]: { amount: 0.025, date: t2 },
        [t1]: { amount: 0.02, date: t1 },
      })
    );
    const { fetchDividends } =
      await import('@/features/equity/actions/price-actions');
    const out = await fetchDividends('MLT');
    expect(requireUserId).toHaveBeenCalledOnce();
    expect(out).toEqual([
      { exDate: '2026-02-15', dpu: 0.02 },
      { exDate: '2026-05-30', dpu: 0.025 },
    ]);
  });

  it('rejects opaque when the response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    const { fetchDividends } =
      await import('@/features/equity/actions/price-actions');
    await expect(fetchDividends('MLT')).rejects.toMatchObject({
      code: 'EXTERNAL_API',
      message: 'Dividend data unavailable',
    });
  });

  it('returns [] when there are no dividend events', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ chart: { result: [{ events: {} }] } }),
    } as Response);
    const { fetchDividends } =
      await import('@/features/equity/actions/price-actions');
    expect(await fetchDividends('MLT')).toEqual([]);
  });

  it('rejects opaque when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const { fetchDividends } =
      await import('@/features/equity/actions/price-actions');
    await expect(fetchDividends('MLT')).rejects.toMatchObject({
      code: 'EXTERNAL_API',
      message: 'Dividend data unavailable',
    });
  });
});
