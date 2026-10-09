// @vitest-environment jsdom
import { EditableRow } from '@/features/expenses/components/editable-expense-row';
import { ExpenseChart } from '@/features/expenses/components/expense-chart';
import { ExpenseTypeSelect } from '@/features/expenses/components/expense-type-select';
import { SplitDialog } from '@/features/expenses/components/split-dialog';
import type { ExpenseData } from '@/features/expenses/types';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const notices = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast: notices }));
const row: ExpenseData = {
  id: 'e1',
  date: '2026-10-08',
  type: 'food_drink',
  item: 'Cafe',
  info: 'Lunch',
  amount: 90,
  splitType: 'self',
  splits: [],
};
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => undefined,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('calculates shared versus fully fronted amounts, manual edits, settlement, removal and confirmation', async () => {
  const confirm = vi.fn();
  const close = vi.fn();
  render(
    <SplitDialog
      open
      onOpenChange={close}
      totalAmount={90}
      initialSplits={[]}
      peopleSuggestions={['Alex', 'Blair']}
      onConfirm={confirm}
    />
  );
  const input = screen.getByPlaceholderText("Add person's name...");
  await userEvent.type(input, 'Al');
  await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
  expect(screen.getByRole('spinbutton')).toHaveValue(45);
  await userEvent.type(input, 'Blair{Enter}');
  expect(
    screen.getAllByRole('spinbutton').map((e) => (e as HTMLInputElement).value)
  ).toEqual(['30', '30']);
  await userEvent.click(screen.getByRole('button', { name: 'Paid for' }));
  expect(
    screen.getAllByRole('spinbutton').map((e) => (e as HTMLInputElement).value)
  ).toEqual(['45', '45']);
  await userEvent.click(screen.getByRole('button', { name: 'Splitting with' }));
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '25' },
  });
  await userEvent.click(screen.getAllByRole('checkbox')[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Split evenly' }));
  await userEvent.click(screen.getByLabelText('Remove Blair'));
  expect(screen.getByRole('spinbutton')).toHaveValue(45);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(confirm).toHaveBeenCalledWith([
    { person: 'Alex', amount: 45, settled: true },
  ]);
  expect(close).toHaveBeenCalledWith(false);
});
it('reopens split editor with new rows and cannot add duplicate names', async () => {
  const props = {
    onOpenChange: vi.fn(),
    totalAmount: 10,
    peopleSuggestions: [],
    onConfirm: vi.fn(),
  };
  const view = render(
    <SplitDialog
      {...props}
      open
      initialSplits={[{ person: 'Alex', amount: 5, settled: false }]}
    />
  );
  await userEvent.type(
    screen.getByPlaceholderText("Add person's name..."),
    'Alex{Enter}'
  );
  expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  await userEvent.click(screen.getByLabelText('Remove Alex'));
  expect(screen.getByText(/Add people above/)).toBeInTheDocument();
  view.rerender(<SplitDialog {...props} open={false} initialSplits={[]} />);
  view.rerender(
    <SplitDialog
      {...props}
      open
      initialSplits={[{ person: 'Blair', amount: 10, settled: true }]}
    />
  );
  expect(screen.getByText('Blair')).toBeInTheDocument();
  expect(screen.queryByText('Alex')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(props.onConfirm).not.toHaveBeenCalled();
});

function editable(isNew = false, initial = row) {
  const save = vi.fn();
  const remove = vi.fn();
  const cancel = vi.fn();
  const view = render(
    <table>
      <tbody>
        <EditableRow
          row={initial}
          isNew={isNew}
          peopleSuggestions={['Alex']}
          onSave={save}
          onDelete={remove}
          onCancel={cancel}
        />
      </tbody>
    </table>
  );
  return { save, remove, cancel, view };
}
describe('expense inline row behavioral commits', () => {
  it('switches shared expenses to self by removing owed shares before saving', async () => {
    const { save } = editable(false, {
      ...row,
      splitType: 'shared',
      splits: [{ person: 'Alex', amount: 45, settled: false }],
    });
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Self' }));
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    expect(save).toHaveBeenCalledWith({
      ...row,
      splitType: 'self',
      splits: [],
    });
  });
  it('creates shared new rows with generated identity and confirms new split without premature persistence', async () => {
    const { save } = editable(true, { ...row, id: '' });
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Shared' }));
    await userEvent.type(
      screen.getByPlaceholderText("Add person's name..."),
      'Alex{Enter}'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    expect(save.mock.calls[0][0]).toMatchObject({
      splitType: 'shared',
      splits: [{ person: 'Alex', amount: 45, settled: false }],
    });
    expect(save.mock.calls[0][0].id).toBeTruthy();
  });
  it('preserves an overallocated draft on Enter and blur until the bill is corrected', () => {
    vi.useFakeTimers();
    const { save } = editable(false, {
      ...row,
      splitType: 'shared',
      splits: [{ person: 'Alex', amount: 45, settled: false }],
    });
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '40' },
    });
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    expect(save).not.toHaveBeenCalled();
    expect(notices.error).toHaveBeenCalledWith(
      expect.stringMatching(/Shares exceed/)
    );
    fireEvent.blur(screen.getByRole('spinbutton'), { relatedTarget: null });
    vi.advanceTimersByTime(400);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton')).toHaveValue(40);
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '50' },
    });
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ amount: 50 }));
  });
  it('commits edited item, info and amount on Enter with correct id', async () => {
    const { save } = editable();
    await userEvent.clear(screen.getByPlaceholderText('Brand'));
    await userEvent.type(screen.getByPlaceholderText('Brand'), 'Dinner');
    await userEvent.clear(screen.getByPlaceholderText('Description'));
    await userEvent.type(screen.getByPlaceholderText('Description'), 'Meal');
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '120' },
    });
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });
    expect(save).toHaveBeenCalledWith({
      ...row,
      item: 'Dinner',
      info: 'Meal',
      amount: 120,
    });
  });
  it('rejects missing amount, cancels invalid new blur and Escape', () => {
    const { save, cancel } = editable(true, { ...row, id: '', amount: 0 });
    fireEvent.keyDown(screen.getByPlaceholderText('Brand'), { key: 'Enter' });
    expect(save).not.toHaveBeenCalled();
    expect(notices.error).toHaveBeenCalledWith('Date and amount are required');
    fireEvent.blur(screen.getByPlaceholderText('Brand'), {
      relatedTarget: null,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByPlaceholderText('Brand'), { key: 'Escape' });
    expect(cancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByLabelText('Cancel edit'));
    expect(cancel).toHaveBeenCalledTimes(3);
  });
  it('debounces external blur, preserves internal focus and delete suppresses pending save', () => {
    vi.useFakeTimers();
    const { save, remove } = editable();
    fireEvent.blur(screen.getByPlaceholderText('Brand'), {
      relatedTarget: screen.getByPlaceholderText('Description'),
    });
    vi.advanceTimersByTime(400);
    expect(save).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByPlaceholderText('Brand'), {
      relatedTarget: null,
    });
    vi.advanceTimersByTime(399);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledWith(row);
    save.mockClear();
    fireEvent.blur(screen.getByPlaceholderText('Brand'), {
      relatedTarget: null,
    });
    fireEvent.mouseDown(screen.getByLabelText('Delete expense'));
    fireEvent.click(screen.getByLabelText('Delete expense'));
    vi.advanceTimersByTime(500);
    expect(remove).toHaveBeenCalledWith('e1');
    expect(save).not.toHaveBeenCalled();
  });
  it('updates date via real calendar and confirms shared split without an extra blur save', async () => {
    const { save } = editable(false, {
      ...row,
      splitType: 'shared',
      splits: [{ person: 'Alex', amount: 45, settled: false }],
    });
    await userEvent.click(screen.getByRole('button', { name: '08 Oct 2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
    await userEvent.click(screen.getByRole('button', { name: 'Paid for' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(save.mock.calls.at(-1)?.[0].splits).toEqual([
      { person: 'Alex', amount: 90, settled: false },
    ]);
  });
});

it('category keyboard filtering selects matched types and unmatched queries never alter stored category', async () => {
  const change = vi.fn();
  const submit = vi.fn();
  render(
    <ExpenseTypeSelect value="food_drink" onChange={change} onSubmit={submit} />
  );
  const input = screen.getByPlaceholderText('Category');
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.type(input, 'shop{ArrowDown}{ArrowUp}{Enter}');
  expect(change).toHaveBeenCalledWith('shopping');
  await userEvent.clear(input);
  await userEvent.type(input, 'not-a-category');
  expect(screen.getByText('No match')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByText('No match')).not.toBeInTheDocument();
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.type(input, 'trans{Tab}');
  expect(change).toHaveBeenCalledWith('transport');
});

it('chart totals exclude old months and use personal shares while all-time average includes old expenses', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 800, 350)
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: new DOMRect(0, 0, 800, 350),
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        );
      }
      unobserve() {}
      disconnect() {}
    }
  );
  const view = render(<ExpenseChart expenses={[]} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(
    <ExpenseChart
      expenses={[
        row,
        {
          ...row,
          id: 'e2',
          date: '2026-09-01',
          amount: 100,
          type: 'shopping',
          splitType: 'shared',
          splits: [{ person: 'Alex', amount: 40, settled: false }],
        },
        { ...row, id: 'old', date: '2024-01-01', amount: 150 },
      ]}
    />
  );
  expect(screen.getByText('$150')).toBeInTheDocument();
  expect(screen.getByText('All-time avg $100 / mo')).toBeInTheDocument();
  expect(screen.getByText('Monthly Expenses')).toBeInTheDocument();
  await act(async () => {
    await import('recharts');
  });
  expect(await screen.findByText('Food & Drink')).toBeInTheDocument();
  expect(await screen.findByText('Shopping')).toBeInTheDocument();
});
