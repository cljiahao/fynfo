// @vitest-environment jsdom
import { PlannerExpensesField } from '@/features/assets/components/planner-expenses-field';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: false,
    mask: (v: string) => v,
    canReveal: () => true,
  }),
}));

afterEach(cleanup);

function setup(props: { isCustom: boolean; average: number }) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(
    <PlannerExpensesField
      value={1200}
      monthsUsed={3}
      onChange={onChange}
      onReset={onReset}
      {...props}
    />
  );
  return { onChange, onReset };
}

it('resets to the average when the input is cleared', () => {
  const { onChange, onReset } = setup({ isCustom: true, average: 1000 });
  fireEvent.change(screen.getByLabelText('Expenses'), {
    target: { value: '' },
  });
  expect(onReset).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();
});

it('passes typed numbers through', () => {
  const { onChange, onReset } = setup({ isCustom: true, average: 1000 });
  fireEvent.change(screen.getByLabelText('Expenses'), {
    target: { value: '900' },
  });
  expect(onChange).toHaveBeenCalledWith(900);
  expect(onReset).not.toHaveBeenCalled();
});

it('shows the reset control while custom even with no average', () => {
  const { onReset } = setup({ isCustom: true, average: 0 });
  fireEvent.click(screen.getByRole('button', { name: /reset to average/i }));
  expect(onReset).toHaveBeenCalledOnce();
});

it('hides the reset control when following the average', () => {
  setup({ isCustom: false, average: 1000 });
  expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
});
