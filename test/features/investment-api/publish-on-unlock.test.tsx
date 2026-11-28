// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Callbacks = {
  onSuccess?: (r: { published: number }) => void;
  onSettled?: () => void;
};

let publishedResult = 1;
const mutate = vi.fn((_surplus: number, options?: Callbacks) => {
  options?.onSuccess?.({ published: publishedResult });
  options?.onSettled?.();
});
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
  mutate.mockClear();
  publishedResult = 1;
  snapshots = { data: [{ entries: [] }] };
  settings = { isSuccess: true, data: null };
  expenses = { data: [] };
  budget = { isSuccess: true, data: 200 };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('usePublishSummaryOnUnlock', () => {
  it('publishes the derived surplus once, even across re-renders', () => {
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock('u1'));
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
    renderHook(() => usePublishSummaryOnUnlock('u1'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('publishes after the last input finishes loading', () => {
    expenses = { data: undefined };
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock('u1'));
    expect(mutate).not.toHaveBeenCalled();
    expenses = { data: [] };
    rerender();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('publishes again after a lock and re-unlock remounts it', () => {
    const first = renderHook(() => usePublishSummaryOnUnlock('u1'));
    first.unmount();
    renderHook(() => usePublishSummaryOnUnlock('u1'));
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('publishes again for a different user', () => {
    let userId = 'u1';
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock(userId));
    userId = 'u2';
    rerender();
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('publishes again when the saved budget changes', () => {
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock('u1'));
    budget = { isSuccess: true, data: 350 };
    rerender();
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('does not remember a publish that sealed for nobody', () => {
    publishedResult = 0;
    const { rerender } = renderHook(() => usePublishSummaryOnUnlock('u1'));
    expect(mutate).toHaveBeenCalledTimes(1);
    publishedResult = 1;
    budget = { isSuccess: true, data: 201 };
    rerender();
    expect(mutate).toHaveBeenCalledTimes(2);
    budget = { isSuccess: true, data: 201 };
    rerender();
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('publishes again once the day rolls over', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T23:50:00Z'));
    renderHook(() => usePublishSummaryOnUnlock('u1'));
    expect(mutate).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-11-29T00:05:00Z'));
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});
