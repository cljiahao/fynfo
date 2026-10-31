// @vitest-environment jsdom
import { GoalCard } from '@/features/household/components/goal-card';
import { UndoableDeleteProvider } from '@/features/household/hooks/use-undoable-delete';
import { computeGoalProgress } from '@/features/household/lib/goal-progress';
import type { HouseholdGoal } from '@/features/household/types';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function buildGoal(target: number, contributed: number): HouseholdGoal {
  const progress = computeGoalProgress(target, [contributed]);
  return {
    id: 'synthetic-goal',
    name: 'Synthetic target',
    targetAmount: target,
    targetDate: null,
    createdAt: '2026-10-10',
    items: [],
    budgeted: 0,
    paid: 0,
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
}

function mountGoal(target: number, contributed: number) {
  const progress = computeGoalProgress(target, [contributed]);
  const goal = buildGoal(target, contributed);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UndoableDeleteProvider>
        <GoalCard
          goal={goal}
          onContribute={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </UndoableDeleteProvider>
    </QueryClientProvider>
  );
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

function Card({
  goal,
  className,
}: {
  goal: HouseholdGoal;
  className?: string;
}) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <UndoableDeleteProvider>
          <GoalCard
            goal={goal}
            className={className}
            onContribute={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </UndoableDeleteProvider>
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

describe('goal card presentation', () => {
  it('titles the goal with an h2', () => {
    render(<Card goal={buildGoal(100, 40)} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Synthetic target' })
    ).toBeInTheDocument();
  });

  it('keeps the progress track but draws no fill, figure or percent when amounts are hidden', () => {
    const { container } = render(<Card goal={buildGoal(100, 40)} />);
    const visibleTrack = container.querySelector('.bg-muted.rounded-full');
    const visibleClass = visibleTrack?.className;
    expect(visibleTrack?.querySelector('rect')).not.toBeNull();
    expect(screen.getByText('40%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));

    const hiddenTrack = container.querySelector('.bg-muted.rounded-full');
    expect(hiddenTrack).not.toBeNull();
    expect(hiddenTrack?.className).toBe(visibleClass);
    expect(container.querySelector('rect')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d%|40\.00|100\.00/);
  });

  it('does not play the Funded moment for a goal already funded on first render', () => {
    render(<Card goal={buildGoal(100, 100)} />);
    expect(screen.getByText('Funded').className).not.toContain('animate-in');
  });

  it('plays the Funded moment once when a rerender crosses the target', () => {
    const { rerender } = render(<Card goal={buildGoal(100, 40)} />);
    expect(screen.queryByText('Funded')).not.toBeInTheDocument();
    rerender(<Card goal={buildGoal(100, 100)} />);
    const pill = screen.getByText('Funded');
    expect(pill.className).toContain('animate-in');
    // jsdom has no AnimationEvent, so React listens for the prefixed name.
    fireEvent(pill, new Event('webkitAnimationEnd', { bubbles: true }));
    expect(screen.getByText('Funded').className).not.toContain('animate-in');
  });

  it('colours you and partner with the shared identity tokens', () => {
    const { container } = render(<Card goal={buildGoal(100, 40)} />);
    expect(container.querySelector('.bg-brand')).not.toBeNull();
    expect(container.querySelector('.bg-chart-4')).not.toBeNull();
    expect(container.querySelector('rect.fill-brand')).not.toBeNull();
  });

  it('enlarges icon buttons to 44px on coarse pointers', () => {
    render(<Card goal={buildGoal(100, 40)} />);
    for (const name of [
      'Edit goal Synthetic target',
      'Delete goal Synthetic target',
    ]) {
      expect(screen.getByRole('button', { name }).className).toContain(
        'pointer-coarse:size-11'
      );
    }
  });
});
