// @vitest-environment jsdom
import { GoalItemList } from '@/features/household/components/goal-item-list';
import { GOAL_ITEM_VISIBLE_ROWS } from '@/features/household/constants';
import {
  UndoableDeleteProvider,
  useUndoableDelete,
} from '@/features/household/hooks/use-undoable-delete';
import { withoutPending } from '@/features/household/lib/goal-stats';
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
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getGoals: vi.fn(),
  addGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  deleteGoalItem: vi.fn(),
  deleteItemPayment: vi.fn(),
  addContribution: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  saveGoal: vi.fn(),
  updateGoalPayment: vi.fn(),
  updateGoalContribution: vi.fn(),
}));
vi.mock('@/features/household/actions/goal-actions', () => actions);
vi.mock('@/features/household/actions/household-actions', () => ({
  getHousehold: vi.fn().mockResolvedValue(null),
}));

const toasts = vi.hoisted(() => ({
  toast: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(toasts.toast, {
    error: toasts.error,
    success: vi.fn(),
    dismiss: toasts.dismiss,
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

const DELAY = 6000;

const goal: HouseholdGoal = {
  id: 'g1',
  name: 'Wedding',
  targetAmount: 10000,
  targetDate: null,
  createdAt: '2026-10-01',
  contributions: [],
  contributed: 0,
  remaining: 10000,
  pct: 0,
  items: [
    {
      id: 'i1',
      name: 'Venue',
      budget: 8000,
      quote: null,
      dueDate: null,
      paid: 9000,
      remaining: 0,
      over: 1000,
      payments: [
        {
          id: 'p1',
          amount: 4500,
          note: null,
          date: '2026-10-02',
          isSelf: false,
        },
        {
          id: 'p2',
          amount: 4500,
          note: null,
          date: '2026-10-02',
          isSelf: true,
        },
      ],
    },
    {
      id: 'i2',
      name: 'Photographer',
      budget: 3000,
      quote: null,
      dueDate: null,
      paid: 0,
      remaining: 3000,
      over: 0,
      payments: [],
    },
  ],
  budgeted: 11000,
  paid: 9000,
};

function PageItems() {
  const { pendingIds } = useUndoableDelete();
  return <GoalItemList items={withoutPending(goal, pendingIds).items} />;
}

function showPayments() {
  fireEvent.click(screen.getByRole('button', { name: /^2 payments$/ }));
}

function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <UndoableDeleteProvider delayMs={DELAY}>
        <PageItems />
      </UndoableDeleteProvider>
    </QueryClientProvider>
  );
}

function undoAction(): () => void {
  const options = toasts.toast.mock.calls.at(-1)?.[1] as {
    action: { onClick: () => void };
  };
  return options.action.onClick;
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  visibility.hidden = false;
  vi.resetAllMocks();
  actions.getGoals.mockResolvedValue([goal]);
  actions.addGoalItem.mockResolvedValue(undefined);
  actions.addItemPayment.mockResolvedValue(undefined);
  actions.deleteItemPayment.mockResolvedValue(undefined);
  actions.deleteGoalItem.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('lists every item with its over-budget and remaining text', () => {
  mount();
  expect(screen.getByText('Venue')).toBeInTheDocument();
  expect(screen.getByText('Photographer')).toBeInTheDocument();
  expect(screen.getByText(/Over by .*1,000\.00/)).toBeInTheDocument();
  expect(screen.getByText(/3,000\.00 left/)).toBeInTheDocument();
});

it('records a payment against an item with the chosen date', async () => {
  mount();
  const [, photographerPay] = screen.getAllByRole('button', {
    name: 'Record payment',
  });
  await userEvent.click(photographerPay);
  await userEvent.type(screen.getByLabelText('Amount (SGD)'), '500');
  const date = screen.getByLabelText('Date');
  await userEvent.clear(date);
  await userEvent.type(date, '2026-10-20');
  await userEvent.click(screen.getByRole('button', { name: 'Save payment' }));
  await waitFor(() =>
    expect(actions.addItemPayment).toHaveBeenCalledWith(
      { itemId: 'i2', amount: 500, date: '2026-10-20' },
      expect.anything()
    )
  );
});

describe('undoable removals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('hides an item, restores it on Undo and never calls the mutation', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete item Venue' }));
    expect(screen.queryByText('Venue')).toBeNull();
    const label = String(toasts.toast.mock.calls.at(-1)?.[0]);
    expect(label).toBe('Venue item deleted');
    act(() => undoAction()());
    expect(screen.getByText('Venue')).toBeInTheDocument();
    await tick(DELAY * 2);
    expect(actions.deleteGoalItem).not.toHaveBeenCalled();
  });

  it('commits an item delete once after the window', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete item Venue' }));
    await tick(DELAY - 1);
    expect(actions.deleteGoalItem).not.toHaveBeenCalled();
    await tick(1);
    expect(actions.deleteGoalItem).toHaveBeenCalledTimes(1);
    expect(actions.deleteGoalItem.mock.calls[0]?.[0]).toBe('i1');
  });

  it('restores an item when its mutation fails', async () => {
    actions.deleteGoalItem.mockRejectedValue(new Error('boom'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete item Venue' }));
    await tick(DELAY);
    expect(toasts.error).toHaveBeenCalledWith('Could not delete the item');
    expect(screen.getByText('Venue')).toBeInTheDocument();
  });

  it('hides a payment, restores it on Undo and never calls the mutation', async () => {
    mount();
    showPayments();
    expect(
      screen.getAllByRole('button', { name: /payment on 02 Oct 2026/ })
    ).toHaveLength(2);
    fireEvent.click(
      screen.getByRole('button', {
        name: /payment on 02 Oct 2026 by Partner/,
      })
    );
    expect(
      screen.getAllByRole('button', { name: /payment on 02 Oct 2026/ })
    ).toHaveLength(1);
    const label = String(toasts.toast.mock.calls.at(-1)?.[0]);
    expect(label).toBe('Payment deleted');
    expect(label).not.toMatch(/\d/);
    act(() => undoAction()());
    expect(
      screen.getAllByRole('button', { name: /payment on 02 Oct 2026/ })
    ).toHaveLength(2);
    await tick(DELAY * 2);
    expect(actions.deleteItemPayment).not.toHaveBeenCalled();
  });

  it('commits a payment delete once after the window', async () => {
    mount();
    showPayments();
    fireEvent.click(
      screen.getByRole('button', {
        name: /payment on 02 Oct 2026 by Partner/,
      })
    );
    await tick(DELAY);
    expect(actions.deleteItemPayment).toHaveBeenCalledTimes(1);
    expect(actions.deleteItemPayment.mock.calls[0]?.[0]).toBe('p1');
  });

  it('restores a payment when its mutation fails', async () => {
    actions.deleteItemPayment.mockRejectedValue(new Error('boom'));
    mount();
    showPayments();
    fireEvent.click(
      screen.getByRole('button', {
        name: /payment on 02 Oct 2026 by Partner/,
      })
    );
    await tick(DELAY);
    expect(toasts.error).toHaveBeenCalledWith('Could not delete the payment');
    expect(
      screen.getAllByRole('button', { name: /payment on 02 Oct 2026/ })
    ).toHaveLength(2);
  });

  it('does not commit a pending payment delete separately once its item is deleted', async () => {
    mount();
    showPayments();
    fireEvent.click(
      screen.getByRole('button', { name: /payment on 02 Oct 2026 by Partner/ })
    );
    await tick(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Delete item Venue' }));
    await tick(DELAY);
    expect(actions.deleteItemPayment).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
    await tick(1000);
    expect(actions.deleteGoalItem).toHaveBeenCalledTimes(1);
  });
});

it('keeps two same-day payments distinct by who paid', async () => {
  mount();
  showPayments();
  const labels = screen
    .getAllByRole('button', { name: /payment on/ })
    .map((button) => button.getAttribute('aria-label'));
  expect(new Set(labels).size).toBe(2);
});

it('leaks no amount into delete labels when amounts are hidden', async () => {
  visibility.hidden = true;
  mount();
  showPayments();
  const buttons = screen.getAllByRole('button', { name: /payment on/ });
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(button.getAttribute('aria-label')).not.toMatch(/4,?500/);
  }
});

