// @vitest-environment jsdom
import { HouseholdSpendingView } from '@/features/household/components/household-spending-view';
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
  household: {} as {
    data?: Record<string, unknown> | null;
    isLoading?: boolean;
    isError?: boolean;
  },
  spaces: {} as { data?: unknown; isLoading?: boolean; isError?: boolean },
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
  useHousehold: () => state.household,
  useSpaces: (enabled: boolean) => {
    state.spacesEnabled.push(enabled);
    return state.spaces;
  },
  useUnlockHousehold: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/household/components/household-setup', () => ({
  HouseholdSetup: () => <div>Setup</div>,
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
    data: { locked: false, role: 'owner', name: 'Home', memberCount: 1 },
  };
  state.spaces = { data: [{ id: 'space' }] };
  state.spacesEnabled = [];
  state.commit.mockReset().mockResolvedValue(undefined);
  state.dismiss.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('renders the shared spending with a link back to the household', () => {
  render(<HouseholdSpendingView />);
  expect(screen.getByRole('link', { name: 'Household' })).toHaveAttribute(
    'href',
    '/dashboard/household'
  );
  expect(screen.getByLabelText('Amount')).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).toBeNull();
});

it('focuses the amount input from the Add spending button', async () => {
  render(<HouseholdSpendingView />);
  await userEvent.click(screen.getByRole('button', { name: 'Add spending' }));
  expect(screen.getByLabelText('Amount')).toHaveFocus();
});

it('shows the locked state without spending or the add action, and skips the read', () => {
  state.household = { data: { ...state.household.data, locked: true } };
  render(<HouseholdSpendingView />);
  expect(screen.getByText('Household locked')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Unlock household' })).toBeTruthy();
  expect(screen.queryByLabelText('Amount')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add spending' })).toBeNull();
  expect(state.spacesEnabled.every((enabled) => !enabled)).toBe(true);
});

it('shows setup when there is no household', () => {
  state.household = { data: null };
  render(<HouseholdSpendingView />);
  expect(screen.getByText('Setup')).toBeInTheDocument();
  expect(screen.queryByLabelText('Amount')).toBeNull();
});

it('shows a household load error with a back link', () => {
  state.household = { isError: true };
  render(<HouseholdSpendingView />);
  expect(screen.getByText("Couldn't load your household")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Household' })).toBeInTheDocument();
});

it('shows a spending load error', () => {
  state.spaces = { isError: true };
  render(<HouseholdSpendingView />);
  expect(screen.getByText("Couldn't load shared spending")).toBeInTheDocument();
  expect(screen.queryByLabelText('Amount')).toBeNull();
});

it('renders nothing of the spending while the spaces are still loading', () => {
  state.spaces = { isLoading: true };
  render(<HouseholdSpendingView />);
  expect(screen.queryByLabelText('Amount')).toBeNull();
});

it('flushes a pending delete once when the page unmounts', async () => {
  vi.useFakeTimers();
  const { unmount } = render(<HouseholdSpendingView />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
  unmount();
  expect(state.commit).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(7000));
  expect(state.commit).toHaveBeenCalledTimes(1);
});
