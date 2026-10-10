// @vitest-environment jsdom
import type { SnapshotData } from '@/features/assets';
import type { ExpenseData } from '@/features/expenses';
import { MonthlyReview } from '@/features/review';
import type { SalaryData } from '@/features/salary';
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
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getExpenses: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);

const expense: ExpenseData = {
  id: 'synthetic-expense',
  date: '2026-01-15',
  type: 'insurance',
  item: 'Synthetic insurance',
  info: '',
  amount: 100,
  splitType: 'self',
  splits: [],
};
const snapshot: SnapshotData = {
  id: '2026-01',
  entries: [{ category: 'savings', account: 'Synthetic account', amount: 0 }],
};
const income: SalaryData = { id: '2026-01', salary: 0, bonus: 0 };
let client: QueryClient;

beforeEach(() => {
  vi.resetAllMocks();
  api.getSnapshots.mockResolvedValue([]);
  api.getSalaryRecords.mockResolvedValue([]);
  api.getExpenses.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  client?.clear();
});

function mountReview() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MonthlyReview />
    </QueryClientProvider>
  );
  fireEvent.change(screen.getByLabelText('Month'), {
    target: { value: '2026-01' },
  });
}
async function openSteps() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Sources and next steps' })
  );
  return screen.getByRole('list', { name: 'Monthly review steps' });
}

