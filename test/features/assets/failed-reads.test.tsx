// @vitest-environment jsdom
import { SalaryPlanner } from '@/features/assets/components/salary-planner';
import { SnapshotForm } from '@/features/assets/components/snapshot-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  snapshotError: true,
  listError: false,
  salaryError: false,
  settingsError: false,
  expensesError: false,
  refetch: vi.fn(),
  mutate: vi.fn(),
  snapshot: { id: '2026-01', entries: [] },
  empty: [],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/assets/hooks/use-snapshots', () => ({
  useSnapshot: () => ({
    data: state.snapshot,
    isLoading: false,
    isError: state.snapshotError,
    refetch: state.refetch,
  }),
  useSnapshots: () => ({
    data: state.empty,
    isLoading: false,
    isError: state.listError,
    refetch: state.refetch,
  }),
  useUpsertSnapshot: () => ({ mutateAsync: state.mutate }),
}));
vi.mock('@/features/salary/hooks/use-salary', () => ({
  useSalaryRecords: () => ({
    data: state.empty,
    isLoading: false,
    isError: state.salaryError,
    refetch: state.refetch,
  }),
}));
vi.mock('@/features/expenses', () => ({
  useExpenses: () => ({
    data: state.empty,
    isLoading: false,
    isError: state.expensesError,
    refetch: state.refetch,
  }),
}));
vi.mock('@/features/assets/hooks/use-planner-settings', () => ({
  usePlannerSettings: () => ({
    data: undefined,
    isLoading: false,
    isError: state.settingsError,
    refetch: state.refetch,
  }),
  useUpsertPlannerSettings: () => ({ mutate: state.mutate }),
}));
vi.mock('@/features/assets/components/planner-results', () => ({
  PlannerResults: () => null,
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    snapshotError: true,
    listError: false,
    salaryError: false,
    settingsError: false,
    expensesError: false,
  });
});
it('blocks editing cached snapshots after read failure and retries', () => {
  render(<SnapshotForm editId="2026-01" />);
  expect(screen.queryByRole('button', { name: 'Update Snapshot' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(state.refetch).toHaveBeenCalled();
});
it('blocks new snapshots when duplicate-check read fails', () => {
  state.listError = true;
  render(<SnapshotForm />);
  expect(screen.queryByRole('button', { name: 'Save Snapshot' })).toBeNull();
});
it.each(['salaryError', 'settingsError', 'expensesError'] as const)(
  'blocks planner on %s',
  (key) => {
    state[key] = true;
    render(<SalaryPlanner />);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.refetch).toHaveBeenCalled();
  }
);
it('cancels autosave when planner unmounts', () => {
  vi.useFakeTimers();
  const view = render(<SalaryPlanner />);
  fireEvent.change(screen.getAllByRole('spinbutton')[2], {
    target: { value: '6' },
  });
  view.unmount();
  vi.advanceTimersByTime(1000);
  expect(state.mutate).not.toHaveBeenCalled();
});
