// @vitest-environment jsdom
import { SalaryPlanner } from '@/features/assets/components/salary-planner';
import { AmountVisibilityProvider } from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { salaryRow } from '../../helpers/salary-fixture';

const api = vi.hoisted(() => ({
  getSalaryRecords: vi.fn(),
  getExpenses: vi.fn(),
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
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
  upsertPlannerSettings: api.upsertPlannerSettings,
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

const SETTINGS = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: false,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
};

function lastMonthExpense() {
  const now = new Date();
  return {
    id: 'a',
    date: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString(),
    type: 'food_drink',
    item: 'a',
    info: '',
    amount: 1000,
    splitType: 'self',
    splits: [],
  };
}

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
  api.getSalaryRecords.mockResolvedValue([
    salaryRow('2026-01', 4000, 0),
    salaryRow('2026-02', 5000, 0),
  ]);
  api.getExpenses.mockResolvedValue([lastMonthExpense()]);
  api.getPlannerSettings.mockResolvedValue(SETTINGS);
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.getScenarios.mockResolvedValue([]);
  api.getPlannerCommitment.mockResolvedValue({ state: 'none' });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('planner salary and buffer', () => {
  it('shows the latest salary record read-only with a link to the Salary page', async () => {
    mount();
    const salary = await screen.findByTestId('planner-salary');
    expect(salary.textContent).toContain('$5,000');
    expect(screen.queryByLabelText('Gross Salary')).toBeNull();
    expect(
      screen.getByRole('link', { name: /latest salary record/ })
    ).toHaveAttribute('href', '/dashboard/salary');
  });

  it('adds no buffer line by default', async () => {
    mount();
    await screen.findByTestId('planner-salary');
    expect(screen.queryByText(/^Buffer /)).toBeNull();
  });

  it('shows a separate buffer line when a buffer is stored', async () => {
    api.getPlannerSettings.mockResolvedValue({
      ...SETTINGS,
      expenseBufferPct: 10,
    });
    mount();
    expect(await screen.findByText('Buffer 10%')).toBeTruthy();
  });
});
