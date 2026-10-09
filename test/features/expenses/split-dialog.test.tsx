// @vitest-environment jsdom
import { SplitDialog } from '@/features/expenses/components/split-dialog';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function mount(totalAmount: number, amounts: number[]) {
  const confirm = vi.fn();
  const close = vi.fn();
  render(
    <SplitDialog
      open
      onOpenChange={close}
      totalAmount={totalAmount}
      initialSplits={amounts.map((amount, index) => ({
        person: `Person ${index + 1}`,
        amount,
        settled: index === 0,
      }))}
      peopleSuggestions={[]}
      onConfirm={confirm}
    />
  );
  return { confirm, close };
}

describe('split dialog allocation safety', () => {
  it('blocks excessive shares, preserves the draft and allows correction', async () => {
    const { confirm, close } = mount(10, [6, 5]);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/exceed/);
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(6);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole('spinbutton')[1], {
      target: { value: '4' },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(confirm).toHaveBeenCalledWith([
      { person: 'Person 1', amount: 6, settled: true },
      { person: 'Person 2', amount: 4, settled: false },
    ]);
    expect(close).toHaveBeenCalledWith(false);
  });

  it('paid-for equal shares preserve every cent and settlement state', async () => {
    const { confirm } = mount(10.01, [1, 1, 1]);
    await userEvent.click(screen.getByRole('button', { name: 'Paid for' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(confirm).toHaveBeenCalledWith([
      { person: 'Person 1', amount: 3.34, settled: true },
      { person: 'Person 2', amount: 3.34, settled: false },
      { person: 'Person 3', amount: 3.33, settled: false },
    ]);
  });

  it('shows a manual paid-for remainder instead of promising full reimbursement', async () => {
    const { confirm } = mount(10, [5]);
    await userEvent.click(screen.getByRole('button', { name: 'Paid for' }));
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Amount owed by Person 1' }),
      {
        target: { value: '7' },
      }
    );
    expect(screen.getByText('Your share').nextElementSibling).toHaveTextContent(
      '$3'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(confirm).toHaveBeenCalledWith([
      { person: 'Person 1', amount: 7, settled: true },
    ]);
  });

  it('shows negative allocations as invalid and preserves cancellation', async () => {
    const { confirm, close } = mount(10, [-1]);
    expect(screen.getByRole('alert')).toHaveTextContent(/nonnegative/);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledWith(false);
    expect(confirm).not.toHaveBeenCalled();
  });
});
