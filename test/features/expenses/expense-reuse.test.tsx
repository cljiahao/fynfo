// @vitest-environment jsdom
import { EditableRow } from '@/features/expenses/components/editable-expense-row';
import { ExpenseEntry } from '@/features/expenses/components/expense-entry';
import {
  ExpenseQuickAdd,
  type ExpenseQuickAddHandle,
} from '@/features/expenses/components/expense-quick-add';
import {
  createReuseDraft,
  sameExpenseValues,
} from '@/features/expenses/lib/reuse-draft';
import type { ExpenseData } from '@/features/expenses/types';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { format } from 'date-fns';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  save: vi.fn<(data: ExpenseData) => Promise<void>>(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  expenses: [] as ExpenseData[],
  pending: 0,
  refetch: vi.fn(),
  read: vi.fn<() => Promise<ExpenseData[]>>(),
  setSaved: vi.fn(),
}));
vi.mock('@/features/expenses/actions/expense-actions', () => ({
  getExpenses: boundary.read,
}));
vi.mock('@/features/expenses/hooks/use-expenses', () => ({
  useUpsertExpense: () => ({ mutateAsync: boundary.save, isPending: false }),
  useExpenses: () => ({
    data: boundary.expenses,
    isLoading: false,
    refetch: boundary.refetch,
  }),
  useDistinctPeople: () => ({ data: [] }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useIsMutating: () => boundary.pending,
  useQueryClient: () => ({
    isMutating: () => boundary.pending,
    setQueryData: boundary.setSaved,
  }),
}));
vi.mock('sonner', () => ({ toast: boundary }));

const source: ExpenseData = {
  id: 'synthetic-source',
  date: '2026-09-04',
  type: 'groceries',
  item: 'Example Market',
  info: 'weekly basket',
  amount: 42.6,
  splitType: 'self',
  splits: [],
};

beforeEach(() => {
  boundary.save.mockReset().mockResolvedValue(undefined);
  boundary.success.mockReset();
  boundary.pending = 0;
  boundary.expenses = [source];
  boundary.read.mockReset().mockResolvedValue([source]);
  boundary.setSaved.mockReset();
  boundary.refetch
    .mockReset()
    .mockResolvedValue({ data: [source], isError: false });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function fixture(
  read = vi.fn<() => Promise<ExpenseData[]>>().mockResolvedValue([])
) {
  const ref = createRef<ExpenseQuickAddHandle>();
  const result = render(
    <>
      <button
        onClick={(event) =>
          ref.current?.requestReuse(source, event.currentTarget)
        }
      >
        Reuse source
      </button>
      <button
        onClick={(event) =>
          ref.current?.requestReuse(
            { ...source, id: 'second-source', item: 'Second Market' },
            event.currentTarget
          )
        }
      >
        Reuse second
      </button>
      <ExpenseQuickAdd ref={ref} readSavedExpenses={read} />
    </>
  );
  const activate = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reuse source' }));
  const save = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
  return { ...result, ref, read, activate, save };
}

describe('reuse draft identity and values', () => {
  it('copies editable values to a new self ID without mutating the source', () => {
    const draft = createReuseDraft(source, '2026-10-12');
    expect(draft).toEqual({
      ...source,
      id: expect.any(String),
      date: '2026-10-12',
    });
    expect(draft.id).not.toBe(source.id);
    expect(draft.splits).not.toBe(source.splits);
    expect(source.date).toBe('2026-09-04');
    const sourceWithMetadata = {
      ...source,
      sourceDescription: 'Synthetic hidden provenance',
    };
    expect(
      createReuseDraft(sourceWithMetadata, '2026-10-12')
    ).not.toHaveProperty('sourceDescription');
    expect(() =>
      createReuseDraft(
        {
          ...source,
          splitType: 'shared',
          splits: [{ person: 'Synthetic Person', amount: 10, settled: false }],
        },
        '2026-10-12'
      )
    ).toThrow();
  });
  it('compares actual saved values and calendar dates without treating a matching ID as confirmation', () => {
    expect(
      sameExpenseValues(source, { ...source, date: '2026-09-04T00:00:00.000Z' })
    ).toBe(true);
    expect(sameExpenseValues(source, { ...source, amount: 43 })).toBe(false);
    expect(
      sameExpenseValues(source, {
        ...source,
        splits: [{ person: 'Synthetic', amount: 1, settled: false }],
      })
    ).toBe(false);
    const shared = {
      ...source,
      splits: [{ person: 'Synthetic', amount: 1, settled: false }],
    };
    expect(
      sameExpenseValues(shared, {
        ...shared,
        splits: [{ ...shared.splits[0], settled: true }],
      })
    ).toBe(false);
  });
});

it('fills Today and inputs without saving; Enter, category, blur and row paste do not save', () => {
  const { activate, container } = fixture();
  activate();
  expect(screen.getByRole('status')).toHaveTextContent('Date set to today');
  const item = screen.getByRole('textbox', { name: 'Item / Brand' });
  expect(item).toHaveValue(source.item);
  expect(item).toHaveFocus();
  expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue(
    source.info
  );
  expect(screen.getByRole('spinbutton')).toHaveValue(42.6);
  fireEvent.keyDown(item, { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Category' }), {
    key: 'Enter',
  });
  fireEvent.blur(item);
  const paste = createEvent.paste(item, {
    clipboardData: { getData: () => '2026-10-01\tInjected\t20' },
  });
  fireEvent(item, paste);
  expect(paste.defaultPrevented).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('Finish or cancel');
  expect(boundary.save).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain('to add');
});

it('protects typed and reused drafts, supports keeping/replacing and cancel focus', () => {
  const { activate } = fixture();
  const item = screen.getByRole('textbox', { name: 'Item / Brand' });
  fireEvent.change(item, { target: { value: 'Existing draft' } });
  activate();
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Replace current draft?'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
  expect(item).toHaveValue('Existing draft');
  activate();
  fireEvent.click(screen.getByRole('button', { name: 'Replace draft' }));
  expect(item).toHaveValue(source.item);
  fireEvent.click(screen.getByRole('button', { name: 'Reuse second' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
  expect(item).toHaveValue(source.item);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reuse' }));
  expect(item).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Reuse source' })).toHaveFocus();
  expect(boundary.save).not.toHaveBeenCalled();
});

it('asks before discarding changed reused values', () => {
  const { activate } = fixture();
  activate();
  const notes = screen.getByRole('textbox', { name: 'Notes' });
  fireEvent.change(notes, { target: { value: 'changed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reuse' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Discard changes');
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
  expect(notes).toHaveValue('changed');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reuse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(notes).toHaveValue('');
});

it('keeps invalid amount feedback associated and saves edits only on explicit click', async () => {
  const { activate, save } = fixture();
  activate();
  const amount = screen.getByRole('spinbutton', { name: 'Amount (SGD)' });
  fireEvent.change(amount, { target: { value: '0' } });
  save();
  expect(amount).toHaveAttribute('aria-invalid', 'true');
  expect(
    document.getElementById(amount.getAttribute('aria-describedby')!)
  ).toHaveTextContent('positive finite');
  expect(boundary.save).not.toHaveBeenCalled();
  fireEvent.change(amount, { target: { value: '19' } });
  save();
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  );
  expect(boundary.save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: expect.not.stringMatching(source.id),
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 19,
      splits: [],
    })
  );
});

it('freezes pending values, double clicks and replacement until acknowledgement', async () => {
  let finish!: () => void;
  boundary.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { activate, save } = fixture();
  activate();
  save();
  expect(screen.getByRole('textbox', { name: 'Item / Brand' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel reuse' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Saving expense…' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reuse second' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(boundary.save).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByRole('textbox', { name: 'Item / Brand' })).toHaveValue('');
});

it('retains identical payload and ID after unknown failure, missing read and retry', async () => {
  boundary.save.mockRejectedValueOnce(new Error('synthetic failure'));
  const { activate, save, read } = fixture();
  activate();
  save();
  await screen.findByRole('button', { name: 'Retry same expense' });
  const first = boundary.save.mock.calls[0][0];
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/original save may still finish/);
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('spinbutton')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reuse second' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry same expense' }));
  await waitFor(() => expect(boundary.save).toHaveBeenCalledTimes(2));
  expect(boundary.save.mock.calls[1][0]).toBe(first);
});

it('confirms only fresh exact server values and preserves uncertain state on read failure', async () => {
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  const read = vi
    .fn<() => Promise<ExpenseData[]>>()
    .mockRejectedValueOnce(new Error('synthetic read failure'));
  const { activate, save } = fixture(read);
  activate();
  save();
  await screen.findByRole('button', { name: 'Retry same expense' });
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/Could not check expenses/);
  expect(screen.getByRole('spinbutton')).toBeDisabled();
  read.mockResolvedValue([boundary.save.mock.calls[0][0]]);
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  );
  expect(boundary.save).toHaveBeenCalledTimes(1);
});

it('blocks overwrite after a conflict, including a failed subsequent refresh', async () => {
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  const read = vi.fn<() => Promise<ExpenseData[]>>();
  const { activate, save } = fixture(read);
  activate();
  save();
  await screen.findByRole('button', { name: 'Retry same expense' });
  read.mockResolvedValue([{ ...boundary.save.mock.calls[0][0], amount: 100 }]);
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/different saved values/);
  expect(
    screen.queryByRole('button', { name: 'Retry same expense' })
  ).not.toBeInTheDocument();
  read.mockRejectedValue(new Error('synthetic read failure'));
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/Could not check expenses/);
  expect(
    screen.queryByRole('button', { name: 'Retry same expense' })
  ).not.toBeInTheDocument();
});

it('ignores late acknowledgement after unmount', async () => {
  let finish!: () => void;
  boundary.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { activate, save, unmount } = fixture();
  activate();
  save();
  unmount();
  await act(async () => finish());
  expect(boundary.success).not.toHaveBeenCalled();
});

it('uses the activation day rather than a mounted date across local midnight', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 12, 23, 59));
  const { activate, save } = fixture();
  activate();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reuse' }));
  vi.setSystemTime(new Date(2026, 9, 13, 0, 1));
  activate();
  await act(async () => save());
  expect(boundary.save).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2026-10-13' })
  );
});

