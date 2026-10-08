// @vitest-environment jsdom
import { SalaryFormDialog } from '@/features/salary/components/salary-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  refetch: vi.fn(),
  record: { id: '2026-01', salary: 100, bonus: 0 },
}));
vi.mock('@/features/salary/hooks/use-salary', () => ({
  useSalaryRecord: () => ({
    data: state.record,
    isLoading: false,
    isError: true,
    refetch: state.refetch,
  }),
  useUpsertSalary: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
afterEach(cleanup);
it('blocks cached salary edits on read error and offers retry', () => {
  render(<SalaryFormDialog open onOpenChange={vi.fn()} editId="2026-01" />);
  expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(state.refetch).toHaveBeenCalledOnce();
});
