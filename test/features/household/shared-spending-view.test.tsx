// @vitest-environment jsdom
import { SharedSpending } from '@/features/household/components/shared-spending';
import { UndoableDeleteProvider } from '@/features/household/hooks/use-undoable-delete';
import type { HouseholdSpace } from '@/features/household/types';
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
import { format } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getSpaces: vi.fn(),
  createSpace: vi.fn(),
  deleteSpace: vi.fn(),
  addSpending: vi.fn(),
  deleteSpending: vi.fn(),
}));
vi.mock('@/features/household/actions/spending-actions', () => actions);
vi.mock('@/features/household/actions/goal-actions', () => ({}));
vi.mock('@/features/household/actions/household-actions', () => ({}));

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
}));

const DELAY = 6000;
const month = format(new Date(), 'yyyy-MM');
const spaces: HouseholdSpace[] = [
  {
    id: 'home',
    kind: 'ongoing',
    name: 'Household',
    startDate: null,
    endDate: null,
    entries: [
      {
        id: 'e1',
        date: `${month}-02`,
        category: 'Groceries',
        amount: 100,
        note: null,
        isSelf: true,
      },
      {
        id: 'e2',
        date: `${month}-03`,
        category: 'Utilities',
        amount: 40,
        note: 'SP',
        isSelf: false,
      },
      {
        id: 'old',
        date: '2001-01-01',
        category: 'Old',
        amount: 999,
        note: null,
        isSelf: true,
      },
    ],
  },
  {
    id: 'japan',
    kind: 'trip',
    name: 'Japan',
    startDate: '2026-12-01',
    endDate: '2026-12-10',
    entries: [],
  },
];

function mount(data: HouseholdSpace[]) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <UndoableDeleteProvider delayMs={DELAY}>
        <SharedSpending spaces={data} />
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
  actions.getSpaces.mockResolvedValue(spaces);
  actions.addSpending.mockResolvedValue(undefined);
  actions.createSpace.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('offers one click to start when nothing is tracked yet', async () => {
  mount([]);
  await userEvent.click(
    screen.getByRole('button', { name: 'Start shared spending' })
  );
  await waitFor(() =>
    expect(actions.createSpace).toHaveBeenCalledWith(
      { kind: 'ongoing', name: 'Household' },
      expect.anything()
    )
  );
});

it("summarises only this month's household spending with an even-split settle-up", () => {
  mount(spaces);
  expect(screen.getAllByText(/\$140\.00/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Partner owes you .*30\.00/)).toBeInTheDocument();
  expect(screen.getByText(/split 50\/50/)).toBeInTheDocument();
  expect(screen.queryByText('Old')).toBeNull();
  expect(
    screen.getByRole('heading', { name: 'Japan', level: 3 })
  ).toBeInTheDocument();
});

it('quick-adds spending, then keeps space and category for the next entry', async () => {
  mount(spaces);
  await userEvent.selectOptions(screen.getByLabelText('For'), 'japan');
  await userEvent.type(screen.getByLabelText('Category'), 'Hotel');
  await userEvent.type(screen.getByLabelText('Amount (SGD)'), '640.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(actions.addSpending).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'japan',
        category: 'Hotel',
        amount: 640.5,
      }),
      expect.anything()
    )
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Amount (SGD)')).toHaveValue(null)
  );
  expect(screen.getByLabelText('Category')).toHaveValue('Hotel');
  expect(screen.getByLabelText('For')).toHaveValue('japan');
});

it('rejects a trip that ends before it starts without calling the server', async () => {
  mount(spaces);
  await userEvent.type(screen.getByLabelText('Trip name'), 'Bali');
  await userEvent.type(screen.getByLabelText('From'), '2027-03-10');
  await userEvent.type(screen.getByLabelText('To'), '2027-03-01');
  await userEvent.click(screen.getByRole('button', { name: 'Add trip' }));
  expect(actions.createSpace).not.toHaveBeenCalled();
});

it('uses h2 sections and h3 trips', () => {
  mount(spaces);
  expect(
    screen.getByRole('heading', { name: 'Household spending', level: 2 })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Trips', level: 2 })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Japan', level: 3 })
  ).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 4 })).toBeNull();
});

it('labels the date, month and trip fields visibly', () => {
  mount(spaces);
  for (const label of ['Date', 'Month', 'Trip name', 'From', 'To']) {
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  }
});

it('gives the quick-add amount the shared focus-target id', () => {
  mount(spaces);
  expect(screen.getByLabelText('Amount (SGD)')).toHaveAttribute(
    'id',
    'quick-add-amount'
  );
});

