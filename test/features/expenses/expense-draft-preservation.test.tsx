// @vitest-environment jsdom
import { EditableRow } from '@/features/expenses/components/editable-expense-row';
import { ExpenseTable } from '@/features/expenses/components/expense-table';
import { ExpenseTypeSelect } from '@/features/expenses/components/expense-type-select';
import type { ExpenseData } from '@/features/expenses/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  expenses: [] as ExpenseData[],
  real: false,
  remove: vi.fn<(id: string) => Promise<void>>(),
  success: vi.fn(),
  error: vi.fn(),
  save: vi.fn<(data: ExpenseData) => Promise<void>>(),
}));
const actions = vi.hoisted(() => ({
  getExpenses: vi.fn(),
  getDistinctPeople: vi.fn(),
  upsertExpense: vi.fn(),
  deleteExpense: vi.fn(),
  settleSplit: vi.fn(),
  settleMonthSplits: vi.fn(),
}));
vi.mock('@/features/expenses/actions/expense-actions', () => actions);
vi.mock('@/features/expenses/hooks/use-expenses', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/expenses/hooks/use-expenses')
    >();
  return {
    ...actual,
    useExpenses: () =>
      boundary.real
        ? actual.useExpenses()
        : { data: boundary.expenses, isLoading: false },
    useDistinctPeople: () =>
      boundary.real ? actual.useDistinctPeople() : { data: [] },
    useUpsertExpense: () =>
      boundary.real
        ? actual.useUpsertExpense()
        : { mutateAsync: boundary.save },
    useDeleteExpense: () =>
      boundary.real
        ? actual.useDeleteExpense()
        : { mutateAsync: boundary.remove },
  };
});
vi.mock('sonner', () => ({ toast: boundary }));

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
  boundary.expenses = [];
  boundary.real = false;
  boundary.remove.mockReset().mockResolvedValue(undefined);
  boundary.success.mockReset();
  boundary.error.mockReset();
  actions.getExpenses.mockReset().mockResolvedValue([]);
  actions.getDistinctPeople.mockReset().mockResolvedValue([]);
  actions.upsertExpense.mockReset().mockResolvedValue(undefined);
  boundary.save.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function addDraft(label: string, amount: number) {
  fireEvent.click(screen.getByRole('button', { name: 'Add Row' }));
  const brands = screen.getAllByPlaceholderText('Brand');
  const amounts = screen.getAllByRole('spinbutton');
  const index = brands.findIndex(
    (input) => (input as HTMLInputElement).value === ''
  );
  fireEvent.change(brands[index], { target: { value: label } });
  fireEvent.change(amounts[index], { target: { value: String(amount) } });
}

it('retains the other draft after one draft saves', async () => {
  render(<ExpenseTable />);
  addDraft('First generated draft', 11);
  addDraft('Second generated draft', 22);
  await act(async () => {
    fireEvent.keyDown(screen.getByDisplayValue('11'), { key: 'Enter' });
  });
  expect(boundary.save).toHaveBeenCalledTimes(1);
  expect(
    screen.getByDisplayValue('Second generated draft')
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('22')).toBeInTheDocument();
});

it('retains a new draft when an existing record saves', async () => {
  boundary.expenses = [
    {
      id: 'synthetic-existing',
      date: '2026-10-10',
      type: 'food_drink',
      item: 'Existing generated expense',
      info: '',
      amount: 33,
      splitType: 'self',
      splits: [],
    },
  ];
  render(<ExpenseTable />);
  addDraft('Unrelated generated draft', 44);
  await act(async () => {
    fireEvent.keyDown(screen.getByDisplayValue('33'), { key: 'Enter' });
  });
  expect(boundary.save).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'synthetic-existing' })
  );
  expect(
    screen.getByDisplayValue('Unrelated generated draft')
  ).toBeInTheDocument();
});

it('retains the surviving editor values after cancelling an earlier draft', () => {
  render(<ExpenseTable />);
  addDraft('Cancelled generated draft', 11);
  addDraft('Surviving generated draft', 22);
  fireEvent.click(screen.getAllByLabelText('Cancel edit')[0]);
  expect(
    screen.getByDisplayValue('Surviving generated draft')
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue('22')).toBeInTheDocument();
  expect(
    screen.queryByDisplayValue('Cancelled generated draft')
  ).not.toBeInTheDocument();
  expect(boundary.save).not.toHaveBeenCalled();
});

it('retains a draft added while an earlier save is pending', async () => {
  let complete: (() => void) | undefined;
  boundary.save.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    })
  );
  render(<ExpenseTable />);
  addDraft('Pending generated draft', 11);
  fireEvent.keyDown(screen.getByDisplayValue('11'), { key: 'Enter' });
  addDraft('Later generated draft', 22);
  await act(async () => {
    complete?.();
  });
  expect(screen.getByDisplayValue('Later generated draft')).toBeInTheDocument();
});

