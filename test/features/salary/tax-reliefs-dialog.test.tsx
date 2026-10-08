// @vitest-environment jsdom
import { TaxReliefsDialog } from '@/features/salary/components/tax-reliefs-dialog';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  error: false,
  data: [],
  refetch: vi.fn(),
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/features/salary/hooks/use-tax-reliefs', () => ({
  useTaxReliefs: () => ({
    data: state.data,
    isLoading: false,
    isError: state.error,
    refetch: state.refetch,
  }),
  useUpsertTaxReliefs: () => ({
    mutate: state.mutate,
    mutateAsync: state.mutateAsync,
  }),
}));
vi.mock('@/features/salary/components/relief-row', () => ({
  ReliefRow: () => null,
  ReliefLabel: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('sonner', () => ({ toast: { error: state.toast } }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  state.error = false;
});
const props = {
  open: true,
  earnedIncomeRelief: 1000,
  nsmanRelief: 0,
  isNonResident: false,
};
it('blocks replacement after failed cached read and retries', () => {
  state.error = true;
  render(<TaxReliefsDialog {...props} onOpenChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(state.refetch).toHaveBeenCalledOnce();
});
it('waits for successful save before committing totals and closing', async () => {
  let resolveSave: () => void = () => {};
  state.mutateAsync.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      })
  );
  const close = vi.fn();
  const confirm = vi.fn();
  render(
    <TaxReliefsDialog {...props} onOpenChange={close} onConfirm={confirm} />
  );
  await act(async () => {});
  confirm.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(close).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  await act(async () => resolveSave());
  expect(close).toHaveBeenCalledWith(false);
  expect(confirm).toHaveBeenCalledOnce();
});
it('keeps draft open and totals unchanged on rejection', async () => {
  state.mutateAsync.mockRejectedValue(new Error('private detail'));
  const close = vi.fn();
  const confirm = vi.fn();
  render(
    <TaxReliefsDialog {...props} onOpenChange={close} onConfirm={confirm} />
  );
  await act(async () => {});
  confirm.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() =>
    expect(state.toast).toHaveBeenCalledWith('Could not save your tax reliefs')
  );
  expect(close).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});
