// @vitest-environment jsdom
import { ExpenseQuickAdd } from '@/features/expenses/components/expense-quick-add';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Fire a paste of tab-separated text at the Quick Add container (its onPaste
// reads clipboardData.getData('text/plain')).
function pasteRows(node: Element, text: string) {
  const event = createEvent.paste(node, {
    clipboardData: { getData: () => text },
  });
  fireEvent(node, event);
}

// Keep the save pending: awaiting it before reset would leave the form filled
// and fail the spec 048 immediate-reset contract.
const { mutate } = vi.hoisted(() => ({
  mutate: vi.fn(() => new Promise<void>(() => undefined)),
}));

vi.mock('@/features/expenses/hooks/use-expenses', () => ({
  useUpsertExpense: () => ({ mutate, mutateAsync: mutate, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

describe('ExpenseQuickAdd reset-on-submit', () => {
  it('clears the form immediately on submit without waiting for the save to settle', async () => {
    render(<ExpenseQuickAdd />);

    const item = screen.getByPlaceholderText('e.g. Grab, NTUC');
    const amount = screen.getByPlaceholderText('0.00');

    await userEvent.type(item, 'Grab');
    await userEvent.type(amount, '12');

    await userEvent.click(screen.getByRole('button', { name: /add expense/i }));

    // Mutation fired exactly once with the typed payload...
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        item: 'Grab',
        amount: 12,
        splitType: 'self',
        splits: [],
      })
    );

    // ...and the fields are already clear even though the save never settled.
    expect(item).toHaveValue('');
    // empty number input
    expect(amount).toHaveValue(null);
  });

  it('does not submit (or clear) when amount is missing', async () => {
    render(<ExpenseQuickAdd />);

    const item = screen.getByPlaceholderText('e.g. Grab, NTUC');
    await userEvent.type(item, 'Grab');

    await userEvent.click(screen.getByRole('button', { name: /add expense/i }));

    expect(mutate).not.toHaveBeenCalled();
    expect(item).toHaveValue('Grab');
  });

  it('submits a complete single pasted row and clears immediately', () => {
    const { container } = render(<ExpenseQuickAdd />);

    pasteRows(container.firstChild as Element, '2026-04-01\tGrab\t12.50');

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-04-01',
        item: 'Grab',
        amount: 12.5,
      })
    );
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(null);
  });

  it('fires one mutation per valid row on a multi-row paste', () => {
    const { container } = render(<ExpenseQuickAdd />);

    pasteRows(
      container.firstChild as Element,
      '2026-04-01\tGrab\t12.50\n2026-04-02\tNTUC\t30'
    );

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(null);
  });
});

it('keeps rapid independent manual entries usable while previous saves remain pending', async () => {
  render(<ExpenseQuickAdd />);
  const amount = screen.getByPlaceholderText('0.00');
  fireEvent.change(amount, { target: { value: '12' } });
  fireEvent.keyDown(amount, { key: 'Enter' });
  await userEvent.keyboard('{Enter}');
  fireEvent.change(amount, { target: { value: '13' } });
  fireEvent.keyDown(amount, { key: 'Enter' });
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ amount: 12 })
  );
  expect(mutate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ amount: 13 })
  );
  expect(amount).toHaveValue(null);
});
