// @vitest-environment jsdom
import { ProjectBreakdown } from '@/features/household/components/project-breakdown';
import type { HouseholdGoal } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getGoals: vi.fn(),
  addGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteGoalItem: vi.fn(),
  deleteItemPayment: vi.fn(),
}));
vi.mock('@/features/household/actions/goal-actions', () => actions);
vi.mock('@/features/household/actions/household-actions', () => ({}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const goal: HouseholdGoal = {
  id: 'g1',
  name: 'Wedding',
  targetAmount: 10000,
  targetDate: null,
  createdAt: '2026-10-01',
  contributions: [],
  contributed: 0,
  remaining: 10000,
  pct: 0,
  items: [
    {
      id: 'i1',
      name: 'Venue',
      budget: 8000,
      paid: 9000,
      remaining: 0,
      over: 1000,
      payments: [
        {
          id: 'p1',
          amount: 9000,
          note: null,
          date: '2026-10-02',
          isSelf: false,
        },
      ],
    },
    {
      id: 'i2',
      name: 'Photographer',
      budget: 3000,
      paid: 0,
      remaining: 3000,
      over: 0,
      payments: [],
    },
  ],
  budgeted: 11000,
  paid: 9000,
};

function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <ProjectBreakdown goal={goal} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.getGoals.mockResolvedValue([goal]);
  actions.addGoalItem.mockResolvedValue(undefined);
  actions.addItemPayment.mockResolvedValue(undefined);
  actions.deleteItemPayment.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('summarises the breakdown collapsed and expands to show over-budget items', async () => {
  mount();
  const toggle = screen.getByRole('button', { name: /Breakdown/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveTextContent('2 items');
  expect(screen.queryByText('Venue')).toBeNull();
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Venue')).toBeInTheDocument();
  expect(screen.getByText(/Over by .*1,000\.00/)).toBeInTheDocument();
  expect(screen.getByText(/3,000\.00 left/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/above the .* target/);
});

it('adds an item with a trimmed name and parsed budget', async () => {
  mount();
  await userEvent.click(screen.getByRole('button', { name: /Breakdown/ }));
  await userEvent.type(screen.getByLabelText('New item name'), '  Flowers ');
  await userEvent.type(screen.getByLabelText('New item budget'), '1200.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  await waitFor(() =>
    expect(actions.addGoalItem).toHaveBeenCalledWith(
      { goalId: 'g1', name: 'Flowers', budget: 1200.5 },
      expect.anything()
    )
  );
});

it('records a payment against an item with the chosen date', async () => {
  mount();
  await userEvent.click(screen.getByRole('button', { name: /Breakdown/ }));
  const [, photographerPay] = screen.getAllByRole('button', {
    name: 'Record payment',
  });
  await userEvent.click(photographerPay);
  await userEvent.type(
    screen.getByLabelText('Payment amount for Photographer'),
    '500'
  );
  const date = screen.getByLabelText('Payment date for Photographer');
  await userEvent.clear(date);
  await userEvent.type(date, '2026-10-20');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(actions.addItemPayment).toHaveBeenCalledWith(
      { itemId: 'i2', amount: 500, date: '2026-10-20' },
      expect.anything()
    )
  );
});

it('deletes a single payment', async () => {
  mount();
  await userEvent.click(screen.getByRole('button', { name: /Breakdown/ }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Delete payment on 2026-10-02' })
  );
  await waitFor(() =>
    expect(actions.deleteItemPayment).toHaveBeenCalledWith(
      'p1',
      expect.anything()
    )
  );
});
