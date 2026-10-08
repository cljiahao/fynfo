// @vitest-environment jsdom
import { CategoryBreakdown } from '@/features/assets/components/category-breakdown';
import { SnapshotForm } from '@/features/assets/components/snapshot-form';
import { SnapshotTable } from '@/features/assets/components/snapshot-table';
import { useChartData } from '@/features/assets/hooks/use-chart-data';
import type { SnapshotData } from '@/features/assets/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const external = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
  upsertSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  push: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => external);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: external.push }),
}));
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
const snapshot: SnapshotData = {
  id: '2026-01',
  entries: [
    { category: 'savings', account: 'Bank', amount: 100 },
    { category: 'stocks', account: 'SG', amount: 200 },
    { category: 'etf', account: 'US', amount: 300 },
    { category: 'pension', account: 'Other', amount: 400 },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  external.getSnapshots.mockResolvedValue([]);
  external.upsertSnapshot.mockResolvedValue(undefined);
  external.deleteSnapshot.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('aggregates categories and limits chart history without modifying the input', () => {
  const records = [{ ...snapshot, id: '2025-12' }, snapshot];
  const { result, rerender } = renderHook(
    ({
      items,
      months,
    }: {
      items: SnapshotData[] | undefined;
      months: number;
    }) => useChartData(items, months),
    {
      initialProps: { items: records as SnapshotData[] | undefined, months: 1 },
    }
  );
  expect(result.current).toEqual([
    {
      month: 'Jan 2026',
      id: '2026-01',
      savings: 100,
      bonds: 0,
      stocks: 200,
      etf: 300,
      non_equity: 0,
      crypto: 0,
      pension: 400,
      total: 1000,
      total_investment: 500,
      excl_pension: 600,
    },
  ]);
  expect(records).toHaveLength(2);
  rerender({ items: undefined, months: 12 });
  expect(result.current).toEqual([]);
});

it('shows category sums and percentages and handles no snapshot and zero total', () => {
  const { rerender } = mount(<CategoryBreakdown snapshot={snapshot} />);
  expect(screen.getByText('$200')).toBeTruthy();
  expect(screen.getByText('20%')).toBeTruthy();
  expect(screen.queryByText('CPF Breakdown')).toBeNull();
  rerender(<CategoryBreakdown snapshot={{ id: '2026-02', entries: [] }} />);
  expect(screen.getAllByText('0%')).toHaveLength(7);
  rerender(<CategoryBreakdown snapshot={undefined} />);
  expect(screen.getByText('No data for current month')).toBeTruthy();
});

it('renders desktop categories and mobile combined investments, and sends edit/delete the original month', async () => {
  mount(<SnapshotTable snapshots={[snapshot]} />);
  const tables = screen.getAllByRole('table');
  expect(within(tables[0]).getByText('$1,000')).toBeTruthy();
  expect(within(tables[1]).getByText('$500')).toBeTruthy();
  fireEvent.click(
    within(tables[0]).getByRole('button', { name: 'Edit snapshot' })
  );
  expect(external.push).toHaveBeenCalledWith('/dashboard/entry?edit=2026-01');
  fireEvent.click(
    within(tables[1]).getByRole('button', { name: 'Delete snapshot' })
  );
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: /^Delete$/ })
  );
  await waitFor(() =>
    expect(external.deleteSnapshot).toHaveBeenCalledWith('2026-01')
  );
});

it('shows latest snapshots first and paginates without altering caller order', () => {
  const records = Array.from({ length: 11 }, (_, i) => ({
    ...snapshot,
    id: `2026-${String(i + 1).padStart(2, '0')}`,
  }));
  mount(<SnapshotTable snapshots={records} />);
  expect(screen.getAllByText('2026-11')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getAllByText('2026-01')).toHaveLength(2);
  expect(screen.queryByText('2026-11')).toBeNull();
  expect(records[0].id).toBe('2026-01');
});

it('offers an empty state when no snapshot exists', () => {
  mount(<SnapshotTable snapshots={[]} />);
  expect(screen.getByText('No snapshots recorded yet')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});

it('prefills account names without copying balances and saves trimmed positive entries', async () => {
  external.getSnapshots.mockResolvedValue([snapshot]);
  mount(<SnapshotForm />);
  await screen.findByRole('button', { name: 'Save Snapshot' });
  expect(
    (screen.getAllByPlaceholderText('Account name')[0] as HTMLInputElement)
      .value
  ).toBe('Bank');
  expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).toBe(
    ''
  );
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-02' },
  });
  // Remove inherited investment/pension accounts to leave one deliberate entry.
  const accounts = screen.getAllByPlaceholderText('Account name');
  for (const account of accounts)
    fireEvent.change(account, { target: { value: '' } });
  fireEvent.change(accounts[0], { target: { value: '  Primary bank  ' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '1250.50' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Snapshot' }));
  await waitFor(() =>
    expect(external.upsertSnapshot).toHaveBeenCalledWith(
      {
        id: '2026-02',
        entries: [
          { category: 'savings', account: 'Primary bank', amount: 1250.5 },
        ],
      },
      undefined
    )
  );
  expect(external.push).toHaveBeenCalledWith('/dashboard/assets');
});

it('blocks duplicate month writes, supports adding/removing rows, and cancels without saving', async () => {
  external.getSnapshots.mockResolvedValue([snapshot]);
  mount(<SnapshotForm />);
  await screen.findByRole('button', { name: 'Save Snapshot' });
  await waitFor(() =>
    expect(screen.getAllByPlaceholderText('Account name')[0]).toHaveProperty(
      'value',
      'Bank'
    )
  );
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-01' },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Save Snapshot',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  );
  expect(
    screen.getByText('A snapshot for this month already exists.')
  ).toBeTruthy();
  const count = screen.getAllByPlaceholderText('Account name').length;
  fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[0]);
  expect(screen.getAllByPlaceholderText('Account name')).toHaveLength(
    count + 1
  );
  const added =
    screen.getAllByPlaceholderText('Account name')[1].parentElement!;
  fireEvent.click(within(added).getByRole('button'));
  expect(screen.getAllByPlaceholderText('Account name')).toHaveLength(count);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(external.push).toHaveBeenCalledWith('/dashboard/assets');
  expect(external.upsertSnapshot).not.toHaveBeenCalled();
});

it('returns to assets after successfully updating an existing snapshot', async () => {
  external.getSnapshot.mockResolvedValue(snapshot);
  external.getSnapshots.mockResolvedValue([snapshot]);
  mount(<SnapshotForm editId="2026-01" />);
  await screen.findByRole('button', { name: 'Update Snapshot' });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '150' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update Snapshot' }));
  await waitFor(() =>
    expect(external.push).toHaveBeenCalledWith('/dashboard/assets')
  );
  expect(external.upsertSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ id: '2026-01' }),
    '2026-01'
  );
});

it('retains original snapshot identity when month is edited and does not navigate on failed write', async () => {
  external.getSnapshot.mockResolvedValue(snapshot);
  external.getSnapshots.mockResolvedValue([snapshot]);
  external.upsertSnapshot.mockRejectedValue(new Error('offline'));
  mount(<SnapshotForm editId="2026-01" />);
  await screen.findByRole('button', { name: 'Update Snapshot' });
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-03' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update Snapshot' }));
  await waitFor(() =>
    expect(external.upsertSnapshot).toHaveBeenCalledWith(
      { ...snapshot, id: '2026-03' },
      '2026-01'
    )
  );
  expect(external.push).not.toHaveBeenCalled();
});
