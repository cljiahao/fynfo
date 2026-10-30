// @vitest-environment jsdom
import { GoalList } from '@/features/household/components/goal-list';
import { useGoals } from '@/features/household/hooks/use-household';
import { computeGoalProgress } from '@/features/household/lib/goal-progress';
import type { HouseholdGoal } from '@/features/household/types';
import { AmountVisibilityProvider } from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const external = vi.hoisted(() => ({
  getGoals: vi.fn(),
  updateGoal: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/features/household/actions/goal-actions', () => ({
  getGoals: external.getGoals,
  updateGoal: external.updateGoal,
  createGoal: vi.fn(),
  addContribution: vi.fn(),
  deleteGoal: vi.fn(),
  addGoalItem: vi.fn(),
  deleteGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteItemPayment: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: external.toastError, success: external.toastSuccess },
}));

const CONTRIBUTED = 300;

function makeGoal(target: number, targetDate: string | null): HouseholdGoal {
  const progress = computeGoalProgress(target, [CONTRIBUTED]);
  return {
    id: 'synthetic-goal',
    name: 'Synthetic sofa',
    targetAmount: target,
    targetDate,
    createdAt: '2026-10-10',
    items: [],
    budgeted: 0,
    paid: 0,
    contributions: [
      {
        id: 'synthetic-contribution',
        amount: CONTRIBUTED,
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

function Harness() {
  const { data } = useGoals(true);
  return <GoalList goals={data ?? []} />;
}

function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AmountVisibilityProvider>
        <Harness />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

async function openEditor() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit goal Synthetic sofa' })
  );
  return screen.findByRole('dialog');
}

beforeEach(() => {
  external.getGoals.mockResolvedValue([makeGoal(1000, '2026-12-01T00:00:00Z')]);
  external.updateGoal.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('household goal editing', () => {
  it('opens the dialog prefilled in edit mode', async () => {
    mount();
    const dialog = await openEditor();
    expect(dialog).toHaveTextContent('Edit goal');
    expect(screen.getByLabelText('Name')).toHaveValue('Synthetic sofa');
    expect(screen.getByLabelText('Target amount (SGD)')).toHaveValue(1000);
    expect(screen.getByLabelText('Target date (optional)')).toHaveValue(
      '2026-12-01'
    );
    expect(
      screen.getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });

  it('saves edited values with the goal id and refreshes the card', async () => {
    mount();
    await openEditor();
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  Synthetic bed ' },
    });
    fireEvent.change(screen.getByLabelText('Target amount (SGD)'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('Target date (optional)'), {
      target: { value: '' },
    });
    external.getGoals.mockResolvedValue([makeGoal(500, null)]);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(external.updateGoal).toHaveBeenCalled());
    expect(external.updateGoal.mock.calls[0][0]).toEqual({
      goalId: 'synthetic-goal',
      name: 'Synthetic bed',
      targetAmount: 500,
      targetDate: undefined,
    });
    await waitFor(() =>
      expect(external.toastSuccess).toHaveBeenCalledWith('Goal updated')
    );
    expect(await screen.findByText(/of .*500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/200\.00 to go/)).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('shows Funded when the new target is at or below the contributions', async () => {
    mount();
    await openEditor();
    fireEvent.change(screen.getByLabelText('Target amount (SGD)'), {
      target: { value: '250' },
    });
    external.getGoals.mockResolvedValue([makeGoal(250, null)]);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Funded')).toBeInTheDocument();
    expect(screen.getByText('Goal reached')).toBeInTheDocument();
  });

  it('keeps the dialog open and toasts an error when saving fails', async () => {
    external.updateGoal.mockRejectedValue(new Error('boom'));
    mount();
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(external.toastError).toHaveBeenCalledWith(
        'Could not update the goal'
      )
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(external.toastSuccess).not.toHaveBeenCalled();
  });
});