it('preserves both drafts when the save fails', async () => {
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  render(<ExpenseTable />);
  addDraft('Failed generated draft', 11);
  addDraft('Unchanged generated draft', 22);
  await act(async () => {
    fireEvent.keyDown(screen.getByDisplayValue('11'), { key: 'Enter' });
  });
  expect(
    screen.getByDisplayValue('Failed generated draft')
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue('Unchanged generated draft')
  ).toBeInTheDocument();
});

it('does not dispatch different expense identities for repeated save of the same pending draft', () => {
  boundary.save.mockReturnValue(new Promise<void>(() => {}));
  render(<ExpenseTable />);
  addDraft('Generated draft', 11);
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  expect(boundary.save).toHaveBeenCalled();
  const ids = boundary.save.mock.calls.map(([data]) => data.id);
  expect(new Set(ids).size).toBe(1);
});

it('creates the new row with the current local date after the module has loaded', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(tomorrow);
  render(<ExpenseTable />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Row' }));
  expect(
    screen.getByRole('button', { name: format(tomorrow, 'dd MMM yyyy') })
  ).toBeInTheDocument();
});

it.each(['resolve', 'reject'] as const)(
  'does not publish a late %s notice after the table unmounts',
  async (outcome) => {
    let complete: (() => void) | undefined;
    boundary.save.mockReturnValue(
      new Promise<void>((resolve, reject) => {
        complete =
          outcome === 'resolve'
            ? resolve
            : () => reject(new Error('synthetic failure'));
      })
    );
    const view = render(<ExpenseTable />);
    addDraft('Generated draft', 11);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    view.unmount();
    await act(async () => {
      complete?.();
    });
    expect(boundary.success).not.toHaveBeenCalled();
    expect(boundary.error).not.toHaveBeenCalled();
  }
);

it('freezes only the saving draft controls and ignores repeated Enter and blur', async () => {
  let complete: (() => void) | undefined;
  boundary.save.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    })
  );
  render(<ExpenseTable />);
  addDraft('Saving generated draft', 11);
  addDraft('Editable generated draft', 22);
  const savingRow = screen
    .getByDisplayValue('Saving generated draft')
    .closest('tr');
  if (!savingRow) throw new Error('Missing saving row');
  fireEvent.keyDown(within(savingRow).getByRole('spinbutton'), {
    key: 'Enter',
  });
  expect(savingRow).toHaveAttribute('aria-busy', 'true');
  for (const control of savingRow.querySelectorAll('input,button'))
    expect(control).toBeDisabled();
  expect(within(savingRow).getByText('Saving…')).toBeInTheDocument();
  fireEvent.keyDown(savingRow, { key: 'Enter' });
  fireEvent.blur(savingRow, { relatedTarget: null });
  expect(boundary.save).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue('Editable generated draft')).toBeEnabled();
  const sibling = screen
    .getByDisplayValue('Editable generated draft')
    .closest('tr');
  if (!sibling) throw new Error('Missing sibling row');
  await userEvent.click(within(sibling).getByLabelText('Cancel edit'));
  expect(
    screen.queryByDisplayValue('Editable generated draft')
  ).not.toBeInTheDocument();
  await act(async () => {
    complete?.();
  });
});

it('keeps category options unavailable while disabled and preserves default enabled behavior', async () => {
  const change = vi.fn();
  const view = render(
    <ExpenseTypeSelect value="food_drink" onChange={change} />
  );
  await userEvent.click(screen.getByPlaceholderText('Category'));
  expect(screen.getByText('Shopping')).toBeInTheDocument();
  view.rerender(
    <ExpenseTypeSelect value="food_drink" onChange={change} disabled />
  );
  expect(screen.getByPlaceholderText('Category')).toBeDisabled();
  expect(screen.queryByText('Shopping')).not.toBeInTheDocument();
  await userEvent.click(screen.getByPlaceholderText('Category'));
  expect(change).not.toHaveBeenCalled();
  view.rerender(<ExpenseTypeSelect value="food_drink" onChange={change} />);
  expect(screen.getByText('Shopping')).toBeInTheDocument();
});

function mountReal() {
  boundary.real = true;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ExpenseTable />
    </QueryClientProvider>
  );
  return client;
}

