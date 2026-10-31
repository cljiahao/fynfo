// @vitest-environment jsdom
import { GoalList } from '@/features/household/components/goal-list';
import { UndoableDeleteProvider } from '@/features/household/hooks/use-undoable-delete';
import { computeGoalProgress } from '@/features/household/lib/goal-progress';
import type { HouseholdGoal } from '@/features/household/types';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const external = vi.hoisted(() => ({
  deleteGoal: vi.fn(),
  addContribution: vi.fn(),
  createGoal: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/features/household/actions/goal-actions', () => ({
  getGoals: vi.fn(),
  updateGoal: vi.fn(),
  createGoal: external.createGoal,
  addContribution: external.addContribution,
  deleteGoal: external.deleteGoal,
  addGoalItem: vi.fn(),
  deleteGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteItemPayment: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: external.toastError, success: external.toastSuccess },
}));

function makeGoal(id: string, name: string, target: number): HouseholdGoal {
  const progress = computeGoalProgress(target, [300]);
  return {
    id,
    name,
    targetAmount: target,
    targetDate: null,
    createdAt: '2026-10-10',
    items: [],
    budgeted: 0,
    paid: 0,
    contributions: [
      {
        id: `${id}-c`,
        amount: 300,
        note: null,
        date: '2026-10-10',
        isSelf: true,
      },
    ],
    contributed: progress.contributed,
    remaining: progress.remaining,
    pct: progress.pct,
  };
}

function mount(goals: HouseholdGoal[], onCreate?: () => void) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AmountVisibilityProvider>
        <UndoableDeleteProvider>
          <GoalList goals={goals} onCreate={onCreate} />
        </UndoableDeleteProvider>
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('goal list', () => {
  it('spans both columns for a sole goal only', () => {
    mount([makeGoal('a', 'Sofa', 1000)]);
    expect(
      screen
        .getByRole('heading', { level: 2, name: 'Sofa' })
        .closest('.grid > *')
    ).toHaveClass('sm:col-span-2');
    cleanup();
    mount([makeGoal('a', 'Sofa', 1000), makeGoal('b', 'Bed', 800)]);
    for (const name of ['Sofa', 'Bed']) {
      expect(
        screen.getByRole('heading', { level: 2, name }).closest('.grid > *')
      ).not.toHaveClass('sm:col-span-2');
    }
  });

  it('opens a confirm dialog and only deletes after Confirm', async () => {
    external.deleteGoal.mockResolvedValue(undefined);
    mount([
      {
        ...makeGoal('a', 'Sofa', 1000),
        items: [
          {
            id: 'i1',
            name: 'Frame',
            budget: 10,
            payments: [],
            paid: 0,
            remaining: 10,
            over: 0,
          },
        ],
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete goal Sofa' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('1 contribution and 1 budget item');
    expect(external.deleteGoal).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
    expect(external.deleteGoal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete goal Sofa' }));
    const again = await screen.findByRole('alertdialog');
    const confirm = within(again).getByRole('button', { name: 'Delete goal' });
    expect(confirm.className).toContain('bg-destructive');
    fireEvent.click(confirm);
    await waitFor(() => expect(external.deleteGoal).toHaveBeenCalledTimes(1));
    expect(external.deleteGoal.mock.calls[0][0]).toBe('a');
  });

  it('shows an empty state whose New goal button opens the create dialog', async () => {
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: 'New goal' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('New goal');
  });

  it('does not open the create dialog from the empty state while amounts are hidden', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AmountVisibilityProvider>
          <AmountVisibilityToggle />
          <UndoableDeleteProvider>
            <GoalList goals={[]} />
          </UndoableDeleteProvider>
        </AmountVisibilityProvider>
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    fireEvent.click(screen.getByRole('button', { name: 'New goal' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('delegates the empty-state button to onCreate when given', () => {
    const onCreate = vi.fn();
    mount([], onCreate);
    fireEvent.click(screen.getByRole('button', { name: 'New goal' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('goal dialogs inline errors', () => {
  it('create-goal shows field errors, focuses the first, and clears on edit', async () => {
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: 'New goal' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Create goal' }));

    const name = screen.getByLabelText('Name');
    const amount = screen.getByLabelText('Target amount (SGD)');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    expect(screen.getByText('Enter a name')).toHaveAttribute(
      'id',
      name.getAttribute('aria-describedby')
    );
    expect(screen.getByText('Enter an amount above 0')).toHaveAttribute(
      'id',
      amount.getAttribute('aria-describedby')
    );
    expect(external.toastError).not.toHaveBeenCalled();
    expect(external.createGoal).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: 'Sofa' } });
    expect(name).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Enter a name')).not.toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
  });

  it('add-contribution shows an amount error, focuses it, and clears on edit', async () => {
    mount([makeGoal('a', 'Sofa', 1000)]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to goal' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Add contribution' }));

    const amount = screen.getByLabelText('Amount (SGD)');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveFocus();
    expect(screen.getByText('Enter an amount above 0')).toHaveAttribute(
      'id',
      amount.getAttribute('aria-describedby')
    );
    expect(external.toastError).not.toHaveBeenCalled();
    expect(external.addContribution).not.toHaveBeenCalled();

    fireEvent.change(amount, { target: { value: '5' } });
    expect(amount).not.toHaveAttribute('aria-invalid');
  });

  it('add-contribution flags a cleared date', async () => {
    mount([makeGoal('a', 'Sofa', 1000)]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to goal' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Amount (SGD)'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add contribution' }));
    expect(screen.getByLabelText('Date')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByText('Pick a date')).toBeInTheDocument();
  });
});
