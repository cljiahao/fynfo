// @vitest-environment jsdom
import { SalaryPlanner } from '@/features/assets/components/salary-planner';
import { AmountVisibilityProvider } from '@/features/privacy';
import { toSalaryData } from '@/features/salary/lib/income-aggregates';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSalaryRecords: vi.fn(),
  getExpenses: vi.fn(),
  getPlannerSettings: vi.fn(),
  getScenarios: vi.fn(),
  getPlannerCommitment: vi.fn(),
}));
vi.mock('@/features/salary/actions/salary-actions', () => ({
  getSalaryRecords: api.getSalaryRecords,
}));
vi.mock('@/features/expenses/actions/expense-actions', () => ({
  getExpenses: api.getExpenses,
}));
vi.mock('@/features/assets/actions/planner-actions', () => ({
  getPlannerSettings: api.getPlannerSettings,
  upsertPlannerSettings: vi.fn(),
}));
vi.mock('@/features/assets/actions/scenario-actions', () => ({
  getScenarios: api.getScenarios,
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}));
vi.mock('@/features/household/actions/planner-actions', () => ({
  getPlannerCommitment: api.getPlannerCommitment,
}));

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <SalaryPlanner />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.getExpenses.mockResolvedValue([]);
  api.getPlannerSettings.mockResolvedValue(null);
  api.getScenarios.mockResolvedValue([]);
  api.getPlannerCommitment.mockResolvedValue({ state: 'none' });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('uses the recurring total of the latest month with a salary line and skips a one-time-only month', async () => {
  api.getSalaryRecords.mockResolvedValue([
    toSalaryData('2026-01', [
      { id: 'a', type: 'salary', label: 'Acme', amount: 3000 },
      { id: 'b', type: 'salary', label: 'Side', amount: 1000 },
      { id: 'c', type: 'bonus', label: 'Bonus', amount: 2000 },
    ]),
    toSalaryData('2026-02', [
      { id: 'd', type: 'one_time', label: 'Refund', amount: 700 },
    ]),
  ]);
  mount();
  expect(await screen.findByTestId('planner-salary')).toHaveTextContent(
    '$4,000'
  );
  const other = screen.getByTestId('planner-other-income');
  expect(other).toHaveTextContent('$2,000');
  expect(other).toHaveTextContent('$700');
});

it('hides the un-planned income line without bonus or one-time income', async () => {
  api.getSalaryRecords.mockResolvedValue([
    toSalaryData('2026-01', [
      { id: 'a', type: 'salary', label: 'Acme', amount: 5000 },
    ]),
  ]);
  mount();
  await screen.findByTestId('planner-salary');
  expect(screen.queryByTestId('planner-other-income')).toBeNull();
});
