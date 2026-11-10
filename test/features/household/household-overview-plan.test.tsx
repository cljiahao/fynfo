// @vitest-environment jsdom
import { HouseholdOverview } from '@/features/household/components/household-overview';
import {
  computeHouseholdPlan,
  type HouseholdPlanInput,
} from '@/features/household/lib/household-plan';
import { formatSGDWhole } from '@/lib/utils/currency';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  household: {} as Record<string, unknown>,
  plan: {} as {
    data?: unknown;
    isLoading?: boolean;
    isError?: boolean;
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({ data: state.household }),
  useGoals: () => ({ data: [{ id: 'cached' }] }),
  useSpaces: () => ({ data: undefined }),
  useUnlockHousehold: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/household/hooks/use-household-plan', () => ({
  useHouseholdPlan: () => state.plan,
}));
vi.mock('@/features/household/components/goal-list', () => ({
  GoalList: () => <div>Goal list</div>,
}));
vi.mock('@/features/household/components/invite-panel', () => ({
  InvitePanel: () => <div>Invite</div>,
}));
vi.mock('@/features/household/components/planner-split-editor', () => ({
  PlannerSplitEditor: () => <div>Split editor</div>,
}));
vi.mock('@/features/household/components/goal-editor-sheet', () => ({
  GoalEditorSheet: () => <div>Goal editor sheet</div>,
}));
vi.mock('@/features/household/components/shared-spending', () => ({
  SharedSpending: () => <div>Spending</div>,
}));

const NOW = new Date(2026, 10, 10, 12);

const input: HouseholdPlanInput = {
  state: 'ready',
  isDefaultSplit: false,
  callerShares: { default: 0.5 },
  goals: [
    {
      id: 'g1',
      name: 'Sofa',
      targetDate: '2027-11-10',
      createdAt: '2026-11-01',
      targetAmount: 12000,
      contributed: 0,
      remaining: 12000,
      share: 0.5,
      items: [],
    },
  ],
  budgets: [{ id: 'b1', monthlyAmount: 200, share: 0.5 }],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  state.household = {
    locked: false,
    role: 'member',
    name: 'Home',
    memberCount: 2,
  };
  state.plan = { data: input };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('household overview plan summary', () => {
  it('shows nothing new for state none', () => {
    state.plan = { data: { ...input, state: 'none', goals: [], budgets: [] } };
    render(<HouseholdOverview />);
    expect(screen.queryByText(/Together/)).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Recommendations' })
    ).toBeNull();
    expect(screen.getByText('Goal list')).toBeInTheDocument();
  });

  it('leaves the locked screen unchanged and hides the plan', () => {
    state.household = { ...state.household, locked: true };
    render(<HouseholdOverview />);
    expect(screen.getByText('Household locked')).toBeInTheDocument();
    expect(screen.queryByText(/Together/)).toBeNull();
  });

  it('shows a busy note while loading and keeps the page usable', () => {
    state.plan = { isLoading: true };
    render(<HouseholdOverview />);
    expect(screen.getByText(/working out the plan/i)).toBeInTheDocument();
    expect(screen.getByText('Goal list')).toBeInTheDocument();
  });

  it('shows a quiet note on error and keeps the page usable', () => {
    state.plan = { isError: true };
    render(<HouseholdOverview />);
    expect(screen.getByText(/couldn.t work out the plan/i)).toBeInTheDocument();
    expect(screen.getByText('Goal list')).toBeInTheDocument();
  });

  it('shows recommendations, your share and the together total at share 1', () => {
    render(<HouseholdOverview />);
    const sharedPlan = computeHouseholdPlan(
      {
        goals: input.goals.map((g) => ({ ...g, share: 1 })),
        budgets: input.budgets.map((b) => ({ ...b, share: 1 })),
      },
      { surplus: 0, now: NOW }
    );
    expect(sharedPlan.monthly).toBe(1200);
    expect(
      screen.getByText(`Together ${formatSGDWhole(sharedPlan.monthly)} a month`)
    ).toBeInTheDocument();
    expect(screen.getByText(/before your savings/)).toBeInTheDocument();
    expect(screen.getByText(/Your share \$600 a month/)).toBeInTheDocument();
    expect(
      screen.getByText(/Sofa is \$144 behind; \$12 more a month/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/already cover/)).toBeNull();
  });

  it('shows no recommendation list when there is nothing to say', () => {
    state.plan = { data: { ...input, goals: [], budgets: [] } };
    render(<HouseholdOverview />);
    expect(
      screen.queryByRole('region', { name: 'Recommendations' })
    ).toBeNull();
    expect(screen.queryByText(/Together/)).toBeNull();
    expect(screen.getByText('Goal list')).toBeInTheDocument();
  });

  it('keeps the split editor on the page for a two-member household', () => {
    render(<HouseholdOverview />);
    expect(screen.getByText('Split editor')).toBeInTheDocument();
  });
});