it('distinguishes zero-valued recorded income and balances from absent spending without certifying a month', async () => {
  api.getSnapshots.mockResolvedValue([snapshot]);
  api.getSalaryRecords.mockResolvedValue([income]);
  mountReview();
  const steps = await openSteps();
  expect(
    within(steps).getByText('Salary record available')
  ).toBeInTheDocument();
  expect(
    within(steps).getByText('Snapshot available for this month')
  ).toBeInTheDocument();
  expect(
    within(steps).getByText('No expenses recorded for this month')
  ).toBeInTheDocument();
  expect(
    screen.getByText(/not a completed or reconciled month/)
  ).toBeInTheDocument();
  expect(screen.getByText('Needs both snapshots')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
it('offers existing routes when no selected-month records exist', async () => {
  mountReview();
  const steps = await openSteps();
  expect(
    within(steps).getByText('No salary record for this month')
  ).toBeInTheDocument();
  expect(
    within(steps).getByText('No snapshot for this month')
  ).toBeInTheDocument();
  expect(
    within(steps).getByRole('link', {
      name: 'Compare salary with your payslip',
    })
  ).toHaveAttribute('href', '/dashboard/salary');
  expect(
    within(steps).getByRole('link', {
      name: 'Compare expenses with your statement',
    })
  ).toHaveAttribute('href', '/dashboard/expenses');
  expect(
    within(steps).getByRole('link', { name: 'Review month-end balances' })
  ).toHaveAttribute('href', '/dashboard/assets');
});
it.each([1, 2])(
  'reports%s recorded expense(s) without assuming statement completeness',
  async (count) => {
    api.getExpenses.mockResolvedValue(
      Array.from({ length: count }, (_, index) => ({
        ...expense,
        id: `synthetic-${index}`,
      }))
    );
    mountReview();
    const steps = await openSteps();
    expect(
      within(steps).getByText(
        count === 1 ? '1 expense recorded' : '2 expenses recorded'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Month complete')).not.toBeInTheDocument();
  }
);
it('keeps invalid shared splits visible before opening the targeted review action', async () => {
  api.getExpenses.mockResolvedValue([
    {
      ...expense,
      splitType: 'shared',
      splits: [{ person: 'Synthetic other', amount: 101, settled: true }],
    },
  ]);
  mountReview();
  expect(await screen.findByText('Check shared splits')).toBeInTheDocument();
  expect(
    screen.queryByRole('list', { name: 'Monthly review steps' })
  ).not.toBeInTheDocument();
  expect(
    within(await openSteps()).getByText(
      'Review shared splits before comparing totals'
    )
  ).toBeInTheDocument();
});
it('recomputes selected-month availability using cached histories without extra reads', async () => {
  api.getSnapshots.mockResolvedValue([snapshot]);
  api.getSalaryRecords.mockResolvedValue([income]);
  api.getExpenses.mockResolvedValue([expense]);
  mountReview();
  await openSteps();
  fireEvent.change(screen.getByLabelText('Month'), {
    target: { value: '2026-02' },
  });
  const steps = screen.getByRole('list', { name: 'Monthly review steps' });
  expect(
    within(steps).getByText('No salary record for this month')
  ).toBeInTheDocument();
  expect(
    within(steps).getByText('No expenses recorded for this month')
  ).toBeInTheDocument();
  expect(
    within(steps).getByText('No snapshot for this month')
  ).toBeInTheDocument();
  expect(api.getSnapshots).toHaveBeenCalledOnce();
  expect(api.getSalaryRecords).toHaveBeenCalledOnce();
  expect(api.getExpenses).toHaveBeenCalledOnce();
});
it('shows pending rather than ready or missing steps while a source is unresolved', async () => {
  api.getExpenses.mockReturnValue(new Promise(() => {}));
  mountReview();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading your monthly records'
  );
  await waitFor(() => expect(api.getSalaryRecords).toHaveBeenCalledOnce());
  expect(
    screen.queryByRole('button', { name: 'Sources and next steps' })
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Not recorded')).not.toBeInTheDocument();
});
it('hides steps on read failure and retries only the failed source', async () => {
  api.getSalaryRecords
    .mockRejectedValueOnce(new Error('Synthetic private details'))
    .mockResolvedValue([income]);
  mountReview();
  const retry = await screen.findByRole('button', {
    name: 'Retry monthly review',
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Couldn't load your monthly review"
  );
  expect(
    screen.queryByText('Synthetic private details')
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('list', { name: 'Monthly review steps' })
  ).not.toBeInTheDocument();
  await userEvent.click(retry);
  expect(
    within(await openSteps()).getByText('Salary record available')
  ).toBeInTheDocument();
  expect(api.getSalaryRecords).toHaveBeenCalledTimes(2);
  expect(api.getSnapshots).toHaveBeenCalledOnce();
  expect(api.getExpenses).toHaveBeenCalledOnce();
});
it('opens the named disclosure with keyboard and tabs through the existing review links', async () => {
  mountReview();
  const trigger = await screen.findByRole('button', {
    name: 'Sources and next steps',
  });
  const user = userEvent.setup();
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(
    screen.getByRole('list', { name: 'Monthly review steps' })
  ).toBeInTheDocument();
  for (const name of [
    'Compare salary with your payslip',
    'Compare expenses with your statement',
    'Review month-end balances',
  ]) {
    await user.tab();
    expect(screen.getByRole('link', { name })).toHaveFocus();
  }
});

it('explains exact contributing values without exposing split names', async () => {
  api.getSalaryRecords.mockResolvedValue([
    { ...income, salary: 100.1, bonus: 0.2 },
  ]);
  api.getSnapshots.mockResolvedValue([
    {
      ...snapshot,
      id: '2025-12',
      entries: [
        { category: 'savings', account: 'Synthetic account', amount: 80 },
      ],
    },
    {
      ...snapshot,
      entries: [
        { category: 'savings', account: 'Synthetic account', amount: 100 },
      ],
    },
  ]);
  api.getExpenses.mockResolvedValue([
    {
      ...expense,
      amount: 100.1,
      splitType: 'shared',
      splits: [
        { person: 'Never display this person', amount: 25.05, settled: true },
      ],
    },
  ]);
  mountReview();
  await openSteps();
  const sources = screen.getByRole('region', { name: 'Contributing records' });
  expect(
    within(sources).getByText('Salary: $100.10 · Bonus: $0.20')
  ).toBeInTheDocument();
  expect(
    within(sources).getByText(
      'Gross: $100.10 · Other shares: $25.05 · Your share: $75.05'
    )
  ).toBeInTheDocument();
  expect(within(sources).getByText('2025-12: $80.00')).toBeInTheDocument();
  expect(within(sources).getByText('2026-01: $100.00')).toBeInTheDocument();
  expect(
    screen.queryByText(/Never display this person/)
  ).not.toBeInTheDocument();
});

it('bounds source rows while retaining all-record totals and resets pagination on month change', async () => {
  api.getExpenses.mockResolvedValue([
    ...Array.from({ length: 21 }, (_, index) => ({
      ...expense,
      id: `expense-${index}`,
      item: `Source ${index}`,
      amount: 1,
    })),
    {
      ...expense,
      id: 'february',
      item: 'February source',
      date: '2026-02-01',
      amount: 5,
    },
  ]);
  mountReview();
  await openSteps();
  const rows = screen.getByRole('list', { name: 'Contributing expenses' });
  expect(within(rows).getAllByRole('listitem')).toHaveLength(20);
  expect(screen.getByText('Showing 1–20 of 21 expenses')).toBeInTheDocument();
  expect(screen.getByText('$21.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(within(rows).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('Source 20')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Month'), {
    target: { value: '2026-02' },
  });
  expect(screen.getByText('February source')).toBeInTheDocument();
  expect(
    await screen.findByText('Showing 1–1 of 1 expense')
  ).toBeInTheDocument();
  expect(api.getExpenses).toHaveBeenCalledTimes(1);
});

it('clamps a source page when cached expenses shrink and shows invalid personal rows truthfully', async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...expense,
    id: `row-${index}`,
    item: `Row ${index}`,
  }));
  api.getExpenses.mockResolvedValue(rows);
  mountReview();
  await openSteps();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Row 20')).toBeInTheDocument();
  await act(async () => {
    client.setQueryData(
      ['expenses'],
      [
        {
          ...rows[0],
          amount: 1,
          splitType: 'shared',
          splits: [{ person: 'Secret split name', amount: 2, settled: false }],
        },
      ]
    );
  });
  expect(
    await screen.findByText('Showing 1–1 of 1 expense')
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Gross: $1.00 · Other shares: $2.00 · Your share: Check shared splits'
    )
  ).toBeInTheDocument();
  expect(screen.queryByText(/Secret split name/)).not.toBeInTheDocument();
});

it('keeps unnamed source records identifiable without fabricating their label', async () => {
  api.getExpenses.mockResolvedValue([{ ...expense, item: '   ' }]);
  mountReview();
  await openSteps();
  expect(screen.getByText('Unnamed expense')).toBeInTheDocument();
});
