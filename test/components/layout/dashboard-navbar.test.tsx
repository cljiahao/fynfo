// @vitest-environment jsdom
import { DashboardNavbar } from '@/components/layout/dashboard-navbar';
import '@/features/search/components/record-search-task';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(async () => []),
  getSalaryRecords: vi.fn(async () => []),
  getExpenses: vi.fn(async () => []),
  getTrades: vi.fn(async () => []),
  getDividends: vi.fn(async () => []),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/dividend-actions', () => api);
const route = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

let client: QueryClient;
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  route.pathname = '/dashboard';
});
function mountNavbar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardNavbar />
    </QueryClientProvider>
  );
}
it('keeps the closed navbar from reading financial histories', () => {
  mountNavbar();
  for (const read of Object.values(api)) expect(read).not.toHaveBeenCalled();
});
it('closes and resets search on pathname changes without clearing financial history', async () => {
  const view = mountNavbar();
  await userEvent.click(screen.getByRole('button', { name: 'Search records' }));
  const input = await screen.findByLabelText('Search your records');
  await userEvent.type(input, 'Synthetic private term');
  client.setQueryData(['retained-history'], ['Synthetic retained']);
  route.pathname = '/dashboard/assets';
  view.rerender(
    <QueryClientProvider client={client}>
      <DashboardNavbar />
    </QueryClientProvider>
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(client.getQueryData(['retained-history'])).toEqual([
    'Synthetic retained',
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'Search records' }));
  expect(await screen.findByLabelText('Search your records')).toHaveValue('');
});
it('opens an explicit personal record search rather than duplicating navigation links', async () => {
  mountNavbar();
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Search records' })[0]
  );
  expect(
    screen.getByRole('dialog', { name: 'Search records' })
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('textbox', { name: 'Search your records' })
  ).toBeInTheDocument();
});
