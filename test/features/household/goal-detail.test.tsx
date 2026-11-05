// @vitest-environment jsdom
import { GoalDetail } from '@/features/household/components/goal-detail';
import type { HouseholdGoal } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

const state = vi.hoisted(() => ({
  household: { data: {} } as Record<string, unknown>,
  goals: { data: [] } as Record<string, unknown>,
}));

vi.mock('@/features/household/hooks/use-household', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/household/hooks/use-household')
  >()),
  useHousehold: () => state.household,
  useGoals: () => state.goals,
}));
vi.mock('@/features/household/actions/goal-actions', () => ({
  getGoals: vi.fn(),
  addGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteGoalItem: vi.fn().mockResolvedValue(undefined),
  deleteItemPayment: vi.fn().mockResolvedValue(undefined),
  addContribution: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn().mockResolvedValue(undefined),
  saveGoal: vi.fn(),
  updateGoalPayment: vi.fn(),
  updateGoalContribution: vi.fn(),
}));
vi.mock('@/features/household/actions/household-actions', () => ({}));
vi.mock('@/features/household/components/goal-burn-up-chart', () => ({
  GoalBurnUpChart: () => <div>burn-up chart</div>,
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(toasts.toast, {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const visibility = vi.hoisted(() => ({ hidden: false }));
vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: visibility.hidden,
    canReveal: () => !visibility.hidden,
    mask: (value: string) => (visibility.hidden ? 'Hidden' : value),
  }),
  AmountsHiddenNotice: () => null,
}));

function mount(goalId = 'g1') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <GoalDetail goalId={goalId} />
    </QueryClientProvider>
  );
}

function setGoals(goals: HouseholdGoal[]) {
  state.goals = { data: goals, isLoading: false, isError: false };
}

beforeEach(() => {
  visibility.hidden = false;
  state.household = {
    data: { locked: false, role: 'owner', name: 'Home' },
    isLoading: false,
    isError: false,
  };
  setGoals([goalWithItems]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('with items', () => {
  it('shows the header, stats, charts, items and activity', () => {
    mount();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Wedding' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Goals/ })).toHaveAttribute(
      'href',
      '/dashboard/household'
    );
    expect(screen.getByText('Contributed')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Monthly pace')).toBeInTheDocument();
    expect(screen.getByText('burn-up chart')).toBeInTheDocument();
    expect(screen.getByText(/^You \d+% \/ Partner \d+%$/)).toBeInTheDocument();
    expect(screen.getAllByText('Venue').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Photographer').length).toBeGreaterThan(1);
    expect(screen.getByText(/Partner paid .* to Venue/)).toBeInTheDocument();
    expect(screen.getByText(/You added /)).toBeInTheDocument();
  });

  it('warns when items total above the target', () => {
    mount();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Items total .*11,000\.00, above the .*10,000\.00 target/
    );
  });

  it('keeps totals and the warning consistent while an item delete is pending', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete item Venue' }));
    expect(screen.queryByText('Venue')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/of .*3,000\.00 budgeted/)).toBeInTheDocument();
    const undo = (
      toasts.toast.mock.calls.at(-1)?.[1] as {
        action: { onClick: () => void };
      }
    ).action.onClick;
    act(() => undo());
    expect(screen.getAllByText('Venue').length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('opens the goal editor from Add item and from Edit', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeVisible();
    cleanup();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeVisible();
  });

  it('confirms before deleting and returns to the household page', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('button', { name: 'Delete goal' });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/dashboard/household')
    );
  });

  it('edits a payment and a contribution from recent activity', () => {
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: /^Edit Partner paid .* to Venue$/ })
    );
    expect(screen.getByRole('dialog', { name: 'Edit payment' })).toBeVisible();
    cleanup();
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^Edit You added / }));
    expect(
      screen.getByRole('dialog', { name: 'Edit contribution' })
    ).toBeVisible();
  });
});

describe('without items', () => {
  beforeEach(() => {
    setGoals([makeGoal()]);
  });

  it('hides the Paid stat and shows the empty summary but offers Add item', () => {
    mount();
    expect(screen.queryByText('Paid')).toBeNull();
    expect(screen.getByText('Split into budget items')).toBeInTheDocument();
    expect(screen.getByText('burn-up chart')).toBeInTheDocument();
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add item' })).toBeEnabled();
  });
});

describe('other states', () => {
  it('says the goal is not found with a way back', () => {
    mount('missing');
    expect(screen.getByText('Goal not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Goals/ })).toHaveAttribute(
      'href',
      '/dashboard/household'
    );
  });

  it('shows a skeleton while the household loads', () => {
    state.household = { data: undefined, isLoading: true, isError: false };
    const { container } = mount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByText('Goal not found')).toBeNull();
  });

  it('shows a skeleton while goals load', () => {
    state.goals = { data: undefined, isLoading: true, isError: false };
    const { container } = mount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('asks to unlock when the household is locked', () => {
    state.household = {
      data: { locked: true, role: 'owner', name: 'Home' },
      isLoading: false,
      isError: false,
    };
    mount();
    expect(screen.getByText('Household locked')).toBeInTheDocument();
    expect(screen.queryByText('Venue')).toBeNull();
  });

  it('points to setup when there is no household', () => {
    state.household = { data: null, isLoading: false, isError: false };
    mount();
    expect(screen.getByText('No household yet')).toBeInTheDocument();
  });
});

describe('amounts hidden', () => {
  it('masks the name, amounts and pace and disables Add item', () => {
    visibility.hidden = true;
    setGoals([{ ...goalWithItems, targetDate: '2020-01-01' }]);
    const { container } = mount();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hidden' })
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d{1,3},\d{3}/);
    expect(container.textContent).not.toContain('Wedding');
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.textContent).toMatch(/Monthly pace\s*Hidden/);
    expect(container.textContent).not.toMatch(/Past target date/);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(container.textContent).not.toMatch(/\d+%/);
  });
});
