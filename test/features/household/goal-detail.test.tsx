// @vitest-environment jsdom
import { saveGoal } from '@/features/household/actions/goal-actions';
import { GoalDetail } from '@/features/household/components/goal-detail';
import { GOAL_ITEM_LIMIT } from '@/features/household/constants';
import type { HouseholdGoal } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

const state = vi.hoisted(() => ({
  household: { data: {} } as Record<string, unknown>,
  goals: { data: [] } as Record<string, unknown>,
}));

vi.mock('@/features/household/hooks/use-household', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/household/hooks/use-household')
  >()),
  useHousehold: () => state.household,
  useGoals: () => state.goals,
}));
vi.mock('@/features/household/actions/goal-actions', () => ({
  getGoals: vi.fn(),
  addGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteGoalItem: vi.fn().mockResolvedValue(undefined),
  deleteItemPayment: vi.fn().mockResolvedValue(undefined),
  addContribution: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn().mockResolvedValue(undefined),
  saveGoal: vi.fn(),
  updateGoalPayment: vi.fn(),
  updateGoalContribution: vi.fn(),
}));
vi.mock('@/features/household/actions/household-actions', () => ({}));
vi.mock('@/features/household/components/goal-burn-up-chart', () => ({
  GoalBurnUpChart: () => <div>burn-up chart</div>,
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(toasts.toast, {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
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

function mount(goalId = 'g1') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <GoalDetail goalId={goalId} />
    </QueryClientProvider>
  );
}

function setGoals(goals: HouseholdGoal[]) {
  state.goals = { data: goals, isLoading: false, isError: false };
}

beforeEach(() => {
  visibility.hidden = false;
  state.household = {
    data: { locked: false, role: 'owner', name: 'Home' },
    isLoading: false,
    isError: false,
  };
  setGoals([goalWithItems]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const overCommittedGoal: HouseholdGoal = {
  ...goalWithItems,
  contributed: 8000,
};

describe('with items', () => {
  it('shows the header, stats, charts, items and activity', () => {
    mount();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Wedding' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Goals/ })).toHaveAttribute(
      'href',
      '/dashboard/household'
    );
    expect(screen.getByText('Contributed')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Monthly needed')).toBeInTheDocument();
    expect(screen.getByText('burn-up chart')).toBeInTheDocument();
    expect(screen.getByText(/^You \d+% \/ Partner \d+%$/)).toBeInTheDocument();
    expect(screen.getAllByText('Venue').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Photographer').length).toBeGreaterThan(1);
    expect(screen.getByText(/Partner paid .* to Venue/)).toBeInTheDocument();
    expect(screen.getByText(/You added /)).toBeInTheDocument();
  });

  it('warns when saved plus still-to-pay is above the target, matching the bar', () => {
    setGoals([overCommittedGoal]);
    mount();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Saved plus items still to pay total .*11,000\.00, above the .*10,000\.00 target/
    );
    expect(
      screen.getByText('Saved plus what is still to pay is above the target.')
    ).toBeInTheDocument();
  });

  it('stays quiet when items total above the target but nothing is over-committed', () => {
    mount();
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.queryByText('Saved plus what is still to pay is above the target.')
    ).toBeNull();
  });

  it('keeps totals and the warning consistent while an item delete is pending', () => {
    setGoals([overCommittedGoal]);
    vi.useFakeTimers();
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete item Photographer' })
    );
    expect(screen.queryByText('Photographer')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/of .*8,000\.00 budgeted/)).toBeInTheDocument();
    const undo = (
      toasts.toast.mock.calls.at(-1)?.[1] as {
        action: { onClick: () => void };
      }
    ).action.onClick;
    act(() => undo());
    expect(screen.getAllByText('Photographer').length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('opens the goal editor from Edit', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeVisible();
  });

  describe('add item dialog', () => {
    function fill(name: string, budget: string, quote = '') {
      fireEvent.change(screen.getByLabelText('Item'), {
        target: { value: name },
      });
      fireEvent.change(screen.getByLabelText('Estimate (SGD)'), {
        target: { value: budget },
      });
      if (quote)
        fireEvent.change(screen.getByLabelText('Final quote (optional)'), {
          target: { value: quote },
        });
    }

    function openDialog() {
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
      return screen.getByRole('dialog', { name: 'Add budget item' });
    }

    beforeEach(() => {
      vi.mocked(saveGoal).mockReset();
      vi.mocked(saveGoal).mockResolvedValue({
        ok: true,
        goalId: 'g1',
        itemIds: [],
      });
    });

    it('asks only for the item, with no goal fields', () => {
      mount();
      const dialog = openDialog();
      expect(dialog).toBeVisible();
      expect(screen.getByLabelText('Item')).toHaveFocus();
      expect(screen.queryByLabelText(/target/i)).toBeNull();
      expect(screen.queryByDisplayValue('Wedding')).toBeNull();
      expect(screen.queryByRole('dialog', { name: 'Edit goal' })).toBeNull();
    });

    it('saves unchanged goal fields and items plus the new item', async () => {
      setGoals([{ ...goalWithItems, targetDate: '2027-03-01T00:00:00Z' }]);
      mount();
      openDialog();
      fill('Cake', '250.5', '240');
      fireEvent.submit(screen.getByLabelText('Item').closest('form')!);
      await waitFor(() => expect(saveGoal).toHaveBeenCalledTimes(1));
      expect(vi.mocked(saveGoal).mock.calls[0]?.[0]).toEqual({
        goalId: 'g1',
        name: 'Wedding',
        target: 10000,
        targetDate: '2027-03-01',
        items: [
          { id: 'i1', name: 'Venue', budget: 8000, quote: null, dueDate: null },
          {
            id: 'i2',
            name: 'Photographer',
            budget: 3000,
            quote: null,
            dueDate: null,
          },
          { name: 'Cake', budget: 250.5, quote: 240, dueDate: null },
        ],
      });
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Add budget item' })
        ).toBeNull()
      );
    });

    it('keeps the dialog and input when saving fails', async () => {
      vi.mocked(saveGoal).mockResolvedValue({
        ok: false,
        code: 'SERVER',
        goalId: 'g1',
        itemIds: [],
      });
      mount();
      openDialog();
      fill('Cake', '250');
      fireEvent.submit(screen.getByLabelText('Item').closest('form')!);
      await waitFor(() => expect(saveGoal).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add item' })).toBeEnabled()
      );
      expect(screen.getByLabelText('Item')).toHaveValue('Cake');
      expect(
        screen.getByRole('dialog', { name: 'Add budget item' })
      ).toBeVisible();
    });

    it('rejects a missing name or estimate without saving', () => {
      mount();
      openDialog();
      fireEvent.submit(screen.getByLabelText('Item').closest('form')!);
      expect(saveGoal).not.toHaveBeenCalled();
      expect(screen.getByText('Enter a name')).toBeInTheDocument();
      expect(screen.getByText('Enter an amount above 0')).toBeInTheDocument();
    });

    it('keeps an item that is pending undo-delete', async () => {
      mount();
      fireEvent.click(
        screen.getByRole('button', { name: 'Delete item Photographer' })
      );
      openDialog();
      fill('Cake', '250');
      fireEvent.submit(screen.getByLabelText('Item').closest('form')!);
      await waitFor(() => expect(saveGoal).toHaveBeenCalledTimes(1));
      const sent = vi.mocked(saveGoal).mock.calls[0]?.[0] as {
        items: { id?: string }[];
      };
      expect(sent.items.map((item) => item.id)).toEqual([
        'i1',
        'i2',
        undefined,
      ]);
    });

    it('disables Add item with a reason at the item limit', () => {
      const items = Array.from({ length: GOAL_ITEM_LIMIT }, (_, index) => ({
        ...goalWithItems.items[1]!,
        id: `item-${index}`,
        name: `Item ${index}`,
      }));
      setGoals([{ ...goalWithItems, items }]);
      mount();
      const button = screen.getByRole('button', { name: 'Add item' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringContaining('50'));
      expect(button).toHaveAccessibleDescription(
        `A goal can have at most ${GOAL_ITEM_LIMIT} budget items`
      );
      fireEvent.click(button);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('confirms before deleting and returns to the household page', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('button', { name: 'Delete goal' });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/dashboard/household')
    );
  });

  it('edits a payment and a contribution from recent activity', () => {
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: /^Edit Partner paid .* to Venue$/ })
    );
    expect(screen.getByRole('dialog', { name: 'Edit payment' })).toBeVisible();
    cleanup();
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^Edit You added / }));
    expect(
      screen.getByRole('dialog', { name: 'Edit contribution' })
    ).toBeVisible();
  });

  it('finds a payment that belongs to a later item', () => {
    const [venue, photographer] = goalWithItems.items;
    setGoals([
      {
        ...goalWithItems,
        items: [
          venue,
          {
            ...photographer,
            paid: 500,
            payments: [
              {
                id: 'p9',
                amount: 500,
                note: null,
                date: '2026-10-06',
                isSelf: true,
              },
            ],
          },
        ],
      },
    ]);
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: /^Edit You paid .* to Photographer$/ })
    );
    expect(screen.getByRole('dialog', { name: 'Edit payment' })).toBeVisible();
  });
});

