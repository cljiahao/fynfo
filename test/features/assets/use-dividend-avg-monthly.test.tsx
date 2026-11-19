// @vitest-environment jsdom
import { useDividendAvgMonthly } from '@/features/assets/hooks/use-freedom-inputs';
import type { DividendData } from '@/features/equity';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dividends: undefined as DividendData[] | undefined,
  rate: undefined as number | undefined,
}));

vi.mock('@/features/equity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/equity')>()),
  useDividends: () => ({ data: state.dividends }),
  useExchangeRate: () => ({ data: state.rate, isError: false }),
}));

const today = new Date().toISOString().slice(0, 10);
const row = (over: Partial<DividendData> = {}): DividendData => ({
  ticker: 'DBS',
  amount: 120,
  currency: 'SGD',
  date: today,
  ...over,
});

beforeEach(() => {
  state.dividends = undefined;
  state.rate = undefined;
});

describe('useDividendAvgMonthly', () => {
  it('is null while dividends are loading', () => {
    expect(renderHook(() => useDividendAvgMonthly()).result.current).toBeNull();
  });

  it('is 0 for a loaded empty list', () => {
    state.dividends = [];
    expect(renderHook(() => useDividendAvgMonthly()).result.current).toBe(0);
  });

  it('is 0 when every row is older than 12 months', () => {
    state.dividends = [row({ date: '2000-01-01' })];
    expect(renderHook(() => useDividendAvgMonthly()).result.current).toBe(0);
  });

  it('averages a trailing-window row over twelve months', () => {
    state.dividends = [row()];
    expect(renderHook(() => useDividendAvgMonthly()).result.current).toBe(10);
  });

  it('is null for USD rows without a rate', () => {
    state.dividends = [row({ currency: 'USD' })];
    expect(renderHook(() => useDividendAvgMonthly()).result.current).toBeNull();
  });
});