it('renders one editor for a pending optimistic ID then one persisted editor on success', async () => {
  let complete: (() => void) | undefined;
  actions.upsertExpense.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    })
  );
  const client = mountReal();
  await screen.findByText('No expenses yet');
  addDraft('Optimistic generated draft', 11);
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  await waitFor(() => expect(actions.upsertExpense).toHaveBeenCalledTimes(1));
  const cached = client.getQueryData<ExpenseData[]>(['expenses']);
  expect(cached).toHaveLength(1);
  expect(
    screen.getAllByDisplayValue('Optimistic generated draft')
  ).toHaveLength(1);
  expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  expect(screen.getByLabelText('Saving expense')).toBeDisabled();
  await act(async () => {
    complete?.();
  });
  await waitFor(() =>
    expect(screen.queryByLabelText('Cancel edit')).not.toBeInTheDocument()
  );
  expect(
    screen.getAllByDisplayValue('Optimistic generated draft')
  ).toHaveLength(1);
  expect(screen.getByLabelText('Delete expense')).toBeInTheDocument();
  expect(client.getQueryData<ExpenseData[]>(['expenses'])?.[0].id).toBe(
    cached?.[0].id
  );
  client.clear();
});

it('retains a failed optimistic draft and retries its same stable identity', async () => {
  actions.upsertExpense
    .mockRejectedValueOnce(new Error('synthetic failure'))
    .mockResolvedValue(undefined);
  const client = mountReal();
  await screen.findByText('No expenses yet');
  addDraft('Retry generated draft', 11);
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  await waitFor(() =>
    expect(boundary.error).toHaveBeenCalledWith('Failed to save expense')
  );
  await waitFor(() => expect(screen.getByRole('spinbutton')).toBeEnabled());
  expect(client.getQueryData<ExpenseData[]>(['expenses'])).toEqual([]);
  expect(screen.getAllByDisplayValue('Retry generated draft')).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  await waitFor(() =>
    expect(boundary.success).toHaveBeenCalledWith('Expense saved')
  );
  expect(actions.upsertExpense.mock.calls[0][0].id).toBe(
    actions.upsertExpense.mock.calls[1][0].id
  );
  expect(screen.getAllByDisplayValue('Retry generated draft')).toHaveLength(1);
  client.clear();
});

it('split selector option Enter stages a new split without dispatching a row save', async () => {
  render(<ExpenseTable />);
  addDraft('Portal generated draft', 11);
  const row = screen.getByDisplayValue('Portal generated draft').closest('tr');
  if (!row) throw new Error('Missing new row');
  await userEvent.click(within(row).getByRole('combobox'));
  const option = screen.getByRole('option', { name: 'Shared' });
  option.focus();
  await userEvent.keyboard('{Enter}');
  expect(boundary.save).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(boundary.save).not.toHaveBeenCalled();
});

it('does not let Enter in an open split selector save the new row', async () => {
  boundary.save.mockReturnValue(new Promise<void>(() => {}));
  render(<ExpenseTable />);
  addDraft('Open portal generated draft', 11);
  const row = screen
    .getByDisplayValue('Open portal generated draft')
    .closest('tr');
  if (!row) throw new Error('Missing new row');
  await userEvent.click(within(row).getByRole('combobox'));
  expect(screen.getByRole('option', { name: 'Shared' })).toBeInTheDocument();
  fireEvent.keyDown(row, { key: 'Enter' });
  expect(boundary.save).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');
  fireEvent.keyDown(within(row).getByRole('spinbutton'), { key: 'Enter' });
  expect(boundary.save).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
  expect(within(row).getByRole('combobox')).toBeDisabled();
});

it.each(['resolve', 'reject'] as const)(
  'does not publish a late delete %s after unmount',
  async (outcome) => {
    let complete: (() => void) | undefined;
    boundary.remove.mockReturnValue(
      new Promise<void>((resolve, reject) => {
        complete =
          outcome === 'resolve'
            ? resolve
            : () => reject(new Error('synthetic failure'));
      })
    );
    boundary.expenses = [
      {
        id: 'synthetic-delete',
        date: '2026-10-10',
        type: 'food_drink',
        item: 'Generated deletion',
        info: '',
        amount: 11,
        splitType: 'self',
        splits: [],
      },
    ];
    const view = render(<ExpenseTable />);
    fireEvent.click(screen.getByLabelText('Delete expense'));
    expect(boundary.remove).toHaveBeenCalledWith('synthetic-delete');
    view.unmount();
    await act(async () => {
      complete?.();
    });
    expect(boundary.success).not.toHaveBeenCalled();
    expect(boundary.error).not.toHaveBeenCalled();
  }
);