describe('without items', () => {
  beforeEach(() => {
    setGoals([makeGoal()]);
  });

  it('hides the Paid stat and shows the empty summary but offers Add item', () => {
    mount();
    expect(screen.queryByText('Paid')).toBeNull();
    expect(screen.getByText('Split into budget items')).toBeInTheDocument();
    expect(screen.getByText('burn-up chart')).toBeInTheDocument();
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add item' })).toBeEnabled();
  });
});

describe('other states', () => {
  it('says the goal is not found with a way back', () => {
    mount('missing');
    expect(screen.getByText('Goal not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Goals/ })).toHaveAttribute(
      'href',
      '/dashboard/household'
    );
  });

  it('shows a skeleton while the household loads', () => {
    state.household = { data: undefined, isLoading: true, isError: false };
    const { container } = mount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByText('Goal not found')).toBeNull();
  });

  it('shows a skeleton while goals load', () => {
    state.goals = { data: undefined, isLoading: true, isError: false };
    const { container } = mount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('asks to unlock when the household is locked', () => {
    state.household = {
      data: { locked: true, role: 'owner', name: 'Home' },
      isLoading: false,
      isError: false,
    };
    mount();
    expect(screen.getByText('Household locked')).toBeInTheDocument();
    expect(screen.queryByText('Venue')).toBeNull();
  });

  it('points to setup when there is no household', () => {
    state.household = { data: null, isLoading: false, isError: false };
    mount();
    expect(screen.getByText('No household yet')).toBeInTheDocument();
  });
});

describe('amounts hidden', () => {
  it('masks the name, amounts and pace and disables Add item', () => {
    visibility.hidden = true;
    setGoals([{ ...goalWithItems, targetDate: '2020-01-01' }]);
    const { container } = mount();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hidden' })
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d{1,3},\d{3}/);
    expect(container.textContent).not.toContain('Wedding');
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.textContent).toMatch(/Monthly needed\s*Hidden/);
    expect(container.textContent).not.toMatch(/Past target date/);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(container.textContent).not.toMatch(/\d+%/);
  });
});
