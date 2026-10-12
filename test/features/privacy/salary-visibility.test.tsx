// @vitest-environment jsdom
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import { ReliefRow } from '@/features/salary/components/relief-row';
import { SalaryChart } from '@/features/salary/components/salary-chart';
import { SalaryFormDialog } from '@/features/salary/components/salary-form';
import { SalaryTable } from '@/features/salary/components/salary-table';
import { RELIEF_CATALOG } from '@/features/salary/constants';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  records: [{ id: '2026-01', salary: 12345.67, bonus: 789.12 }],
}));
vi.mock('@/features/salary/hooks/use-salary', () => ({
  useSalaryRecord: () => ({
    data: state.records[0],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSalaryRecords: () => ({ data: state.records }),
  useUpsertSalary: () => ({ mutateAsync: state.save, isPending: false }),
  useDeleteSalary: () => ({ mutateAsync: state.remove, isPending: false }),
}));

function Controls() {
  const { hideAmounts, showAmounts } = useAmountVisibility();
  return (
    <>
      <button onClick={hideAmounts}>Hide amounts</button>
      <button onClick={showAmounts}>Show amounts</button>
    </>
  );
}
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

it('conceals an open salary draft without discarding it and prevents direct form submission', async () => {
  render(
    <AmountVisibilityProvider>
      <Controls />
      <SalaryFormDialog open editId="2026-01" onOpenChange={vi.fn()} />
    </AmountVisibilityProvider>
  );
  const salary = screen.getByLabelText('Gross Salary') as HTMLInputElement;
  await waitFor(() => expect(salary.value).toBe('12345.67'));
  fireEvent.change(salary, { target: { value: '23456.78' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(salary.value).toBe('');
  expect(salary.disabled).toBe(true);
  expect(screen.getByLabelText('Bonus')).toHaveProperty('value', '');
  expect(document.body.textContent).not.toContain('23456.78');
  const form = salary.closest('form');
  if (!form) throw new Error('Expected salary form');
  fireEvent.submit(form);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Update' })).toHaveProperty(
      'disabled',
      true
    )
  );
  expect(state.save).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Show amounts', hidden: true })[0]
  );
  expect(salary.value).toBe('23456.78');
  fireEvent.submit(form);
  await waitFor(() =>
    expect(state.save).toHaveBeenCalledWith({
      id: '2026-01',
      salary: 23456.78,
      bonus: 789.12,
    })
  );
});

it('conceals salary table totals and blocks editing and deletion while preserving month labels', () => {
  const edit = vi.fn();
  render(
    <AmountVisibilityProvider>
      <Controls />
      <SalaryTable onEdit={edit} />
    </AmountVisibilityProvider>
  );
  expect(screen.getByText('2026-01')).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(document.body.textContent).not.toContain('12,345.67');
  expect(document.body.textContent).not.toContain('789.12');
  expect(screen.getAllByText('Hidden')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Edit salary record' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete salary record' }));
  expect(edit).not.toHaveBeenCalled();
  expect(state.remove).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('removes financial chart geometry and axes while amounts are hidden', () => {
  render(
    <AmountVisibilityProvider>
      <Controls />
      <SalaryChart records={state.records} />
    </AmountVisibilityProvider>
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(screen.getByText('Salary Growth')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Show amounts');
  expect(document.querySelector('.recharts-wrapper')).toBeNull();
});

function ReliefDraft() {
  const def = RELIEF_CATALOG.find((item) => !item.maxCount && !item.variants);
  if (!def) throw new Error('Expected a custom amount relief');
  const [state, setState] = useState({
    enabled: true,
    amount: 12345.67,
    count: 1,
    variant: '',
  });
  return (
    <TooltipProvider>
      <ReliefRow
        def={def}
        state={state}
        onUpdate={(update) =>
          setState((previous) => ({ ...previous, ...update }))
        }
      />
    </TooltipProvider>
  );
}

it('conceals relief amount input and keeps the unsaved relief amount after showing again', () => {
  render(
    <AmountVisibilityProvider>
      <Controls />
      <ReliefDraft />
    </AmountVisibilityProvider>
  );
  const input = screen.getByRole('spinbutton') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '34567.89' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(input.value).toBe('');
  expect(input.disabled).toBe(true);
  expect(document.body.textContent).not.toContain('34567.89');
  fireEvent.change(input, { target: { value: '99999' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Show amounts', hidden: true })
  );
  expect(input.value).toBe('34567.89');
});
