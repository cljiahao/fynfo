// @vitest-environment jsdom
import { ExpenseQuickAdd } from '@/features/expenses/components/expense-quick-add';
import { ExpenseTable } from '@/features/expenses/components/expense-table';
import { OwedSummary } from '@/features/expenses/components/owed-summary';
import { useExpenses } from '@/features/expenses/hooks/use-expenses';
import type { ExpenseData } from '@/features/expenses/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const actions = vi.hoisted(() => ({
  getExpenses: vi.fn(),
  getDistinctPeople: vi.fn(),
  upsertExpense: vi.fn(),
  deleteExpense: vi.fn(),
  settleSplit: vi.fn(),
  settleMonthSplits: vi.fn(),
}));
const notices = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock('@/features/expenses/actions/expense-actions', () => actions);
vi.mock('sonner', () => ({ toast: notices }));
const rows: ExpenseData[] = [
  {
    id: 'e1',
    date: '2026-10-01',
    type: 'food_drink',
    item: 'Cafe',
    info: 'Meal',
    amount: 90,
    splitType: 'shared',
    splits: [{ person: 'Alex', amount: 45, settled: false }],
  },
  {
    id: 'e2',
    date: '2026-09-01',
    type: 'shopping',
    item: 'Store',
    info: '',
    amount: 100,
    splitType: 'self',
    splits: [],
  },
];
function mount(node: React.ReactNode, data?: ExpenseData[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (data) client.setQueryData(['expenses'], data);
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return client;
}
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => undefined,
  });
  vi.resetAllMocks();
  actions.getExpenses.mockResolvedValue(rows);
  actions.getDistinctPeople.mockResolvedValue(['Alex']);
  actions.upsertExpense.mockResolvedValue(undefined);
  actions.deleteExpense.mockResolvedValue(undefined);
  actions.settleMonthSplits.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('expense table real cache workflows', () => {
  it('shows loading then no expenses, adds and cancels a draft without persisting', async () => {
    let resolve!: (value: ExpenseData[]) => void;
    actions.getExpenses.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    mount(<ExpenseTable />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Row' }));
    expect(screen.queryByText('No expenses yet')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Cancel edit'));
    expect(screen.getByText('No expenses yet')).toBeInTheDocument();
    expect(actions.upsertExpense).not.toHaveBeenCalled();
  });
  it('filters by category label and split mode and sorts both directions by amount', async () => {
    mount(<ExpenseTable />);
    await screen.findByDisplayValue('Cafe');
    await userEvent.type(
      screen.getByPlaceholderText(/Search item/),
      'shopping'
    );
    expect(screen.getByDisplayValue('Store')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Cafe')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText(/Search item/));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Amount' }));
    expect(
      screen
        .getAllByPlaceholderText('Brand')
        .map((e) => (e as HTMLInputElement).value)
    ).toEqual(['Store', 'Cafe']);
    fireEvent.click(screen.getByRole('columnheader', { name: 'Amount' }));
    expect(
      screen
        .getAllByPlaceholderText('Brand')
        .map((e) => (e as HTMLInputElement).value)
    ).toEqual(['Cafe', 'Store']);
    await userEvent.click(screen.getAllByRole('combobox')[1]);
    await userEvent.click(screen.getByRole('option', { name: 'Shared' }));
    expect(screen.getByDisplayValue('Cafe')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Store')).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/Search item/), 'absent');
    expect(
      screen.getByText('No expenses match your filters.')
    ).toBeInTheDocument();
  });
  it('saves a new draft through the action then deletes it through cache mutation', async () => {
    actions.getExpenses.mockResolvedValue([]);
    const client = mount(<ExpenseTable />);
    await screen.findByText('No expenses yet');
    await userEvent.click(screen.getByRole('button', { name: 'Add Row' }));
    await userEvent.type(screen.getByPlaceholderText('Brand'), 'Dinner');
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '40' },
    });
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    await waitFor(() =>
      expect(notices.success).toHaveBeenCalledWith('Expense saved')
    );
    const saved = client.getQueryData<ExpenseData[]>(['expenses'])?.[0];
    expect(saved).toMatchObject({
      item: 'Dinner',
      amount: 40,
      splitType: 'self',
      splits: [],
    });
    expect(saved?.id).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Delete expense'));
    await waitFor(() =>
      expect(screen.getByText('No expenses yet')).toBeInTheDocument()
    );
    expect(actions.deleteExpense).toHaveBeenCalledWith(saved?.id);
  });
  it('rolls back failed save and deletion and emits failure notices', async () => {
    actions.upsertExpense.mockRejectedValue(new Error('failed'));
    actions.deleteExpense.mockRejectedValue(new Error('failed'));
    mount(<ExpenseTable />);
    await screen.findByDisplayValue('Cafe');
    fireEvent.change(screen.getAllByRole('spinbutton')[0], {
      target: { value: '120' },
    });
    fireEvent.keyDown(screen.getAllByRole('spinbutton')[0], { key: 'Enter' });
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith('Failed to save expense')
    );
    await userEvent.click(screen.getAllByLabelText('Delete expense')[0]);
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith('Failed to delete')
    );
    expect(screen.getByDisplayValue('Cafe')).toBeInTheDocument();
  });
});
function OwedWithCache() {
  const query = useExpenses();
  return <OwedSummary expenses={query.data ?? []} />;
}
describe('owed month settlement', () => {
  it('renders no summary without shared splits and settles and reopens a month in the real cache', async () => {
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <OwedSummary expenses={[]} />
      </QueryClientProvider>
    );
    expect(screen.queryByText('Who Owes You')).not.toBeInTheDocument();
    view.unmount();
    const client = mount(<OwedWithCache />);
    await screen.findByText('Who Owes You');
    await userEvent.click(screen.getByRole('button', { name: /Alex/ }));
    await userEvent.click(screen.getByLabelText('Mark month settled'));
    await waitFor(() =>
      expect(actions.settleMonthSplits).toHaveBeenCalledWith(
        ['e1'],
        'Alex',
        true
      )
    );
    await waitFor(() =>
      expect(screen.getByText('All settled')).toBeInTheDocument()
    );
    expect(
      client.getQueryData<ExpenseData[]>(['expenses'])?.[0].splits[0].settled
    ).toBe(true);
    await userEvent.click(screen.getByLabelText('Mark month unsettled'));
    await waitFor(() =>
      expect(actions.settleMonthSplits).toHaveBeenCalledWith(
        ['e1'],
        'Alex',
        false
      )
    );
    expect(notices.success).toHaveBeenCalledWith('Marked as unsettled');
  });
  it('restores an unsettled month when settlement action fails', async () => {
    actions.settleMonthSplits.mockRejectedValue(new Error('failed'));
    mount(<OwedWithCache />);
    await screen.findByText('Who Owes You');
    await userEvent.click(screen.getByRole('button', { name: /Alex/ }));
    await userEvent.click(screen.getByLabelText('Mark month settled'));
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith('Failed to update')
    );
    expect(screen.getByLabelText('Mark month settled')).toBeInTheDocument();
  });
});

