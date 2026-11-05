// @vitest-environment jsdom
import { GoalList } from '@/features/household/components/goal-list';
import { useGoals } from '@/features/household/hooks/use-household';
import { UndoableDeleteProvider } from '@/features/household/hooks/use-undoable-delete';
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
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const external = vi.hoisted(() => ({
  getGoals: vi.fn(),
  saveGoal: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/features/household/actions/goal-actions', () => ({
  getGoals: external.getGoals,
  updateGoal: vi.fn(),
  saveGoal: external.saveGoal,
  createGoal: vi.fn(),
  addContribution: vi.fn(),
  deleteGoal: vi.fn(),
  addGoalItem: vi.fn(),
  deleteGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteItemPayment: vi.fn(),
  updateGoalPayment: vi.fn(),
  updateGoalContribution: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: external.toastError, success: external.toastSuccess },
}));

const CONTRIBUTED = 300;
const GOAL_ID = '11111111-1111-4111-8111-111111111111';

function makeGoal(target: number, targetDate: string | null): HouseholdGoal {
  const progress = computeGoalProgress(target, [CONTRIBUTED]);
  return {
    id: GOAL_ID,
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
        <UndoableDeleteProvider>
          <Harness />
        </UndoableDeleteProvider>
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

async function openEditor() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Goal actions' })
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  return screen.findByRole('dialog');
}

beforeEach(() => {
  external.getGoals.mockResolvedValue([makeGoal(1000, '2026-12-01T00:00:00Z')]);
  external.saveGoal.mockResolvedValue({
    ok: true,
    goalId: GOAL_ID,
    itemIds: [],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('household goal editing', () => {
  it('opens the sheet prefilled in edit mode', async () => {
    mount();
    const dialog = await openEditor();
    expect(dialog).toHaveTextContent('Edit goal');
    expect(screen.getByLabelText('Name')).toHaveValue('Synthetic sofa');
    expect(screen.getByLabelText('Target amount (SGD)')).toHaveDisplayValue(
      '1000.00'
    );
    expect(screen.getByLabelText('Target date (optional)')).toHaveValue(
      '2026-12-01'
    );
    expect(
      screen.getByRole('button', { name: 'Review changes' })
    ).toBeInTheDocument();
  });

  it('shows the delta, saves with the goal id and refreshes the card', async () => {
    mount();
    await openEditor();
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Synthetic bed' },
    });
    fireEvent.change(screen.getByLabelText('Target amount (SGD)'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('Target date (optional)'), {
      target: { value: '' },
    });
    external.getGoals.mockResolvedValue([makeGoal(500, null)]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Review changes' })
    );
    expect(external.saveGoal).not.toHaveBeenCalled();
    const panel = await screen.findByLabelText('Changes to save');
    expect(panel).toHaveTextContent(/1,000\.00 -> .*500\.00/);
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm and save' })
    );

    await waitFor(() => expect(external.saveGoal).toHaveBeenCalled());
    expect(external.saveGoal.mock.calls[0][0]).toEqual({
      goalId: GOAL_ID,
      name: 'Synthetic bed',
      target: 500,
      items: [],
    });
    await waitFor(() =>
      expect(external.toastSuccess).toHaveBeenCalledWith('Goal updated')
    );
    expect(await screen.findByText(/of .*500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/200\.00 to go/)).toBeInTheDocument();
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
    await userEvent.click(
      screen.getByRole('button', { name: 'Review changes' })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm and save' })
    );

    expect(await screen.findByText('Funded')).toBeInTheDocument();
    expect(screen.getByText('Goal reached')).toBeInTheDocument();
  });

  it('keeps the sheet open with the draft when saving fails', async () => {
    external.saveGoal.mockResolvedValue({
      ok: false,
      code: 'SERVER',
      goalId: GOAL_ID,
      itemIds: [],
    });
    mount();
    await openEditor();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review changes' })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm and save' })
    );

    expect(
      await screen.findByText('Some changes were not saved, try again')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Synthetic sofa');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(external.toastSuccess).not.toHaveBeenCalled();
  });
});
