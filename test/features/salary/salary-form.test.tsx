// @vitest-environment jsdom
import { SalaryFormDialog } from '@/features/salary/components/salary-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state = await vi.hoisted(async () => {
  const { salaryRow } = await import('../../helpers/salary-fixture');
  return {
    refetch: vi.fn(),
    record: salaryRow('2026-01', 100, 0),
  };
});
vi.mock('@/features/salary/hooks/use-salary', () => ({
  useSalaryRecord: () => ({
    data: state.record,
    isLoading: false,
    isError: true,
    refetch: state.refetch,
  }),
  useSalaryRecords: () => ({ data: [state.record] }),
  useUpsertSalary: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
afterEach(cleanup);
it('blocks cached salary edits on read error and offers retry', () => {
  render(<SalaryFormDialog open onOpenChange={vi.fn()} editId="2026-01" />);
  expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(state.refetch).toHaveBeenCalledOnce();
});
