// @vitest-environment jsdom
import { HouseholdOverview } from '@/features/household/components/household-overview';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({ data: { locked: true, role: 'owner', name: 'Home' } }),
  useGoals: () => ({ data: [{ id: 'cached' }] }),
  useUnlockHousehold: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/household/components/goal-list', () => ({
  GoalList: () => <div>Private goal</div>,
}));
vi.mock('@/features/household/components/invite-panel', () => ({
  InvitePanel: () => <div>Private invite</div>,
}));
vi.mock('@/features/household/components/create-goal-dialog', () => ({
  CreateGoalDialog: () => <div>Create goal dialog</div>,
}));
afterEach(cleanup);
it('hides cached goals, invites and create actions while household locked', () => {
  render(<HouseholdOverview />);
  expect(screen.queryByText('Private goal')).toBeNull();
  expect(screen.queryByText('Private invite')).toBeNull();
  expect(screen.queryByRole('button', { name: 'New goal' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Unlock household' })).toBeTruthy();
});
