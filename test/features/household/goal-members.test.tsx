// @vitest-environment jsdom
import { GoalMembers } from '@/features/household/components/goal-members';
import type { HouseholdGoal } from '@/features/household/types';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeGoal } from './fixtures';

const mocks = vi.hoisted(() => ({
  join: vi.fn(),
  leave: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({
    data: { memberIds: ['me', 'a', 'b'], userId: 'me' },
  }),
  useJoinGoal: () => ({ mutate: mocks.join, isPending: false }),
  useLeaveGoal: () => ({ mutate: mocks.leave, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const goalWith = (memberIds: string[]): HouseholdGoal =>
  makeGoal({ id: 'g1', memberIds });

describe('GoalMembers', () => {
  it('lists member labels and offers Leave to a member', async () => {
    render(<GoalMembers goal={goalWith(['me', 'a'])} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Member 1')).toBeInTheDocument();
    expect(screen.queryByText('Join this goal')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Leave goal' }));
    expect(mocks.leave.mock.calls[0][0]).toBe('g1');
  });

  it('offers Join to a household member who is not on the goal', async () => {
    render(<GoalMembers goal={goalWith(['a'])} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Join this goal' })
    );
    expect(mocks.join.mock.calls[0][0]).toBe('g1');
    expect(screen.queryByText('Leave goal')).toBeNull();
  });

  it('hides Leave when the caller is the only member', () => {
    render(<GoalMembers goal={goalWith(['me'])} />);
    expect(screen.queryByRole('button', { name: 'Leave goal' })).toBeNull();
  });

  it('hides Join once the goal has four members', () => {
    render(<GoalMembers goal={goalWith(['a', 'b', 'c', 'd'])} />);
    expect(screen.queryByRole('button', { name: 'Join this goal' })).toBeNull();
  });

  it('toasts an opaque message when joining fails', async () => {
    mocks.join.mockImplementation(
      (_id: string, options: { onError: () => void }) => options.onError()
    );
    render(<GoalMembers goal={goalWith(['a'])} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Join this goal' })
    );
    expect(mocks.error).toHaveBeenCalledWith('Could not join the goal');
  });
});
