// @vitest-environment jsdom
import { GoalCard } from '@/features/household/components/goal-card';
import { GoalDetailSkeleton } from '@/features/household/components/goal-detail-skeleton';
import { GoalStatusChip } from '@/features/household/components/goal-status-chip';
import { GoalSummary } from '@/features/household/components/goal-summary';
import { UndoableDeleteProvider } from '@/features/household/hooks/use-undoable-delete';
import type { GoalItem, HouseholdGoal } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

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

function paidItem(
  id: string,
  budget: number,
  payments: Array<{ amount: number; isSelf: boolean }>
): GoalItem {
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    id,
    name: `Item ${id}`,
    budget,
    quote: null,
    dueDate: null,
    payments: payments.map((p, index) => ({
      id: `${id}-${index}`,
      amount: p.amount,
      note: null,
      date: '2026-10-10',
      isSelf: p.isSelf,
    })),
    paid,
    remaining: Math.max(0, budget - paid),
    over: Math.max(0, paid - budget),
  };
}

const paymentsOnly: HouseholdGoal = makeGoal({
  targetAmount: 10000,
  items: [
    paidItem('a', 800, [
      { amount: 300, isSelf: true },
      { amount: 100, isSelf: false },
    ]),
    paidItem('b', 200, []),
  ],
  budgeted: 1000,
  paid: 400,
});

describe('GoalStatusChip in the paid basis', () => {
  it('reads Paid in full when funded', () => {
    render(<GoalStatusChip status="funded" basis="paid" />);
    expect(screen.getByText('Paid in full')).toBeInTheDocument();
  });

  it('keeps Funded in the saved basis', () => {
    render(<GoalStatusChip status="funded" />);
    expect(screen.getByText('Funded')).toBeInTheDocument();
  });
});

describe('GoalSummary in the paid basis', () => {
  it('leads with Paid against the planned total', () => {
    const { container } = render(
      <GoalSummary goal={paymentsOnly} pace={null} />
    );
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.queryByText('Saved')).toBeInTheDocument();
    expect(container.textContent).toMatch(/budgeted/);
    expect(container.textContent).toMatch(/40%/);
    expect(screen.getByText(/^You paid .*300\.00 \(75%\)$/)).toBeVisible();
    expect(screen.getByText(/^Partner paid .*100\.00 \(25%\)$/)).toBeVisible();
    expect(screen.getByText('Left to pay')).toBeInTheDocument();
    expect(screen.queryByText('Behind')).toBeNull();
  });

  it('still leads with Saved once there is a contribution', () => {
    render(<GoalSummary goal={goalWithItems} pace={null} />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByText('Left to pay')).toBeNull();
  });

  it('notes payments above what was saved only when paid exceeds saved', () => {
    const { rerender } = render(
      <GoalSummary goal={goalWithItems} pace={null} />
    );
    expect(screen.getByText(/more than saved/)).toBeInTheDocument();
    rerender(
      <GoalSummary
        goal={{ ...goalWithItems, paid: 500, contributed: 1000 }}
        pace={null}
      />
    );
    expect(screen.queryByText(/more than saved/)).toBeNull();
  });

  it('keeps neutral labels and no basis hints while hidden', () => {
    visibility.hidden = true;
    const { container } = render(
      <GoalSummary goal={paymentsOnly} pace={null} />
    );
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.queryByText('Paid')).toBeNull();
    expect(screen.queryByText('Left to pay')).toBeNull();
    expect(container.querySelector('rect')).toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe('GoalCard in the paid basis', () => {
  function mount(goal: HouseholdGoal) {
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
  }

  it('shows paid progress and what is left to pay', () => {
    mount(paymentsOnly);
    expect(screen.getByText(/^Paid /)).toBeInTheDocument();
    expect(screen.getByText(/600\.00 left to pay/)).toBeInTheDocument();
    expect(screen.queryByText(/to go$/)).toBeNull();
  });

  it('shows Paid in full and All items paid when every item is paid', () => {
    mount({
      ...paymentsOnly,
      items: [paidItem('a', 400, [{ amount: 400, isSelf: true }])],
      budgeted: 400,
      paid: 400,
    });
    expect(screen.getByText('Paid in full')).toBeInTheDocument();
    expect(screen.getByText('All items paid')).toBeInTheDocument();
  });

  it('keeps the saved wording for a goal with contributions', () => {
    mount(goalWithItems);
    expect(screen.getByText(/to go$/)).toBeInTheDocument();
    expect(screen.queryByText(/left to pay/)).toBeNull();
  });
});

describe('GoalDetailSkeleton', () => {
  it('stacks the right column in one wrapper so no row span leaves a gap', () => {
    const { container } = render(<GoalDetailSkeleton />);
    expect(container.innerHTML).not.toMatch(/row-span-2/);
    expect(container.querySelector('.lg\\:space-y-8')).not.toBeNull();
  });
});
