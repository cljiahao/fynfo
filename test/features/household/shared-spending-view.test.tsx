// @vitest-environment jsdom
import { SharedSpending } from '@/features/household/components/shared-spending';
import type { HouseholdSpace } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getSpaces: vi.fn(),
  createSpace: vi.fn(),
  deleteSpace: vi.fn(),
  addSpending: vi.fn(),
  deleteSpending: vi.fn(),
}));
vi.mock('@/features/household/actions/spending-actions', () => actions);
vi.mock('@/features/household/actions/goal-actions', () => ({}));
vi.mock('@/features/household/actions/household-actions', () => ({}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const month = format(new Date(), 'yyyy-MM');
const spaces: HouseholdSpace[] = [
  {
    id: 'home',
    kind: 'ongoing',
    name: 'Household',
    startDate: null,
    endDate: null,
    entries: [
      {
        id: 'e1',
        date: `${month}-02`,
        category: 'Groceries',
        amount: 100,
        note: null,
        isSelf: true,
      },
      {
        id: 'e2',
        date: `${month}-03`,
        category: 'Utilities',
        amount: 40,
        note: 'SP',
        isSelf: false,
      },
      {
        id: 'old',
        date: '2001-01-01',
        category: 'Old',
        amount: 999,
        note: null,
        isSelf: true,
      },
    ],
  },
  {
    id: 'japan',
    kind: 'trip',
    name: 'Japan',
    startDate: '2026-12-01',
    endDate: '2026-12-10',
    entries: [],
  },
];

function mount(data: HouseholdSpace[]) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <SharedSpending spaces={data} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.getSpaces.mockResolvedValue(spaces);
  actions.addSpending.mockResolvedValue(undefined);
  actions.createSpace.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('offers one click to start when nothing is tracked yet', async () => {
  mount([]);
  await userEvent.click(
    screen.getByRole('button', { name: 'Start shared spending' })
  );
  await waitFor(() =>
    expect(actions.createSpace).toHaveBeenCalledWith(
      { kind: 'ongoing', name: 'Household' },
      expect.anything()
    )
  );
});

it("summarises only this month's household spending with an even-split settle-up", () => {
  mount(spaces);
  expect(screen.getAllByText(/\$140\.00/).length).toBeGreaterThan(0);
  expect(
    screen.getByText(/Partner owes you .*30\.00 to split evenly/)
  ).toBeInTheDocument();
  expect(screen.queryByText('Old')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
});

it('quick-adds spending, then keeps space and category for the next entry', async () => {
  mount(spaces);
  await userEvent.selectOptions(screen.getByLabelText('For'), 'japan');
  await userEvent.type(screen.getByLabelText('Category'), 'Hotel');
  await userEvent.type(screen.getByLabelText('Amount (SGD)'), '640.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(actions.addSpending).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'japan',
        category: 'Hotel',
        amount: 640.5,
      }),
      expect.anything()
    )
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Amount (SGD)')).toHaveValue(null)
  );
  expect(screen.getByLabelText('Category')).toHaveValue('Hotel');
  expect(screen.getByLabelText('For')).toHaveValue('japan');
});

it('rejects a trip that ends before it starts without calling the server', async () => {
  mount(spaces);
  await userEvent.type(screen.getByLabelText('New trip name'), 'Bali');
  await userEvent.type(screen.getByLabelText('Trip start date'), '2027-03-10');
  await userEvent.type(screen.getByLabelText('Trip end date'), '2027-03-01');
  await userEvent.click(screen.getByRole('button', { name: 'Add trip' }));
  expect(actions.createSpace).not.toHaveBeenCalled();
});