describe('undoable entry removal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    actions.deleteSpending.mockResolvedValue(undefined);
  });

  it('hides the row, restores it on Undo and never calls the mutation', async () => {
    mount(spaces);
    fireEvent.click(screen.getByRole('button', { name: /^Delete Groceries / }));
    expect(
      screen.queryByRole('button', { name: /^Delete Groceries / })
    ).toBeNull();
    const label = String(toasts.toast.mock.calls.at(-1)?.[0]);
    expect(label).toBe('Groceries entry deleted');
    expect(label).not.toMatch(/\d/);
    act(() => undoAction()());
    expect(
      screen.getByRole('button', { name: /^Delete Groceries / })
    ).toBeInTheDocument();
    await tick(DELAY * 2);
    expect(actions.deleteSpending).not.toHaveBeenCalled();
  });

  it('commits once after the window', async () => {
    mount(spaces);
    fireEvent.click(screen.getByRole('button', { name: /^Delete Groceries / }));
    await tick(DELAY - 1);
    expect(actions.deleteSpending).not.toHaveBeenCalled();
    await tick(1);
    expect(actions.deleteSpending).toHaveBeenCalledTimes(1);
    expect(actions.deleteSpending.mock.calls[0]?.[0]).toBe('e1');
  });

  it('restores the row and toasts when the mutation fails', async () => {
    actions.deleteSpending.mockRejectedValue(new Error('boom'));
    mount(spaces);
    fireEvent.click(screen.getByRole('button', { name: /^Delete Groceries / }));
    await tick(DELAY);
    expect(toasts.error).toHaveBeenCalledWith('Could not delete the entry');
    expect(
      screen.getByRole('button', { name: /^Delete Groceries / })
    ).toBeInTheDocument();
  });
});

describe('trip removal', () => {
  it('asks first and only deletes on confirm', async () => {
    actions.deleteSpace.mockResolvedValue(undefined);
    mount(spaces);
    fireEvent.click(screen.getByRole('button', { name: 'Delete trip Japan' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(actions.deleteSpace).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(actions.deleteSpace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete trip Japan' }));
    const again = await screen.findByRole('alertdialog');
    fireEvent.click(within(again).getByRole('button', { name: 'Delete trip' }));
    await waitFor(() => expect(actions.deleteSpace).toHaveBeenCalledTimes(1));
    expect(actions.deleteSpace.mock.calls[0]?.[0]).toBe('japan');
  });
});

describe('row labels', () => {
  const twins: HouseholdSpace[] = [
    {
      id: 'home',
      kind: 'ongoing',
      name: 'Household',
      startDate: null,
      endDate: null,
      entries: [
        {
          id: 'a',
          date: `${month}-05`,
          category: 'Food',
          amount: 12,
          note: null,
          isSelf: true,
        },
        {
          id: 'b',
          date: `${month}-05`,
          category: 'Food',
          amount: 34,
          note: null,
          isSelf: true,
        },
      ],
    },
  ];

  it('keeps two same-day entries distinct', () => {
    mount(twins);
    const labels = screen
      .getAllByRole('button', { name: /^Delete Food/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(new Set(labels).size).toBe(2);
  });

  it('carries no amount when amounts are hidden', () => {
    visibility.hidden = true;
    mount(twins);
    const buttons = screen.getAllByRole('button', { name: /^Delete / });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).not.toMatch(/12|34/);
    }
  });
});

describe('inline errors', () => {
  it('flags empty quick-add fields, focuses the first, shows no toast and clears on edit', async () => {
    mount(spaces);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const category = screen.getByLabelText('Category');
    const amount = screen.getByLabelText('Amount (SGD)');
    expect(category).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(category).toHaveFocus();
    const describedBy = amount.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)).toHaveTextContent(
      'Enter an amount above 0'
    );
    expect(toasts.error).not.toHaveBeenCalled();
    expect(actions.addSpending).not.toHaveBeenCalled();
    await userEvent.type(amount, '5');
    expect(amount).not.toHaveAttribute('aria-invalid');
  });

  it('flags an empty trip name and a reversed range', async () => {
    mount(spaces);
    await userEvent.click(screen.getByRole('button', { name: 'Add trip' }));
    const name = screen.getByLabelText('Trip name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    expect(toasts.error).not.toHaveBeenCalled();
    await userEvent.type(name, 'Bali');
    expect(name).not.toHaveAttribute('aria-invalid');
    await userEvent.type(screen.getByLabelText('From'), '2027-03-10');
    await userEvent.type(screen.getByLabelText('To'), '2027-03-01');
    await userEvent.click(screen.getByRole('button', { name: 'Add trip' }));
    expect(screen.getByLabelText('From')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.getByText('The trip cannot end before it starts')
    ).toBeInTheDocument();
  });
});