function pasteExpense(text: string) {
  fireEvent(
    screen.getByPlaceholderText('e.g. Grab, NTUC'),
    createEvent.paste(screen.getByPlaceholderText('e.g. Grab, NTUC'), {
      clipboardData: { getData: () => text },
    })
  );
}
describe('quick add real mutation success and failure', () => {
  it('reports an earlier failed single pasted expense even when a later paste succeeds', async () => {
    actions.upsertExpense
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue(undefined);
    mount(<ExpenseQuickAdd />);
    pasteExpense('2026-10-01\tCafe\t25');
    pasteExpense('2026-10-02\tStore\t30');
    await waitFor(() => expect(actions.upsertExpense).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'Failed to add expense — removed from list'
      )
    );
  });
  it('retains incomplete pasted fields until amount entered and persists chosen category and notes', async () => {
    mount(<ExpenseQuickAdd />);
    pasteExpense('2026-10-01\tshopping\tStore');
    expect(screen.getByText('Pasted from Excel')).toBeInTheDocument();
    expect(actions.upsertExpense).not.toHaveBeenCalled();
    await userEvent.type(
      screen.getByPlaceholderText('Optional description'),
      'Gifts'
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '25' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('0.00'), { key: 'Enter' });
    await waitFor(() =>
      expect(notices.success).toHaveBeenCalledWith('Expense added')
    );
    expect(actions.upsertExpense.mock.calls[0][0]).toMatchObject({
      date: '2026-10-01',
      type: 'shopping',
      item: 'Store',
      info: 'Gifts',
      amount: 25,
    });
    expect(screen.queryByText('Pasted from Excel')).not.toBeInTheDocument();
  });
  it('single-row failure restores cache without restoring a stale entry form', async () => {
    actions.upsertExpense.mockRejectedValue(new Error('failed'));
    const client = mount(<ExpenseQuickAdd />);
    pasteExpense('2026-10-01\tCafe\t25');
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'Failed to add expense — removed from list'
      )
    );
    expect(client.getQueryData(['expenses'])).toEqual([]);
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(null);
  });
  it('reports skipped multi-row inputs and each failed save while preserving valid optimistic entries', async () => {
    actions.upsertExpense
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue(undefined);
    const client = mount(<ExpenseQuickAdd />);
    pasteExpense(
      '2026-10-01\tCafe\t25\n2026-10-02\tStore\t30\nNoDate\tMissing'
    );
    await waitFor(() => expect(actions.upsertExpense).toHaveBeenCalledTimes(2));
    expect(notices.success).toHaveBeenCalledWith(
      '2 expenses added, 1 skipped (missing date or amount)'
    );
    await waitFor(() =>
      expect(client.getQueryData<ExpenseData[]>(['expenses'])).toHaveLength(1)
    );
    expect(notices.error).toHaveBeenCalledWith(
      'A pasted expense failed to save — removed from list'
    );
    expect(client.getQueryData<ExpenseData[]>(['expenses'])?.[0].item).toBe(
      'Store'
    );
  });
  it('rejects malformed tabbed content and multi-row input without both date and amount', () => {
    mount(<ExpenseQuickAdd />);
    pasteExpense('\t\t');
    expect(notices.error).toHaveBeenCalledWith(
      'Could not parse pasted content'
    );
    pasteExpense('x\ty\nq\tz');
    expect(notices.error).toHaveBeenCalledWith(
      'No rows had both a date and an amount — nothing added'
    );
    expect(actions.upsertExpense).not.toHaveBeenCalled();
  });
  it('calendar selection and category selection keep selected fields on repeated manual adds', async () => {
    mount(<ExpenseQuickAdd />);
    const dateButton = screen
      .getAllByRole('button')
      .find((button) => /\d{2} \w{3} \d{4}/.test(button.textContent ?? ''))!;
    await userEvent.click(dateButton);
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    await userEvent.click(screen.getByPlaceholderText('Category'));
    await userEvent.clear(screen.getByPlaceholderText('Category'));
    await userEvent.type(
      screen.getByPlaceholderText('Category'),
      'transport{Enter}'
    );
    expect(screen.getByPlaceholderText('e.g. Grab, NTUC')).toHaveFocus();
    await userEvent.type(screen.getByPlaceholderText('e.g. Grab, NTUC'), 'Bus');
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '2' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
    await waitFor(() =>
      expect(notices.success).toHaveBeenCalledWith('Expense added')
    );
    expect(actions.upsertExpense.mock.calls[0][0]).toMatchObject({
      type: 'transport',
      item: 'Bus',
      amount: 2,
    });
    expect(screen.getByPlaceholderText('Category')).toHaveValue('Transport');
  });
});
