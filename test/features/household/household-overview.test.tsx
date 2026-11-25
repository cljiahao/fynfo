// @vitest-environment jsdom
import { HouseholdOverview } from '@/features/household/components/household-overview';
import { useUndoableDelete } from '@/features/household/hooks/use-undoable-delete';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  household: {} as Record<string, unknown>,
  spacesEnabled: [] as boolean[],
  commit: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    dismiss: state.dismiss,
    error: vi.fn(),
  }),
}));
vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({ data: state.household }),
  useGoals: () => ({ data: [{ id: 'cached' }] }),
  useSpaces: (enabled: boolean) => {
    state.spacesEnabled.push(enabled);
    return { data: enabled ? [{ id: 'cached-space' }] : undefined };
  },
  useUnlockHousehold: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/household/hooks/use-household-plan', () => ({
  useHouseholdPlan: () => ({ data: undefined }),
}));
vi.mock('@/features/household/components/goal-list', () => ({
  GoalList: () => <div>Private goal</div>,
}));
vi.mock('@/features/household/components/invite-partner-dialog', () => ({
  InvitePartnerDialog: () => <button>Invite partner</button>,
}));
vi.mock('@/features/household/components/planner-split-editor', () => ({
  PlannerSplitEditor: () => <div>Split editor</div>,
}));
vi.mock('@/features/household/components/goal-editor-sheet', () => ({
  GoalEditorSheet: () => <div>Goal editor sheet</div>,
}));
vi.mock('@/features/household/components/shared-spending', () => ({
  SharedSpending: function SharedSpendingStub() {
    const { request, pendingIds } = useUndoableDelete();
    return (
      <div>
        <input id="quick-add-amount" aria-label="Amount" />
        {!pendingIds.has('e1') && (
          <button
            onClick={() =>
              request({
                id: 'e1',
                label: 'Entry deleted',
                commit: state.commit,
                errorMessage: 'nope',
              })
            }
          >
            Delete entry
          </button>
        )}
      </div>
    );
  },
}));

beforeEach(() => {
  state.household = {
    locked: false,
    role: 'owner',
    name: 'Home',
    memberCount: 1,
  };
  state.spacesEnabled = [];
  state.commit.mockReset().mockResolvedValue(undefined);
  state.dismiss.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('hides cached goals, tabs and create actions while household locked, keeping the invite', () => {
  state.household = { ...state.household, locked: true };
  render(<HouseholdOverview />);
  expect(screen.queryByText('Private goal')).toBeNull();
  expect(screen.getByRole('button', { name: 'Invite partner' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'New goal' })).toBeNull();
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getByRole('button', { name: 'Unlock household' })).toBeTruthy();
});

it('renders a tablist whose selection, panel label and keyboard follow the tabs', async () => {
  render(<HouseholdOverview />);
  const tabs = screen.getAllByRole('tab');
  expect(screen.getByRole('tablist')).toBeInTheDocument();
  expect(tabs.map((t) => t.textContent)).toEqual(['Goals', 'Spending']);
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Goals');
  expect(state.spacesEnabled.every((enabled) => !enabled)).toBe(true);

  tabs[0].focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Spending');
  expect(state.spacesEnabled.at(-1)).toBe(true);
  await userEvent.keyboard('{ArrowLeft}');
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{End}');
  expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Home}');
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
});

it('swaps the header action per tab and focuses the amount input', async () => {
  render(<HouseholdOverview />);
  expect(screen.getByRole('button', { name: 'New goal' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Spending' }));
  expect(screen.queryByRole('button', { name: 'New goal' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Add spending' }));
  expect(screen.getByLabelText('Amount')).toHaveFocus();
});

it('shows the invite to an owner of a one-member household on both tabs', async () => {
  render(<HouseholdOverview />);
  expect(screen.getByRole('button', { name: 'Invite partner' })).toBeTruthy();
  await userEvent.click(screen.getByRole('tab', { name: 'Spending' }));
  expect(screen.getByRole('button', { name: 'Invite partner' })).toBeTruthy();
});

it('explains the missing invite for a full household and for a non-owner', () => {
  state.household = { ...state.household, memberCount: 2 };
  const full = render(<HouseholdOverview />);
  expect(screen.queryByRole('button', { name: 'Invite partner' })).toBeNull();
  expect(screen.getByText('2 of 2 members')).toBeInTheDocument();
  full.unmount();

  state.household = { ...state.household, role: 'member', memberCount: 1 };
  render(<HouseholdOverview />);
  expect(screen.queryByRole('button', { name: 'Invite partner' })).toBeNull();
  expect(
    screen.getByText('Only the owner can invite a partner')
  ).toBeInTheDocument();
});

it('keeps a pending undo alive across a tab switch and commits once after the window', async () => {
  vi.useFakeTimers();
  render(<HouseholdOverview />);
  const select = (name: string) => {
    const tab = screen.getByRole('tab', { name });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.focus(tab);
  };
  select('Spending');
  fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
  select('Goals');
  await act(() => vi.advanceTimersByTimeAsync(2000));
  select('Spending');
  expect(state.commit).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Delete entry' })
  ).not.toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(4100));
  expect(state.commit).toHaveBeenCalledTimes(1);
  expect(state.dismiss).toHaveBeenCalledWith('undo-delete-e1');
});

it('flushes a pending delete once when the page unmounts', async () => {
  vi.useFakeTimers();
  const { unmount } = render(<HouseholdOverview />);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Spending' }), {
    button: 0,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
  unmount();
  expect(state.commit).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(7000));
  expect(state.commit).toHaveBeenCalledTimes(1);
});
