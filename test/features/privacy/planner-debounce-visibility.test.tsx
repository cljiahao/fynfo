// @vitest-environment jsdom
import { SalaryPlanner } from '@/features/assets/components/salary-planner';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  getSalaryRecords: vi.fn(),
  getExpenses: vi.fn(),
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
  getScenarios: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}));
vi.mock('@/features/salary/actions/salary-actions', () => ({
  getSalaryRecords: api.getSalaryRecords,
}));
vi.mock('@/features/expenses/actions/expense-actions', () => ({
  getExpenses: api.getExpenses,
}));
vi.mock('@/features/assets/actions/planner-actions', () => ({
  getPlannerSettings: api.getPlannerSettings,
  upsertPlannerSettings: api.upsertPlannerSettings,
}));
vi.mock('@/features/assets/actions/scenario-actions', () => ({
  getScenarios: api.getScenarios,
  createScenario: api.createScenario,
  updateScenario: api.updateScenario,
  deleteScenario: api.deleteScenario,
}));
const settings = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: true,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
};
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  api.getSalaryRecords.mockResolvedValue([]);
  api.getExpenses.mockResolvedValue([]);
  api.getPlannerSettings.mockResolvedValue(settings);
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.getScenarios.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.useRealTimers();
});
async function mountPlanner() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <SalaryPlanner />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
  await screen.findByLabelText('Gross Salary');
  fireEvent.click(screen.getByRole('button', { name: 'Adjust reserves' }));
  const input = screen.getByLabelText('Emergency Fund (months)');
  vi.useFakeTimers();
  return input;
}
async function finishDebounce() {
  await act(async function advanceDebounce() {
    await vi.advanceTimersByTimeAsync(900);
  });
}
describe('actual salary planner delayed-save visibility', () => {
  it('preserves the draft and suppresses a queued save while hidden and after showing', async () => {
    const input = await mountPlanner();
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(input).toHaveValue(null);
    expect(input).toBeDisabled();
    await finishDebounce();
    expect(api.upsertPlannerSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(input).toHaveValue(4);
    await finishDebounce();
    expect(api.upsertPlannerSettings).not.toHaveBeenCalled();
  });
  it('suppresses a queued Hide/Show save but permits a fresh visible edit', async () => {
    const input = await mountPlanner();
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    await finishDebounce();
    expect(api.upsertPlannerSettings).not.toHaveBeenCalled();
    expect(input).toHaveValue(4);
    fireEvent.change(input, { target: { value: '5' } });
    await finishDebounce();
    expect(api.upsertPlannerSettings).toHaveBeenCalledTimes(1);
    expect(api.upsertPlannerSettings).toHaveBeenCalledWith({
      ...settings,
      emergencyMonths: 5,
    });
  });
});
