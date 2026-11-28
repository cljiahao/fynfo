// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutate = vi.fn();
let snapshots: { data: unknown };
let settings: { isSuccess: boolean; data: unknown };
let expenses: { data: unknown };
let budget: { isSuccess: boolean; data: number | null };

vi.mock('@/features/assets', () => ({
  calcRecentAvgExpense: () => ({ average: 1000 }),
  derivePersonalSurplus: ({ snapshots: s }: { snapshots: unknown[] }) =>
    s.length > 0 ? 4321 : null,
  useExpensesOverride: () => ({ override: null }),
  usePlannerSettings: () => settings,
  useSnapshots: () => snapshots,
}));
vi.mock('@/features/expenses', () => ({ useExpenses: () => expenses }));
vi.mock('@/features/investment-api/hooks/use-publish-budget', () => ({
  useWeeklyBudget: () => budget,
  usePublishSummary: () => ({ mutate }),
}));

const { usePublishSummaryOnUnlock } =
  await import('@/features/investment-api/hooks/use-publish-on-unlock');

beforeEach(() => {
  mutate.mockReset();
  window.sessionStorage.clear();
  snapshots = { data: [{ entries: [] }] };
  settings = { isSuccess: true, data: null };
  expenses = { data: [] };
  budget = { isSuccess: true, data: 200 };
});
afterEach(cleanup);

describe('usePublishSummaryOnUnlock', () => {
  it('publishes the derived surplus once, even across re-renders', () => {
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock());
    rerender();
    rerender();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toBe(4321);
  });

  it.each([
    ['snapshots', () => (snapshots = { data: undefined })],
    ['settings', () => (settings = { isSuccess: false, data: undefined })],
    ['expenses', () => (expenses = { data: undefined })],
    ['budget loading', () => (budget = { isSuccess: false, data: null })],
    ['budget unset', () => (budget = { isSuccess: true, data: null })],
    ['empty snapshots', () => (snapshots = { data: [] })],
  ])('does not publish from partial data (%s)', (_name, apply) => {
    apply();
    renderHook(() => usePublishSummaryOnUnlock());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('skips when this session already published', () => {
    window.sessionStorage.setItem('fynfo.invest.published', '1');
    renderHook(() => usePublishSummaryOnUnlock());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('publishes after the last input finishes loading', () => {
    expenses = { data: undefined };
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock());
    expect(mutate).not.toHaveBeenCalled();
    expenses = { data: [] };
    rerender();
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
