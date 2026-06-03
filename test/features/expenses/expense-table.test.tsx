// @vitest-environment jsdom
import { ExpenseTable } from '@/features/expenses/components/expense-table';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Characterization test: lock in the table's filter behaviour before/after the
// EditableRow / toolbar / header extraction (refactor/007).
vi.mock('@/features/expenses/hooks/use-expenses', () => ({
  useExpenses: () => ({
    data: [
      {
        id: '1',
        date: '2026-04-01',
        type: 'food_drink',
        item: 'Grab',
        info: '',
        amount: 12,
        splitType: 'self',
        splits: [],
      },
      {
        id: '2',
        date: '2026-04-02',
        type: 'shopping',
        item: 'NTUC',
        info: '',
        amount: 30,
        splitType: 'self',
        splits: [],
      },
    ],
    isLoading: false,
  }),
  useDistinctPeople: () => ({ data: [] }),
  useUpsertExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

afterEach(cleanup);

describe('ExpenseTable', () => {
  it('renders a row per expense (item shown in its editable input)', () => {
    render(<ExpenseTable />);
    expect(screen.getByDisplayValue('Grab')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NTUC')).toBeInTheDocument();
  });

  it('filters rows by the search query', async () => {
    render(<ExpenseTable />);
    await userEvent.type(screen.getByPlaceholderText(/search item/i), 'grab');
    expect(screen.getByDisplayValue('Grab')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('NTUC')).not.toBeInTheDocument();
  });
});
