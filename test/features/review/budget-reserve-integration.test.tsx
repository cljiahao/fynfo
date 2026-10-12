// @vitest-environment jsdom
import { EXPENSE_KEY, type ExpenseData } from '@/features/expenses';
import { AmountVisibilityProvider } from '@/features/privacy';
import { MonthlyReview } from '@/features/review';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getExpenses: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);
const recorded: ExpenseData = {
  id: 'synthetic-expense',
  date: '2026-01-15',
  type: 'insurance',
  item: 'Synthetic cost',
  info: '',
  amount: 100,
  splitType: 'self',
  splits: [],
};
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  api.getSnapshots.mockResolvedValue([]);
  api.getSalaryRecords.mockResolvedValue([]);
  api.getExpenses.mockResolvedValue([recorded]);
});
afterEach(() => {
  cleanup();
  client?.clear();
});

async function mount() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <MonthlyReview />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
  fireEvent.change(screen.getByLabelText('Month'), {
    target: { value: '2026-01' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Budget and annual reserve plan' })
  );
  await screen.findByText('Recorded spending · your share: SGD 100.00');
  fireEvent.change(screen.getByLabelText('Monthly spending limit (SGD)'), {
    target: { value: '500' },
  });
  fireEvent.change(screen.getByLabelText('Annual cost target (SGD)'), {
    target: { value: '987.65' },
  });
  expect(
    screen.getByText(/Remaining against recorded spending:/)
  ).toHaveTextContent('SGD 400.00');
}

it('withholds a cached-history comparison during refetch and restores it without losing planning drafts', async () => {
  await mount();
  let release!: (rows: ExpenseData[]) => void;
  api.getExpenses.mockImplementationOnce(
    () =>
      new Promise<ExpenseData[]>((resolve) => {
        release = resolve;
      })
  );
  let refetch!: Promise<void>;
  await act(async () => {
    refetch = client.refetchQueries({ queryKey: EXPENSE_KEY, exact: true });
  });
  await screen.findByText('Loading recorded spending…');
  expect(screen.queryByText(/Remaining against recorded spending:/)).toBeNull();
  expect(
    screen.queryByText('Recorded spending · your share: SGD 100.00')
  ).toBeNull();
  expect(screen.getByLabelText('Monthly spending limit (SGD)')).toHaveValue(
    '500'
  );
  expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
    '987.65'
  );
  await act(async () => {
    release([{ ...recorded, amount: 150 }]);
    await refetch;
  });
  await waitFor(() =>
    expect(
      screen.getByText(/Remaining against recorded spending:/)
    ).toHaveTextContent('SGD 350.00')
  );
  expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
    '987.65'
  );
});

it('withholds pending optimistic mutation data and restores the settled comparison without resetting drafts', async () => {
  await mount();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () => pending,
    onMutate: () => {
      client.setQueryData(EXPENSE_KEY, [{ ...recorded, amount: 200 }]);
    },
  });
  let saving!: Promise<void>;
  await act(async () => {
    saving = mutation.execute(undefined);
  });
  await screen.findByText('Loading recorded spending…');
  expect(screen.queryByText(/Remaining against recorded spending:/)).toBeNull();
  expect(
    screen.queryByText('Recorded spending · your share: SGD 200.00')
  ).toBeNull();
  expect(screen.getByLabelText('Monthly spending limit (SGD)')).toHaveValue(
    '500'
  );
  expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
    '987.65'
  );
  await act(async () => {
    release();
    await saving;
  });
  await waitFor(() =>
    expect(
      screen.getByText(/Remaining against recorded spending:/)
    ).toHaveTextContent('SGD 300.00')
  );
  expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
    '987.65'
  );
});
