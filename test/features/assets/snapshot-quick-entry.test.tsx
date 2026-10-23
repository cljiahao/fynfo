// @vitest-environment jsdom
import { SnapshotForm } from '@/features/assets/components/snapshot-form';
import type { SnapshotRecord } from '@/features/assets/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { format } from 'date-fns';
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
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
const previous: SnapshotRecord = {
  snapshotId: 'fixture-parent',
  revision: '1',
  id: '2026-01',
  entries: [
    { category: 'savings', account: 'Bank', amount: 100 },
    { category: 'stocks', account: 'SG', amount: 200 },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  external.getSnapshots.mockResolvedValue([previous]);
  external.getSnapshot.mockResolvedValue(previous);
  external.upsertSnapshot.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

it("shows last month's amount as the placeholder for carried accounts", async () => {
  mount(<SnapshotForm />);
  const amount = () => screen.getByLabelText('Savings amount 1');
  await waitFor(() =>
    expect(amount().getAttribute('placeholder')).toMatch(/^Last: .*100\.00$/)
  );
  expect((amount() as HTMLInputElement).value).toBe('');
});

it('copies only blank amounts and keeps values already typed', async () => {
  mount(<SnapshotForm />);
  const savings = () => screen.getByLabelText('Savings amount 1');
  await waitFor(() =>
    expect(savings().getAttribute('placeholder')).toMatch(/^Last:/)
  );
  fireEvent.change(savings(), { target: { value: '150' } });
  fireEvent.click(screen.getByRole('button', { name: /Copy 2026-01 amounts/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Snapshot' }));
  await waitFor(() => expect(external.upsertSnapshot).toHaveBeenCalledOnce());
  expect(external.upsertSnapshot.mock.calls[0][0].entries).toEqual([
    { category: 'savings', account: 'Bank', amount: 150 },
    { category: 'stocks', account: 'SG', amount: 200 },
  ]);
});

it('offers no copy when editing or when there is no earlier snapshot', async () => {
  const editing = mount(<SnapshotForm editId="2026-01" />);
  await screen.findByRole('button', { name: 'Update Snapshot' });
  expect(screen.queryByRole('button', { name: /Copy .* amounts/ })).toBeNull();
  expect(
    screen.getByLabelText('Savings amount 1').getAttribute('placeholder')
  ).toBe('0.00');
  editing.unmount();

  external.getSnapshots.mockResolvedValue([]);
  mount(<SnapshotForm />);
  await screen.findByRole('button', { name: 'Save Snapshot' });
  expect(screen.queryByRole('button', { name: /Copy .* amounts/ })).toBeNull();
});

it('links a duplicate month to its edit page', async () => {
  const month = format(new Date(), 'yyyy-MM');
  external.getSnapshots.mockResolvedValue([{ ...previous, id: month }]);
  mount(<SnapshotForm />);
  const link = await screen.findByRole('link', {
    name: `Edit ${month} instead`,
  });
  expect(link.getAttribute('href')).toBe(`/dashboard/entry?edit=${month}`);
});
