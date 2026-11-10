// @vitest-environment jsdom
import { BudgetField } from '@/features/household/components/budget-field';
import type { PlannerSplit } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const BUDGET_ID = '77777777-7777-4777-8777-777777777777';

const split: PlannerSplit = {
  members: { [ME]: 50, [PARTNER]: 50 },
  goalOverrides: {},
  budgetOverrides: {},
  isDefault: false,
  userId: ME,
};

const planner = vi.hoisted(() => ({
  getPlannerSplit: vi.fn(),
  setPlannerSplit: vi.fn(),
}));
const budgets = vi.hoisted(() => ({
  setCategoryBudget: vi.fn(),
  deleteCategoryBudget: vi.fn(),
  getSpendingBudgets: vi.fn(),
}));
const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/features/household/actions/planner-actions', () => planner);
vi.mock('@/features/household/actions/budget-actions', () => budgets);
vi.mock('sonner', () => ({ toast: notices }));
vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: false,
    canReveal: () => true,
    mask: (value: string) => value,
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  planner.getPlannerSplit.mockResolvedValue(split);
  budgets.getSpendingBudgets.mockResolvedValue([]);
});
afterEach(cleanup);

it('tells the user when the budget saved but its split did not, even though the form closes', async () => {
  budgets.setCategoryBudget.mockResolvedValue(BUDGET_ID);
  planner.setPlannerSplit.mockRejectedValue(new Error('boom'));
  const onDone = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <BudgetField
        category="Groceries"
        options={[]}
        entries={[]}
        currentMonth="2026-11"
        onDone={onDone}
      />
    </QueryClientProvider>
  );
  const user = userEvent.setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument()
  );
  await user.type(screen.getByLabelText('Monthly budget (SGD)'), '200');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(planner.setPlannerSplit).toHaveBeenCalled();
  expect(notices.error).toHaveBeenCalledWith(
    expect.stringContaining('Could not save the split')
  );
});
