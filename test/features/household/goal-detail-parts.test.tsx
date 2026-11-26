// @vitest-environment jsdom
import { GoalActivity } from '@/features/household/components/goal-activity';
import { GoalDetailSkeleton } from '@/features/household/components/goal-detail-skeleton';
import { GoalStatusChip } from '@/features/household/components/goal-status-chip';
import { GoalSummary } from '@/features/household/components/goal-summary';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

vi.mock('@/features/household/hooks/use-member-labels', async () => {
  const { buildMemberLabels } =
    await import('@/features/household/member-labels');
  const labels = buildMemberLabels(['user-self', 'user-other'], 'user-self');
  return { useMemberLabels: () => labels };
});

const visibility = vi.hoisted(() => ({ hidden: false }));
vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: visibility.hidden,
    canReveal: () => !visibility.hidden,
    mask: (value: string) => (visibility.hidden ? 'Hidden' : value),
  }),
}));

afterEach(() => {
  cleanup();
  visibility.hidden = false;
});

describe('GoalStatusChip', () => {
  it('labels each status in text', () => {
    const { rerender } = render(<GoalStatusChip status="funded" />);
    expect(screen.getByText('Funded')).toBeInTheDocument();
    rerender(<GoalStatusChip status="behind" />);
    expect(screen.getByText('Behind')).toBeInTheDocument();
    rerender(<GoalStatusChip status="on-track" />);
    expect(screen.getByText('On track')).toBeInTheDocument();
  });
});

describe('GoalSummary', () => {
  it('shows saved against the target with the person split', () => {
    const { container } = render(
      <GoalSummary goal={goalWithItems} pace={null} />
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(container.textContent).toMatch(/10%/);
    expect(screen.getByText(/^You .*600\.00 \(60%\)$/)).toBeInTheDocument();
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('draws no fills and no amounts while hidden', () => {
    visibility.hidden = true;
    const { container } = render(
      <GoalSummary goal={goalWithItems} pace={50} />
    );
    expect(container.querySelector('rect')).toBeNull();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('omits the split legend for a goal with nothing contributed', () => {
    render(<GoalSummary goal={makeGoal()} pace={null} />);
    expect(screen.queryByText(/^You /)).toBeNull();
  });
});

describe('GoalActivity', () => {
  it('explains an empty feed', () => {
    render(<GoalActivity entries={[]} onEdit={() => undefined} />);
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
  });
});

describe('GoalDetailSkeleton', () => {
  it('renders placeholder blocks for the summary and both columns', () => {
    const { container } = render(<GoalDetailSkeleton />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThanOrEqual(6);
  });
});
