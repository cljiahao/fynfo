// @vitest-environment jsdom
import AssetsPage from '@/app/dashboard/assets/page';
import EquityPage from '@/app/dashboard/equity/page';
import ExpensesPage from '@/app/dashboard/expenses/page';
import SalaryPage from '@/app/dashboard/salary/page';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({
  data: undefined,
  isLoading: false,
  isError: true,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/assets', () => ({
  useSnapshots: () => query,
  useChartData: () => [],
  calculateTotal: () => 0,
}));
vi.mock('@/features/equity', () => ({ useTrades: () => query }));
vi.mock('@/features/salary', () => ({ useSalaryRecords: () => query }));
vi.mock('@/features/expenses', () => ({ useExpenses: () => query }));
afterEach(() => {
  cleanup();
  query.refetch.mockClear();
});

it.each([
  ['assets', AssetsPage],
  ['equity', EquityPage],
  ['salary', SalaryPage],
  ['expenses', ExpensesPage],
] as const)(
  '%s shows an opaque retry state instead of empty financial content',
  (_, Page) => {
    render(<Page />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(query.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link', { name: 'Add Snapshot' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Add Trade|Add Record/ })
    ).toBeNull();
  }
);
