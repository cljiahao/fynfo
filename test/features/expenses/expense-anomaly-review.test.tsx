// @vitest-environment jsdom
import { ExpenseAnomalyReview } from '@/features/expenses/components/expense-anomaly-review';
import type { ExpenseData } from '@/features/expenses/types';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  data: [] as ExpenseData[] | undefined,
  isSuccess: true,
  isError: false,
  isFetching: false,
  mutations: 0,
  refetch: vi.fn(),
}));
vi.mock('@/features/expenses/hooks/use-expenses', () => ({
  useExpenses: () => state,
}));
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useIsMutating: () => state.mutations,
}));
function history(): ExpenseData[] {
  return [
    ...['2026-06', '2026-07', '2026-08'].map((month) => ({
      id: month,
      date: `${month}-15`,
      type: 'groceries' as const,
      item: 'Synthetic baseline',
      info: '',
      amount: 50,
      splitType: 'self' as const,
      splits: [],
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `selected-${index}`,
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      type: 'groceries' as const,
      item: `Synthetic source ${index + 1}`,
      info: '',
      amount: 10,
      splitType: 'self' as const,
      splits: [],
    })),
  ];
}
function openReview() {
  fireEvent.click(screen.getByRole('button', { name: 'Compare months' }));
}
function analyze() {
  fireEvent.click(screen.getByRole('button', { name: 'Refresh comparison' }));
}
function shell() {
  return (
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <ExpenseAnomalyReview />
    </AmountVisibilityProvider>
  );
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T01:00:00Z'));
  state.data = history();
  state.isSuccess = true;
  state.isError = false;
  state.isFetching = false;
  state.mutations = 0;
  state.refetch.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('explicit read-only spending review', () => {
  it('initializes the elapsed review month from Singapore across a UTC month boundary', () => {
    vi.setSystemTime(new Date('2026-09-30T16:15:00Z'));
    render(shell());
    openReview();
    expect(
      (screen.getByLabelText('Review month') as HTMLInputElement).value
    ).toBe('2026-09');
    expect(screen.getByText(/Singapore month:/).textContent).toContain(
      '2026-10'
    );
    analyze();
    expect(
      screen.getByText('Groceries recorded higher than recent months')
    ).toBeTruthy();
  });
  it('blocks initial loading and requires explicit review after the history becomes ready', () => {
    state.data = undefined;
    state.isSuccess = false;
    state.isFetching = true;
    const view = render(shell());
    openReview();
    const review = screen.getByRole('button', {
      name: 'Refresh comparison',
    }) as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain(
      'Wait for expense history'
    );
    fireEvent.click(review);
    expect(
      screen.queryByText('Groceries recorded higher than recent months')
    ).toBeNull();
    state.data = history();
    state.isSuccess = true;
    state.isFetching = false;
    view.rerender(shell());
    expect(review.disabled).toBe(false);
    expect(
      screen.queryByText('Groceries recorded higher than recent months')
    ).toBeNull();
    analyze();
    expect(
      screen.getByText('Groceries recorded higher than recent months')
    ).toBeTruthy();
  });
  it('compares on explicit opening and pages only source rows, leaving full-history totals intact', () => {
    render(shell());
    openReview();
    expect(
      screen.queryByText('Groceries recorded higher than recent months')
    ).not.toBeNull();
    analyze();
    expect(
      screen.getByText('Groceries recorded higher than recent months')
    ).toBeTruthy();
    expect(screen.getByText(/this month; the median/).textContent).toContain(
      'SGD 120.00'
    );
    fireEvent.click(screen.getByText('Review contributing records'));
    expect(screen.getByText('Synthetic source 1')).toBeTruthy();
    expect(screen.queryByText('Synthetic source 11')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Synthetic source 11')).toBeTruthy();
    expect(screen.queryByText('Synthetic source 1')).toBeNull();
    analyze();
    expect(screen.getByText('Synthetic source 1')).toBeTruthy();
  });
  it('displays safe maximum cents exactly in totals and source shares', () => {
    const rows = history();
    state.data = [
      ...rows.slice(0, 3),
      { ...rows[3], amount: 90071992547409.91 },
    ];
    render(shell());
    openReview();
    analyze();
    expect(screen.getByText(/this month; the median/).textContent).toContain(
      'SGD 90,071,992,547,409.91'
    );
    expect(screen.getByText(/this month; the median/).textContent).toContain(
      'SGD 90,071,992,547,359.91'
    );
    fireEvent.click(screen.getByText('Review contributing records'));
    expect(screen.getAllByText('SGD 90,071,992,547,409.91')).toHaveLength(2);
  });
  it('invalidates reviewed values after data changes and month changes without silently recomputing', () => {
    const view = render(shell());
    openReview();
    analyze();
    state.data = [...(state.data ?? [])];
    view.rerender(shell());
    expect(
      screen.queryByText('Groceries recorded higher than recent months')
    ).toBeNull();
    analyze();
    expect(
      screen.getByText('Groceries recorded higher than recent months')
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Review month'), {
      target: { value: '2026-08' },
    });
    expect(
      screen.queryByText('Groceries recorded higher than recent months')
    ).toBeNull();
    analyze();
    expect(screen.getByText(/No category meets this review rule/)).toBeTruthy();
  });
  it.each(['fetching', 'error', 'mutation'] as const)(
    'requires fresh review after %s readiness interruption',
    (kind) => {
      const view = render(shell());
      openReview();
      analyze();
      if (kind === 'fetching') state.isFetching = true;
      if (kind === 'error') state.isError = true;
      if (kind === 'mutation') state.mutations = 1;
      view.rerender(shell());
      expect(
        screen.queryByText('Groceries recorded higher than recent months')
      ).toBeNull();
      expect(
        (
          screen.getByRole('button', {
            name: 'Refresh comparison',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true);
      if (kind === 'error') {
        fireEvent.click(
          screen.getByRole('button', { name: 'Retry expense history' })
        );
        expect(state.refetch).toHaveBeenCalledOnce();
      }
      state.isFetching = false;
      state.isError = false;
      state.mutations = 0;
      view.rerender(shell());
      expect(
        screen.queryByText('Groceries recorded higher than recent months')
      ).toBeNull();
      analyze();
      expect(
        screen.getByText('Groceries recorded higher than recent months')
      ).toBeTruthy();
    }
  );
  it('clears an expanded source snapshot on Hide and keeps it absent after Show', () => {
    render(shell());
    openReview();
    analyze();
    fireEvent.click(screen.getByText('Review contributing records'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Hide amounts', hidden: true })
    );
    expect(screen.queryByText('Synthetic source 1')).toBeNull();
    expect(
      screen.queryByText('Groceries recorded higher than recent months')
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show amounts' })[0]);
    expect(screen.queryByText('Synthetic source 1')).toBeNull();
    analyze();
    expect(screen.getByText('Synthetic source 1')).toBeTruthy();
  });
  it('distinguishes successful empty history, unavailable comparisons and invalid review month', () => {
    state.data = [];
    render(shell());
    openReview();
    analyze();
    expect(
      screen.getByText(/0 categories comparable; 14 unavailable/)
    ).toBeTruthy();
    fireEvent.click(
      screen.getByText('Comparison availability (14 categories)')
    );
    expect(screen.queryByText('No anomalies')).toBeNull();
    fireEvent.change(screen.getByLabelText('Review month'), {
      target: { value: '2026-10' },
    });
    analyze();
    expect(screen.getByRole('alert').textContent).toContain(
      'fully elapsed month'
    );
  });
});
