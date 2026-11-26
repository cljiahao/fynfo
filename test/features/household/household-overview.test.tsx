// @vitest-environment jsdom
import { HouseholdOverview } from '@/features/household/components/household-overview';
import { HOUSEHOLD_MEMBER_CAP } from '@/features/household/constants';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  household: {} as Record<string, unknown>,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({ data: state.household }),
  useGoals: () => ({ data: [{ id: 'cached' }] }),
  useUnlockHousehold: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/household/hooks/use-household-plan', () => ({
  useHouseholdPlan: () => ({ data: undefined }),
}));
vi.mock('@/features/household/components/goal-list', () => ({
  GoalList: () => <div>Private goal</div>,
}));
vi.mock('@/features/household/components/member-name-field', () => ({
  MemberNameField: () => null,
}));
vi.mock('@/features/household/components/invite-member-dialog', () => ({
  InviteMemberDialog: () => <button>Invite member</button>,
}));
vi.mock('@/features/household/components/planner-split-editor', () => ({
  PlannerSplitEditor: () => <div>Split editor</div>,
}));
vi.mock('@/features/household/components/goal-editor-sheet', () => ({
  GoalEditorSheet: () => <div>Goal editor sheet</div>,
}));
beforeEach(() => {
  state.household = {
    locked: false,
    role: 'owner',
    name: 'Home',
    memberCount: 1,
  };
});
afterEach(cleanup);

it('hides cached goals, spending link and create actions while household locked, keeping the invite', () => {
  state.household = { ...state.household, locked: true };
  render(<HouseholdOverview />);
  expect(screen.queryByText('Private goal')).toBeNull();
  expect(screen.getByRole('button', { name: 'Invite member' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'New goal' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Shared spending' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Unlock household' })).toBeTruthy();
});

it('has no tabs and links to shared spending next to the invite and New goal', () => {
  render(<HouseholdOverview />);
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getByRole('link', { name: 'Shared spending' })).toHaveAttribute(
    'href',
    '/dashboard/household/spending'
  );
  expect(screen.getByRole('button', { name: 'Invite member' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'New goal' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add spending' })).toBeNull();
});

it('keeps the monthly plan in a disclosure that starts collapsed', () => {
  render(<HouseholdOverview />);
  const summary = screen.getByText('Monthly plan');
  expect(summary.closest('details')).not.toHaveAttribute('open');
});

it('explains the missing invite for a full household and for a non-owner', () => {
  state.household = { ...state.household, memberCount: HOUSEHOLD_MEMBER_CAP };
  const full = render(<HouseholdOverview />);
  expect(screen.queryByRole('button', { name: 'Invite member' })).toBeNull();
  expect(
    screen.getByText(
      `${HOUSEHOLD_MEMBER_CAP} of ${HOUSEHOLD_MEMBER_CAP} members`
    )
  ).toBeInTheDocument();
  full.unmount();

  state.household = { ...state.household, role: 'member', memberCount: 1 };
  render(<HouseholdOverview />);
  expect(screen.queryByRole('button', { name: 'Invite member' })).toBeNull();
  expect(
    screen.getByText('Only the owner can invite members')
  ).toBeInTheDocument();
});
