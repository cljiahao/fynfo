// @vitest-environment jsdom
import { GoalCard } from '@/features/household/components/goal-card';
import { computeGoalProgress } from '@/features/household/lib/goal-progress';
import type { HouseholdGoal } from '@/features/household/types';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function mountGoal(target: number, contributed: number) {
  const progress = computeGoalProgress(target, [contributed]);
  const goal: HouseholdGoal = {
    id: 'synthetic-goal',
    name: 'Synthetic target',
    targetAmount: target,
    targetDate: null,
    createdAt: '2026-10-10',
    contributions: [
      {
        id: 'synthetic-contribution',
        amount: contributed,
        note: null,
        date: '2026-10-10',
        isSelf: true,
      },
    ],
    contributed: progress.contributed,
    remaining: progress.remaining,
    pct: progress.pct,
  };
  render(<GoalCard goal={goal} onContribute={vi.fn()} onDelete={vi.fn()} />);
  return progress;
}

describe('goal completion boundaries', () => {
  it('keeps the actual remaining amount visible when display percent rounds to100', () => {
    expect(mountGoal(100, 99.5).pct).toBe(100);
    expect(screen.getByText(/0.50 to go/)).toBeInTheDocument();
    expect(screen.queryByText('Funded')).not.toBeInTheDocument();
    expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
  });
  it.each([100, 125])(
    'recognizes actual completion at contributed%s',
    (contributed) => {
      mountGoal(100, contributed);
      expect(screen.getByText('Funded')).toBeInTheDocument();
      expect(screen.getByText('Goal reached')).toBeInTheDocument();
      expect(screen.queryByText(/ to go$/)).not.toBeInTheDocument();
    }
  );
  it('does not infer completion from decimal currency formatting', () => {
    mountGoal(0.3, 0.299);
    expect(screen.queryByText('Funded')).not.toBeInTheDocument();
    expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
    expect(screen.getByText(/0.00 to go/)).toBeInTheDocument();
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not claim an invalid target%s is funded',
    (target) => {
      mountGoal(target, 100);
      expect(screen.queryByText('Funded')).not.toBeInTheDocument();
      expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
    }
  );
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'does not claim nonfinite contributions%s are funded',
    (contributed) => {
      mountGoal(100, contributed);
      expect(screen.queryByText('Funded')).not.toBeInTheDocument();
      expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
    }
  );
});