it('keeps the item track without a fill when amounts are hidden', async () => {
  const visible = mount();
  const trackClass = (root: HTMLElement) =>
    root.querySelector('div.bg-muted.h-2')?.className.replace(/ ring-\S+/g, '');
  const shownClass = trackClass(visible.container);
  expect(visible.container.querySelectorAll('rect').length).toBeGreaterThan(0);
  cleanup();

  visibility.hidden = true;
  const masked = mount();
  expect(trackClass(masked.container)).toBe(shownClass);
  expect(masked.container.querySelector('rect')).toBeNull();
});

describe('inline bar', () => {
  it('highlights an over-budget item and leaves a within-budget one alone', () => {
    const { container } = mount();
    const [venue, photographer] = Array.from(
      container.querySelectorAll(':scope > ul > li')
    );
    expect(venue.querySelector('rect.fill-loss')).not.toBeNull();
    expect(screen.getByText('Over by $1,000.00')).toBeInTheDocument();
    expect(photographer.querySelector('rect.fill-loss')).toBeNull();
    expect(photographer.querySelector('rect.fill-primary')).not.toBeNull();
  });
});

describe('editing a payment', () => {
  it('opens the edit dialog from the pencil on a payment row', async () => {
    mount();
    showPayments();
    const [edit] = screen.getAllByRole('button', { name: /^Edit \$4,500\.00/ });
    await userEvent.click(edit);
    expect(
      await screen.findByRole('dialog', { name: 'Edit payment' })
    ).toBeInTheDocument();
  });
});

