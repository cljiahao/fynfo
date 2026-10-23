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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
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
    <QueryClientProvider client={new QueryClient()}>
      <AmountVisibilityProvider>
        <Controls />
        <GoalCard
          goal={{
            id: 'synthetic-goal',
            name: 'Synthetic 9876.54',
            createdAt: '2026-10-11',
            items: [],
            budgeted: 0,
            paid: 0,
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
    </QueryClientProvider>
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

it('invalidates captured presentation APIs on unmount and cannot be reactivated by stale callbacks', () => {
  const owner = renderHook(() => useAmountVisibility(), {
    wrapper: AmountVisibilityProvider,
  });
  const captured = owner.result.current;
  const epoch = captured.getHideEpoch();
  expect(captured.canReveal()).toBe(true);
  expect(captured.mask('Synthetic 987.65')).toBe('Synthetic 987.65');
  owner.unmount();
  expect(captured.canReveal()).toBe(false);
  expect(captured.getHideEpoch()).toBeGreaterThan(epoch);
  expect(captured.mask('Synthetic 987.65')).toBe('Hidden');
  act(function invokeStaleControls() {
    captured.showAmounts();
    captured.hideAmounts();
    captured.showAmounts();
  });
  expect(captured.canReveal()).toBe(false);
  expect(captured.mask('Synthetic 987.65')).toBe('Hidden');
  const fresh = renderHook(() => useAmountVisibility(), {
    wrapper: AmountVisibilityProvider,
  });
  expect(fresh.result.current.hidden).toBe(false);
  expect(fresh.result.current.canReveal()).toBe(true);
  expect(fresh.result.current.getHideEpoch()).toBe(0);
  expect(captured.canReveal()).toBe(false);
});

function StrictVisibilityOwner({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <AmountVisibilityProvider>{children}</AmountVisibilityProvider>
    </StrictMode>
  );
}

it('stays initially visible and usable after StrictMode replay while teardown invalidates its lifetime', () => {
  const renderPermissions: boolean[] = [];
  const owner = renderHook(
    function useObservePresentationOwner() {
      const visibility = useAmountVisibility();
      renderPermissions.push(!visibility.hidden && visibility.canReveal());
      return visibility;
    },
    {
      wrapper: StrictVisibilityOwner,
    }
  );
  expect(renderPermissions.length).toBeGreaterThan(0);
  expect(renderPermissions.every(Boolean)).toBe(true);
  const captured = owner.result.current;
  expect(captured.hidden).toBe(false);
  expect(captured.canReveal()).toBe(true);
  expect(captured.mask('Synthetic 123.45')).toBe('Synthetic 123.45');
  const initialEpoch = captured.getHideEpoch();
  act(function hideAfterReplay() {
    captured.hideAmounts();
  });
  expect(owner.result.current.hidden).toBe(true);
  expect(captured.canReveal()).toBe(false);
  expect(captured.getHideEpoch()).toBe(initialEpoch + 1);
  act(function showAfterReplay() {
    captured.showAmounts();
  });
  expect(owner.result.current.hidden).toBe(false);
  expect(captured.canReveal()).toBe(true);
  owner.unmount();
  expect(captured.canReveal()).toBe(false);
  expect(captured.getHideEpoch()).toBeGreaterThan(initialEpoch + 1);
  expect(captured.mask('Synthetic 123.45')).toBe('Hidden');
});

function appendSyntheticMeasurement(text: string) {
  const measurement = document.createElement('span');
  measurement.id = 'recharts_measurement_span';
  measurement.setAttribute('aria-hidden', 'true');
  measurement.style.position = 'absolute';
  measurement.style.top = '-20000px';
  measurement.textContent = text;
  document.body.appendChild(measurement);
  return measurement;
}

it('clears retained chart measurement text outside the app on Hide and preserves the node for Show', () => {
  const view = render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <FinancialValue>SGD 987.65</FinancialValue>
    </AmountVisibilityProvider>
  );
  const measurement = appendSyntheticMeasurement('$987.65');
  try {
    expect(view.container.contains(measurement)).toBe(false);
    expect(document.body.textContent).toContain('$987.65');
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(document.body.textContent).not.toContain('987.65');
    expect(document.getElementById('recharts_measurement_span')).toBe(
      measurement
    );
    expect(measurement.textContent).toBe('');
    expect(measurement.getAttribute('aria-hidden')).toBe('true');
    expect(measurement.style.top).toBe('-20000px');
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(screen.getByText('SGD 987.65')).toBeInTheDocument();
    // The library can reuse the same global measurement element for the next visible chart.
    measurement.textContent = '$123.45';
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(measurement.textContent).toBe('');
    expect(document.body.textContent).not.toContain('123.45');
  } finally {
    measurement.remove();
  }
});

it('clears chart measurement text on presentation teardown without removing unrelated body content', () => {
  const view = render(
    <AmountVisibilityProvider>
      <FinancialValue>SGD 876.54</FinancialValue>
    </AmountVisibilityProvider>
  );
  const measurement = appendSyntheticMeasurement('$876.54');
  const unrelated = document.createElement('span');
  unrelated.textContent = 'Static unrelated content';
  document.body.appendChild(unrelated);
  try {
    view.unmount();
    expect(measurement.textContent).toBe('');
    expect(document.getElementById('recharts_measurement_span')).toBe(
      measurement
    );
    expect(document.body.textContent).not.toContain('876.54');
    expect(unrelated.textContent).toBe('Static unrelated content');
  } finally {
    measurement.remove();
    unrelated.remove();
  }
});

it('preserves visible financial rendering and the measurement node during StrictMode cleanup replay', () => {
  const measurement = appendSyntheticMeasurement('$654.32');
  try {
    render(
      <StrictVisibilityOwner>
        <AmountVisibilityToggle />
        <FinancialValue>SGD 654.32</FinancialValue>
      </StrictVisibilityOwner>
    );
    expect(screen.getByText('SGD 654.32')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide amounts', pressed: false })
    ).toBeInTheDocument();
    expect(document.getElementById('recharts_measurement_span')).toBe(
      measurement
    );
    expect(measurement.style.top).toBe('-20000px');
    measurement.textContent = '$654.32';
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(document.body.textContent).not.toContain('654.32');
    fireEvent.click(
      screen.getByRole('button', { name: 'Show amounts', pressed: true })
    );
    expect(screen.getByText('SGD 654.32')).toBeInTheDocument();
  } finally {
    measurement.remove();
  }
});