it('coordinates the actual table action with Quick Add and suppresses optimistic pending sources', () => {
  const { rerender } = render(<ExpenseEntry />);
  fireEvent.click(screen.getByRole('button', { name: 'Reuse' }));
  expect(screen.getByRole('textbox', { name: 'Item / Brand' })).toHaveValue(
    source.item
  );
  expect(boundary.save).not.toHaveBeenCalled();
  boundary.pending = 1;
  rerender(<ExpenseEntry />);
  expect(
    screen.queryByRole('button', { name: 'Reuse' })
  ).not.toBeInTheDocument();
});

it('keeps a reused draft frozen when its authoritative read fails despite matching cached data', async () => {
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  render(<ExpenseEntry />);
  fireEvent.click(screen.getByRole('button', { name: 'Reuse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
  await screen.findByRole('button', { name: 'Retry same expense' });
  boundary.refetch.mockResolvedValue({
    isError: true,
    data: [boundary.save.mock.calls[0][0]],
  });
  boundary.read.mockRejectedValue(
    new Error('Synthetic authoritative read failed')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/Could not check expenses/);
  expect(screen.getByRole('textbox', { name: 'Item / Brand' })).toBeDisabled();
  expect(boundary.setSaved).not.toHaveBeenCalled();
});

it('does not confirm a cached match returned by a reverted query cancellation', async () => {
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  render(<ExpenseEntry />);
  fireEvent.click(screen.getByRole('button', { name: 'Reuse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
  await screen.findByRole('button', { name: 'Retry same expense' });
  boundary.refetch.mockResolvedValue({
    isError: false,
    data: [boundary.save.mock.calls[0][0]],
  });
  boundary.read.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/original save may still finish/);
  expect(boundary.refetch).not.toHaveBeenCalled();
  expect(boundary.read).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('textbox', { name: 'Item / Brand' })).toBeDisabled();
});

it('does not repopulate the expense cache when an authoritative read completes after unmount', async () => {
  let finish!: (records: ExpenseData[]) => void;
  boundary.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  const { unmount } = render(<ExpenseEntry />);
  fireEvent.click(screen.getByRole('button', { name: 'Reuse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
  await screen.findByRole('button', { name: 'Retry same expense' });
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  const payload = boundary.save.mock.calls[0][0];
  unmount();
  await act(async () => finish([payload]));
  expect(boundary.setSaved).not.toHaveBeenCalled();
});

it('does not overwrite pending optimistic rows with an authoritative read snapshot', async () => {
  boundary.save.mockRejectedValue(new Error('synthetic failure'));
  render(<ExpenseEntry />);
  fireEvent.click(screen.getByRole('button', { name: 'Reuse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
  await screen.findByRole('button', { name: 'Retry same expense' });
  boundary.pending = 1;
  boundary.read.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Check expenses' }));
  await screen.findByText(/original save may still finish/);
  expect(boundary.setSaved).not.toHaveBeenCalled();
});

it('only reuses clean saved self rows and suppresses source blur-save and Enter-save', () => {
  vi.useFakeTimers();
  const onReuse = vi.fn();
  const onSave = vi.fn();
  const { rerender } = render(
    <table>
      <tbody>
        <EditableRow
          row={source}
          isNew={false}
          peopleSuggestions={[]}
          onSave={onSave}
          onDelete={vi.fn()}
          onReuse={onReuse}
        />
      </tbody>
    </table>
  );
  const button = screen.getByRole('button', { name: 'Reuse' });
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.click(button);
  fireEvent.blur(button, { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(500));
  expect(onSave).not.toHaveBeenCalled();
  expect(onReuse).toHaveBeenCalledWith(source, button);
  fireEvent.change(screen.getByPlaceholderText('Brand'), {
    target: { value: 'Unsaved change' },
  });
  expect(button).toBeDisabled();
  rerender(
    <table>
      <tbody>
        <EditableRow
          row={source}
          isNew
          peopleSuggestions={[]}
          onSave={onSave}
          onDelete={vi.fn()}
          onReuse={onReuse}
        />
      </tbody>
    </table>
  );
  expect(
    screen.queryByRole('button', { name: 'Reuse' })
  ).not.toBeInTheDocument();
});
