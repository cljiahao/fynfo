// @vitest-environment jsdom
import { AddGoalItemDialog } from '@/features/household/components/add-goal-item-dialog';
import type { HouseholdGoal } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getGoals: vi.fn(),
  saveGoal: vi.fn(),
}));
vi.mock('@/features/household/actions/goal-actions', () => actions);
vi.mock('@/features/household/actions/household-actions', () => ({
  getHousehold: vi.fn().mockResolvedValue(null),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: false,
    canReveal: () => true,
    mask: (value: string) => value,
  }),
  AmountsHiddenNotice: () => null,
}));

const goal: HouseholdGoal = {
  id: '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b',
  name: 'Wedding',
  targetAmount: 10000,
  targetDate: null,
  createdAt: '2026-10-01',
  contributions: [],
  contributed: 0,
  remaining: 10000,
  pct: 0,
  budgeted: 0,
  paid: 0,
  items: [],
};

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AddGoalItemDialog goal={goal} open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.saveGoal.mockResolvedValue({
    ok: true,
    goalId: goal.id,
    itemIds: [],
  });
});
afterEach(cleanup);

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Item'), 'Venue');
  await user.type(screen.getByLabelText(/Estimate/), '8000');
}

it('submits the typed description with the new item', async () => {
  const user = userEvent.setup();
  mount();
  await fillRequired(user);
  await user.type(screen.getByLabelText(/Description/), '  Main hall  ');
  await user.click(screen.getByRole('button', { name: 'Add item' }));

  await waitFor(() => expect(actions.saveGoal).toHaveBeenCalled());
  const [payload] = actions.saveGoal.mock.calls[0] as [
    { items: Array<{ name: string; description?: string | null }> },
  ];
  expect(payload.items[0]).toMatchObject({
    name: 'Venue',
    description: 'Main hall',
  });
});

it('submits without a description when the field is left blank', async () => {
  const user = userEvent.setup();
  mount();
  await fillRequired(user);
  await user.click(screen.getByRole('button', { name: 'Add item' }));

  await waitFor(() => expect(actions.saveGoal).toHaveBeenCalled());
  const [payload] = actions.saveGoal.mock.calls[0] as [
    { items: Array<{ description?: string | null }> },
  ];
  expect(payload.items[0]?.description ?? '').toBe('');
});

it('limits the description to 120 characters', () => {
  mount();
  expect(screen.getByLabelText(/Description/)).toHaveAttribute(
    'maxLength',
    '120'
  );
});
