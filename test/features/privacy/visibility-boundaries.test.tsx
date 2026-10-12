// @vitest-environment jsdom
import { EditableRow } from '@/features/expenses/components/editable-expense-row';
import { SplitDialog } from '@/features/expenses/components/split-dialog';
import type { ExpenseData } from '@/features/expenses/types';
import { GoalCard } from '@/features/household/components/goal-card';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
  AmountsHiddenNotice,
  FinancialValue,
  useAmountVisibility,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

function Controls() {
  const { hideAmounts, showAmounts } = useAmountVisibility();
  return (
    <>
      <button onClick={hideAmounts}>Hide</button>
      <button onClick={showAmounts}>Show</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const row: ExpenseData = {
  id: 'synthetic-private-row',
  date: '2026-10-11',
  type: 'food_drink',
  item: 'Synthetic 876.54',
  info: 'Synthetic 765.43',
  amount: 1234.56,
  splitType: 'self',
  splits: [],
};

it('updates imperative guards synchronously and retains a hide epoch after Show', () => {
  const view = renderHook(() => useAmountVisibility(), {
    wrapper: AmountVisibilityProvider,
  });
  const original = view.result.current;
  act(() => {
    original.hideAmounts();
    expect(original.canReveal()).toBe(false);
    expect(original.getHideEpoch()).toBe(1);
    original.showAmounts();
    expect(original.canReveal()).toBe(true);
    expect(original.getHideEpoch()).toBe(1);
  });
  act(() => original.hideAmounts());
  expect(view.result.current.mask('1234.56')).toBe('Hidden');
  expect(original.getHideEpoch()).toBe(2);
  view.unmount();
  const fresh = renderHook(() => useAmountVisibility(), {
    wrapper: AmountVisibilityProvider,
  });
  expect(fresh.result.current.hidden).toBe(false);
  expect(fresh.result.current.getHideEpoch()).toBe(0);
});

it('names its toggle and replaces displayed children rather than leaving hidden figures in DOM', () => {
  render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <AmountsHiddenNotice />
      <FinancialValue>
        <span title="1234.56">S$1,234.56</span>
      </FinancialValue>
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
  expect(
    screen.getByRole('button', { name: 'Show amounts', pressed: true })
  ).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('1,234.56');
  expect(document.querySelector('[title="1234.56"]')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Show amounts before editing'
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Show amounts', pressed: true })
  );
  expect(screen.getByText('S$1,234.56')).toBeInTheDocument();
});

it('preserves an inline expense draft and suppresses its queued blur save across Hide then Show', () => {
  vi.useFakeTimers();
  const save = vi.fn();
  const remove = vi.fn();
  render(
    <AmountVisibilityProvider>
      <Controls />
      <table>
        <tbody>
          <EditableRow
            row={row}
            isNew={false}
            peopleSuggestions={[]}
            onSave={save}
            onDelete={remove}
          />
        </tbody>
      </table>
    </AmountVisibilityProvider>
  );
  const amount = screen.getByRole('spinbutton', { name: 'Amount (SGD)' });
  fireEvent.change(amount, { target: { value: '2345.67' } });
  fireEvent.blur(amount, {
    relatedTarget: screen.getByRole('button', { name: 'Hide', hidden: true }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Hide', hidden: true }));
  expect(amount).toHaveValue(null);
  expect(amount).toBeDisabled();
  expect(screen.getByPlaceholderText('Brand')).toHaveValue('');
  expect(screen.getByPlaceholderText('Description')).toHaveValue('');
  fireEvent.keyDown(amount, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete expense' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
  act(() => vi.advanceTimersByTime(500));
  expect(save).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(amount).toHaveValue(2345.67);
  fireEvent.keyDown(amount, { key: 'Enter' });
  expect(save).toHaveBeenCalledWith({ ...row, amount: 2345.67 });
});

it('keeps an already-open split draft and blocks hidden confirmation', () => {
  const confirm = vi.fn();
  render(
    <AmountVisibilityProvider>
      <Controls />
      <SplitDialog
        open
        onOpenChange={vi.fn()}
        totalAmount={100}
        initialSplits={[
          { person: 'Synthetic partner', amount: 50, settled: false },
        ]}
        peopleSuggestions={[]}
        onConfirm={confirm}
      />
    </AmountVisibilityProvider>
  );
  const amount = screen.getByRole('spinbutton', {
    name: 'Amount owed by Synthetic partner',
  });
  fireEvent.change(amount, { target: { value: '42.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hide', hidden: true }));
  expect(amount).toHaveValue(null);
  expect(document.body.textContent).not.toContain('42.50');
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  expect(amount).toHaveValue(42.5);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(confirm).toHaveBeenCalledWith([
    { person: 'Synthetic partner', amount: 42.5, settled: false },
  ]);
});

it('conceals household values and progress geometry and prevents hidden goal actions', () => {
  const contribute = vi.fn();
  const remove = vi.fn();
  render(
    <AmountVisibilityProvider>
      <Controls />
      <GoalCard
        goal={{
          id: 'synthetic-goal',
          name: 'Synthetic 9876.54',
          createdAt: '2026-10-11',
          targetDate: null,
          targetAmount: 9876.54,
          contributed: 1234.56,
          remaining: 8641.98,
          pct: 13,
          contributions: [],
        }}
        onContribute={contribute}
        onDelete={remove}
      />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hide', hidden: true }));
  expect(document.body.textContent).not.toMatch(
    /9876\.54|1,234\.56|13%|8,641\.98/
  );
  expect(document.querySelector('[style*="width"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Add to goal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete goal Hidden' }));
  expect(contribute).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it('does not discard an incomplete new expense when keyboard focus moves toward Hide', () => {
  const cancel = vi.fn();
  render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <table>
        <tbody>
          <EditableRow
            row={{ ...row, amount: 0 }}
            isNew
            peopleSuggestions={[]}
            onSave={vi.fn()}
            onDelete={vi.fn()}
            onCancel={cancel}
          />
        </tbody>
      </table>
    </AmountVisibilityProvider>
  );
  const item = screen.getByPlaceholderText('Brand');
  fireEvent.change(item, { target: { value: 'Unsaved synthetic draft' } });
  const toggle = screen.getByRole('button', { name: 'Hide amounts' });
  fireEvent.blur(item, { relatedTarget: toggle });
  expect(cancel).not.toHaveBeenCalled();
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  expect(item).toHaveValue('Unsaved synthetic draft');
});
