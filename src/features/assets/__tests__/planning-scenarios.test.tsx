// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalaryPlanner } from '../components/salary-planner';
import { ScenarioDialog } from '../components/scenario-dialog';
import { useScenarioMutations } from '../hooks/use-scenarios';
import type { ScenarioPayload, ScenarioRecord } from '../types';
const state = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  settings: vi.fn(),
  salaryWrites: vi.fn(),
  expenseWrites: vi.fn(),
  snapshotWrites: vi.fn(),
}));
vi.mock('../actions/scenario-actions', () => ({
  getScenarios: state.get,
  createScenario: state.create,
  updateScenario: state.update,
  deleteScenario: state.remove,
}));
vi.mock('../hooks/use-planner-settings', () => ({
  usePlannerSettings: () => ({ data: null, isLoading: false, isError: false }),
  useUpsertPlannerSettings: () => ({ mutate: state.settings }),
}));
vi.mock('@/features/salary/hooks/use-salary', () => ({
  useSalaryRecords: () => ({
    data: [{ salary: 5000 }],
    isLoading: false,
    isError: false,
  }),
  useUpsertSalary: state.salaryWrites,
}));
vi.mock('@/features/expenses', () => ({
  useExpenses: () => ({ data: [], isLoading: false, isError: false }),
  isCountedInExpenseTotals: () => true,
  useUpsertExpense: state.expenseWrites,
}));
vi.mock('../hooks/use-snapshots', () => ({
  useUpsertSnapshot: state.snapshotWrites,
}));
const payload: ScenarioPayload = {
  schemaVersion: 1,
  name: 'Synthetic saved scenario',
  model: 'allocation-flat-cpf-v1',
  currency: 'SGD',
  capturedAt: '2026-10-10T00:00:00.000Z',
  sourceSnapshotMonth: '2026-10',
  inputs: {
    salary: 4000,
    expenses: 1000,
    emergencyMonths: 3.5,
    warChestMonths: 9,
    titheEnabled: false,
    tithePctInput: 10,
    allowanceEnabled: true,
    allowancePctInput: 5,
    currentSavings: -100,
    currentBonds: 200,
  },
};
const record: ScenarioRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  creationRequestId: '22222222-2222-4222-8222-222222222222',
  revision: '1',
  createdAt: payload.capturedAt,
  updatedAt: payload.capturedAt,
  payload,
};
const mount = (element: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  state.get.mockResolvedValue([record]);
  state.create.mockResolvedValue({
    status: 'CREATED',
    id: record.id,
    revision: '1',
  });
  state.update.mockResolvedValue({ status: 'SAVED', revision: '2' });
  state.remove.mockResolvedValue({ status: 'DELETED' });
});
afterEach(cleanup);
describe('saved scenario isolation', () => {
  it('loads only expanded scenarios and edits actual mounted dialog without live/settings mutations or duplicate label IDs', async () => {
    const live = vi.fn();
    mount(
      <SalaryPlanner
        snapshot={{
          id: '2026-10',
          entries: [{ category: 'savings', account: 'Synthetic', amount: 999 }],
        }}
        onPlannerValuesChange={live}
      />
    );
    expect(state.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Saved scenarios/ }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open Synthetic saved scenario',
      })
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/Flat 20% CPF, fixed 5% insurance/)
    ).toBeVisible();
    expect(within(dialog).getByText(/Captured savings:/)).toHaveTextContent(
      '-$100'
    );
    const originalCalls = live.mock.calls.length;
    fireEvent.change(within(dialog).getByLabelText('Gross Salary'), {
      target: { value: '7000' },
    });
    expect(screen.getAllByLabelText('Gross Salary')[0]).toHaveValue(5000);
    expect(within(dialog).getByLabelText('Gross Salary')).toHaveValue(7000);
    const ids = Array.from(
      document.querySelectorAll('[id]'),
      (element) => element.id
    );
    expect(new Set(ids).size).toBe(ids.length);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Adjust reserves' })
    );
    const reserve = within(dialog).getByLabelText('Emergency Fund (months)');
    expect(reserve).toHaveValue(3.5);
    expect(reserve).toHaveAttribute('step', 'any');
    fireEvent.change(reserve, { target: { value: '0' } });
    expect(reserve).toHaveValue(0);
    fireEvent.click(within(dialog).getByLabelText('Tithe'));
    expect(screen.getAllByLabelText('Tithe')[0]).toBeChecked();
    expect(live).toHaveBeenCalledTimes(originalCalls);
    expect(state.settings).not.toHaveBeenCalled();
    expect(state.salaryWrites).not.toHaveBeenCalled();
    expect(state.expenseWrites).not.toHaveBeenCalled();
    expect(state.snapshotWrites).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save changes' })
    );
    await screen.findByText('Scenario saved.');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open Synthetic saved scenario' })
      ).toHaveFocus()
    );
    expect(state.update).toHaveBeenCalledWith({
      id: record.id,
      revision: '1',
      payload: {
        ...payload,
        inputs: {
          ...payload.inputs,
          salary: 7000,
          titheEnabled: true,
          emergencyMonths: 0,
        },
      },
    });
    expect(state.settings).not.toHaveBeenCalled();
    expect(live).toHaveBeenCalledTimes(originalCalls);
  });
  it('preserves drafts on conflict and requires authoritative reload before save-as-new', async () => {
    state.update.mockResolvedValue({ status: 'CONFLICT' });
    mount(
      <ScenarioDialog
        initialPayload={payload}
        initialRecord={record}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText('Scenario name'), {
      target: { value: 'Preserved draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Save requires review/);
    expect(screen.getByLabelText('Scenario name')).toHaveValue(
      'Preserved draft'
    );
    expect(screen.getByRole('button', { name: 'Save as new' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved rows' }));
    await screen.findByText(/Latest saved row found/);
    expect(screen.getByLabelText('Scenario name')).toHaveValue(
      'Preserved draft'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Review saved row (replace draft)' })
    );
    expect(screen.getByLabelText('Scenario name')).toHaveValue(payload.name);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  it('does not automatically replay ambiguous create when reload finds no row', async () => {
    state.create.mockRejectedValue(new Error('Uncertain transport'));
    state.get.mockResolvedValue([]);
    const saved = vi.fn();
    mount(
      <ScenarioDialog
        initialPayload={payload}
        onClose={vi.fn()}
        onSaved={saved}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    await screen.findByText(/Save could not be confirmed/);
    const firstId = state.create.mock.calls[0][0].creationRequestId;
    expect(screen.getByRole('button', { name: 'Save as new' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved rows' }));
    await screen.findByText(/No current saved row found/);
    expect(state.create).toHaveBeenCalledOnce();
    state.create.mockResolvedValue({
      status: 'CREATED',
      id: record.id,
      revision: '1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(state.create.mock.calls[1][0].creationRequestId).not.toBe(firstId);
  });
  it('suppresses late create results when editor closes and a different editor opens', async () => {
    let finish: (value: unknown) => void = () => {};
    state.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const first = mount(
      <ScenarioDialog initialPayload={payload} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    expect(screen.getByLabelText('Scenario name')).toBeDisabled();
    expect(screen.getByLabelText('Gross Salary')).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Close' })[0]).toBeEnabled();
    first.unmount();
    mount(
      <ScenarioDialog
        initialPayload={{ ...payload, name: 'New draft' }}
        onClose={vi.fn()}
      />
    );
    await act(async () =>
      finish({ status: 'CREATED', id: record.id, revision: '1' })
    );
    expect(screen.getByLabelText('Scenario name')).toHaveValue('New draft');
    expect(screen.queryByText(/Scenario saved. Reload/)).toBeNull();
  });
  it('shows capacity refresh and rejects nonfinite computed results before save', async () => {
    state.create.mockResolvedValue({ status: 'CAPACITY' });
    mount(<ScenarioDialog initialPayload={payload} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    await screen.findByText(/No available scenario slot/);
    cleanup();
    mount(
      <ScenarioDialog
        initialPayload={{
          ...payload,
          inputs: { ...payload.inputs, salary: 1e-320 },
        }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('nonfinite');
    expect(screen.getByRole('button', { name: 'Save as new' })).toBeDisabled();
  });
});

it.each([
  ['create', 'CREATED', true],
  ['create', 'EXISTING', false],
  ['create', 'CAPACITY', false],
  ['create', 'CONFLICT', false],
  ['update', 'SAVED', true],
  ['update', 'CONFLICT', false],
  ['remove', 'DELETED', true],
  ['remove', 'CONFLICT', false],
] as const)(
  'refreshes %s only after confirmed %s writes',
  async (kind, status, shouldRefresh) => {
    state[kind].mockResolvedValue({ status, id: record.id, revision: '2' });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi
      .spyOn(client, 'invalidateQueries')
      .mockResolvedValue();
    const view = renderHook(() => useScenarioMutations(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await act(async () => {
      await view.result.current[kind].mutateAsync({});
    });
    if (shouldRefresh)
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['personal-planning-scenarios'],
      });
    else expect(invalidate).not.toHaveBeenCalled();
  }
);
it('does not refresh or alter drafts on uncertain mutation errors', async () => {
  state.create.mockRejectedValue(new Error('Synthetic failure'));
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const view = renderHook(() => useScenarioMutations(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await act(async () => {
    await expect(view.result.current.create.mutateAsync({})).rejects.toThrow(
      'Synthetic failure'
    );
  });
  expect(invalidate).not.toHaveBeenCalled();
});
it('explains a missing scenario name after interaction', () => {
  mount(
    <ScenarioDialog
      initialPayload={{ ...payload, name: '' }}
      onClose={vi.fn()}
    />
  );
  fireEvent.blur(screen.getByLabelText('Scenario name'));
  expect(screen.getByText('Enter a scenario name to save.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save as new' })).toBeDisabled();
});

it('returns keyboard focus to the initiating row on Escape without saving', async () => {
  mount(<SalaryPlanner snapshot={{ id: '2026-10', entries: [] }} />);
  fireEvent.click(screen.getByRole('button', { name: /Saved scenarios/ }));
  const opener = await screen.findByRole('button', {
    name: 'Open Synthetic saved scenario',
  });
  opener.focus();
  fireEvent.click(opener);
  await waitFor(() =>
    expect(screen.getByLabelText('Scenario name')).toHaveFocus()
  );
  fireEvent.keyDown(screen.getByLabelText('Scenario name'), { key: 'Escape' });
  await waitFor(() => expect(opener).toHaveFocus());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  expect(state.create).not.toHaveBeenCalled();
});

it('keeps a scenario with overflowing displayed percentages unavailable without showing Infinity', () => {
  mount(
    <ScenarioDialog
      initialPayload={{
        ...payload,
        inputs: { ...payload.inputs, salary: 1e-300, expenses: 1e8 },
      }}
      onClose={vi.fn()}
    />
  );
  expect(screen.getByText(/nonfinite result/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save as new' })).toBeDisabled();
  expect(screen.queryByText(/Infinity/)).toBeNull();
  expect(state.create).not.toHaveBeenCalled();
});