it('contains a rejected standalone callback while its owner retains failure reporting', async () => {
  const save = vi
    .fn()
    .mockRejectedValue(new Error('synthetic callback failure'));
  render(
    <table>
      <tbody>
        <EditableRow
          row={{
            id: 'synthetic-callback',
            date: '2026-10-10',
            type: 'food_drink',
            item: 'Generated callback',
            info: '',
            amount: 11,
            splitType: 'self',
            splits: [],
          }}
          isNew
          peopleSuggestions={[]}
          onSave={save}
          onDelete={vi.fn()}
          onCancel={vi.fn()}
        />
      </tbody>
    </table>
  );
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
  await waitFor(() => expect(screen.getByRole('spinbutton')).toBeEnabled());
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue('Generated callback')).toBeInTheDocument();
  expect(boundary.error).not.toHaveBeenCalled();
});

it('category choice Enter updates a new draft without prematurely saving the old category', async () => {
  boundary.save.mockReturnValue(new Promise<void>(() => {}));
  render(<ExpenseTable />);
  addDraft('Category generated draft', 11);
  const category = screen.getByPlaceholderText('Category');
  await userEvent.click(category);
  await userEvent.clear(category);
  await userEvent.type(category, 'shop{Enter}');
  expect(category).toHaveValue('Shopping');
  expect(boundary.save).not.toHaveBeenCalled();
  expect(screen.getByRole('spinbutton')).toBeEnabled();
});

it('isolates out-of-order success and failure for two real optimistic drafts', async () => {
  let resolveFirst: (() => void) | undefined;
  let rejectSecond: (() => void) | undefined;
  actions.upsertExpense.mockImplementation(
    (data: ExpenseData) =>
      new Promise<void>((resolve, reject) => {
        if (data.item === 'First concurrent draft') resolveFirst = resolve;
        else rejectSecond = () => reject(new Error('synthetic second failure'));
      })
  );
  const client = mountReal();
  await screen.findByText('No expenses yet');
  addDraft('First concurrent draft', 11);
  addDraft('Second concurrent draft', 22);
  fireEvent.keyDown(screen.getByDisplayValue('11'), { key: 'Enter' });
  await waitFor(() => expect(actions.upsertExpense).toHaveBeenCalledTimes(1));
  fireEvent.keyDown(screen.getByDisplayValue('22'), { key: 'Enter' });
  await waitFor(() => expect(actions.upsertExpense).toHaveBeenCalledTimes(2));
  expect(screen.getAllByPlaceholderText('Brand')).toHaveLength(2);
  expect(client.getQueryData<ExpenseData[]>(['expenses'])).toHaveLength(2);
  await act(async () => {
    resolveFirst?.();
  });
  await waitFor(() =>
    expect(screen.getAllByLabelText('Delete expense')).toHaveLength(1)
  );
  expect(
    screen.getByDisplayValue('Second concurrent draft')
  ).toBeInTheDocument();
  await act(async () => {
    rejectSecond?.();
  });
  await waitFor(() =>
    expect(boundary.error).toHaveBeenCalledWith('Failed to save expense')
  );
  expect(screen.getByDisplayValue('22')).toBeEnabled();
  expect(client.getQueryData<ExpenseData[]>(['expenses'])).toHaveLength(1);
  expect(screen.getAllByPlaceholderText('Brand')).toHaveLength(2);
  const failedId = actions.upsertExpense.mock.calls[1][0].id;
  actions.upsertExpense.mockResolvedValue(undefined);
  fireEvent.keyDown(screen.getByDisplayValue('22'), { key: 'Enter' });
  await waitFor(() => expect(actions.upsertExpense).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.getAllByLabelText('Delete expense')).toHaveLength(2)
  );
  expect(actions.upsertExpense.mock.calls[2][0].id).toBe(failedId);
  expect(client.getQueryData<ExpenseData[]>(['expenses'])).toHaveLength(2);
  client.clear();
});

it('category Escape closes only the choices and retains the new draft', async () => {
  render(<ExpenseTable />);
  addDraft('Escape generated draft', 11);
  const category = screen.getByPlaceholderText('Category');
  await userEvent.click(category);
  await userEvent.type(category, 'shop');
  await userEvent.keyboard('{Escape}');
  expect(
    screen.getByDisplayValue('Escape generated draft')
  ).toBeInTheDocument();
  expect(screen.queryByText('Shopping')).not.toBeInTheDocument();
  expect(boundary.save).not.toHaveBeenCalled();
});

it('explicit category submit dispatches an existing row only once', async () => {
  boundary.expenses = [
    {
      id: 'synthetic-category-existing',
      date: '2026-10-10',
      type: 'food_drink',
      item: 'Generated existing category',
      info: '',
      amount: 11,
      splitType: 'self',
      splits: [],
    },
  ];
  render(<ExpenseTable />);
  const category = screen.getByPlaceholderText('Category');
  await userEvent.click(category);
  await userEvent.keyboard('{Enter}');
  expect(boundary.save).not.toHaveBeenCalled();
  await userEvent.keyboard('{Enter}');
  expect(boundary.save).toHaveBeenCalledTimes(1);
});
