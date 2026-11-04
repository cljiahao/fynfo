// @vitest-environment jsdom
import { ProjectBreakdown } from '@/features/household/components/project-breakdown';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

vi.mock('@/features/household/actions/goal-actions', () => ({
  addGoalItem: vi.fn(),
}));
vi.mock('@/features/household/actions/household-actions', () => ({}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
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

function mount(goal = makeGoal()) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProjectBreakdown goal={goal} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  visibility.hidden = false;
});
afterEach(cleanup);

it('invites a split when the goal has no items', () => {
  mount();
  expect(screen.getByText('Split into budget items')).toBeInTheDocument();
  expect(screen.queryByText(/over budget/)).toBeNull();
});

it('summarises item count and totals', () => {
  mount({ ...goalWithItems, paid: 4000, budgeted: 11000 });
  expect(screen.getByText(/^2 items · /)).toHaveTextContent(
    /4,000\.00 of .*11,000\.00/
  );
  expect(screen.queryByText(/over budget/)).toBeNull();
});

it('flags paid above budget as over budget', () => {
  mount({ ...goalWithItems, paid: 12000 });
  expect(screen.getByText(/over budget/)).toHaveClass('text-loss-strong');
});

it('shows no amounts and no over-budget flag when hidden', () => {
  visibility.hidden = true;
  const { container } = mount({ ...goalWithItems, paid: 12000 });
  expect(container.textContent).not.toMatch(/\d{1,3},\d{3}/);
  expect(screen.queryByText(/over budget/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
});

it('opens the add-item modal from the button', async () => {
  mount();
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  expect(
    screen.getByRole('dialog', { name: 'Add budget item' })
  ).toBeInTheDocument();
});