describe('payments disclosure', () => {
  it('collapses payments by default and toggles them', () => {
    mount();
    const toggle = screen.getByRole('button', { name: /^2 payments$/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: /payment on 02 Oct 2026/ })
    ).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByRole('button', { name: /payment on 02 Oct 2026/ })
    ).toHaveLength(2);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers no disclosure for an item without payments', () => {
    mount();
    expect(
      screen.getAllByRole('button', { name: /^\d+ payments?$/ })
    ).toHaveLength(1);
  });
});

describe('row cap', () => {
  it('limits the list to five rows tall and scrolls beyond', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...goal.items[0],
      id: `many-${index}`,
      name: `Item ${index}`,
    }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UndoableDeleteProvider delayMs={DELAY}>
          <GoalItemList items={items} />
        </UndoableDeleteProvider>
      </QueryClientProvider>
    );
    const list = screen.getByText('Item 0').closest('ul');
    expect(list).toHaveClass('overflow-y-auto');
    expect(list).toHaveClass(`max-h-[${GOAL_ITEM_VISIBLE_ROWS * 7.5}rem]`);
    expect(
      screen.getAllByRole('button', { name: 'Record payment' })
    ).toHaveLength(8);
  });
});

describe('item facts', () => {
  it('opens a Record payment modal with no inline form', async () => {
    mount();
    const [record] = screen.getAllByRole('button', { name: 'Record payment' });
    await userEvent.click(record);
    expect(
      within(screen.getByRole('dialog')).getByRole('spinbutton', {
        name: 'Amount (SGD)',
      })
    ).toBeInTheDocument();
  });

  it('shows no payment fields until the modal is opened', () => {
    mount();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a quote against the estimate', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UndoableDeleteProvider delayMs={DELAY}>
          <GoalItemList
            items={[{ ...goal.items[1], quote: 3400, remaining: 3400 }]}
          />
        </UndoableDeleteProvider>
      </QueryClientProvider>
    );
    expect(
      screen.getByText(/Quote \$3,400\.00 vs est\. \$3,000\.00/)
    ).toBeInTheDocument();
  });

  it('masks the numbers and the over note when amounts are hidden', () => {
    visibility.hidden = true;
    mount();
    expect(screen.queryByText(/1,000\.00/)).toBeNull();
    expect(screen.queryByText(/3,000\.00/)).toBeNull();
  });
});

describe('inline errors', () => {
  it('flags an empty payment amount without a toast', async () => {
    mount();
    const [, photographerPay] = screen.getAllByRole('button', {
      name: 'Record payment',
    });
    await userEvent.click(photographerPay);
    await userEvent.click(screen.getByRole('button', { name: 'Save payment' }));
    const amount = screen.getByLabelText('Amount (SGD)');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveFocus();
    expect(
      document.getElementById(amount.getAttribute('aria-describedby') ?? '')
    ).toHaveTextContent('Enter an amount above 0');
    expect(toasts.error).not.toHaveBeenCalled();
    expect(actions.addItemPayment).not.toHaveBeenCalled();
    await userEvent.type(amount, '5');
    expect(amount).not.toHaveAttribute('aria-invalid');
  });
});
