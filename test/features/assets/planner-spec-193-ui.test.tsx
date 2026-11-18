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
  getHouseholdPlanInput: vi.fn(),
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
vi.mock('@/features/household/actions/plan-actions', () => ({
  getHouseholdPlanInput: api.getHouseholdPlanInput,
}));

const SETTINGS = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: false,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
};

function expense(monthsAgo: number, amount: number, type = 'food_drink') {
  const now = new Date();
  return {
    id: `${type}-${monthsAgo}`,
    date: new Date(
      now.getFullYear(),
      now.getMonth() - monthsAgo,
      15
    ).toISOString(),
    type,
    item: 'x',
    info: '',
    amount,
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
  api.getSalaryRecords.mockResolvedValue([salaryRow('2026-02', 5000, 0)]);
  api.getPlannerSettings.mockResolvedValue(SETTINGS);
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.getScenarios.mockResolvedValue([]);
  api.getHouseholdPlanInput.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('expense trend beside the expenses input', () => {
  it('shows up with the rounded percent', async () => {
    api.getExpenses.mockResolvedValue([
      expense(4, 1000),
      expense(3, 1500),
      expense(2, 1500),
      expense(1, 1500),
    ]);
    mount();
    expect((await screen.findByTestId('expense-trend')).textContent).toMatch(
      /9% above average/
    );
  });

  it('shows down with the rounded percent', async () => {
    api.getExpenses.mockResolvedValue([
      expense(4, 2000),
      expense(3, 1000),
      expense(2, 1000),
      expense(1, 1000),
    ]);
    mount();
    expect((await screen.findByTestId('expense-trend')).textContent).toMatch(
      /20% below average/
    );
  });

  it('shows steady inside the 5% band', async () => {
    api.getExpenses.mockResolvedValue(
      [4, 3, 2, 1].map((m) => expense(m, 1000))
    );
    mount();
    expect((await screen.findByTestId('expense-trend')).textContent).toBe(
      'Spending is steady'
    );
  });

  it('is hidden until 3 full months of data', async () => {
    api.getExpenses.mockResolvedValue([expense(2, 1000), expense(1, 2000)]);
    mount();
    await screen.findByTestId('planner-salary');
    expect(screen.queryByTestId('expense-trend')).toBeNull();
  });

  it('shows the planned savings rate', async () => {
    api.getExpenses.mockResolvedValue([expense(1, 1000)]);
    mount();
    expect(
      (await screen.findByTestId('planned-savings-rate')).textContent
    ).toMatch(/Planned savings rate \d+% of take-home/);
  });
});

describe('premiums hint', () => {
  it('shows premiums as a share of take-home when insurance expenses exist', async () => {
    api.getExpenses.mockResolvedValue([
      expense(1, 1000),
      expense(1, 300, 'insurance'),
    ]);
    mount();
    const hint = await screen.findByTestId('insurance-hint');
    expect(hint.textContent).toMatch(/planned at 5% of take-home/);
    expect(hint.textContent).toMatch(/premiums average 7\.5% of take-home/);
  });

  it('is hidden without insurance expenses', async () => {
    api.getExpenses.mockResolvedValue([expense(1, 1000)]);
    mount();
    await screen.findByTestId('planner-salary');
    expect(screen.queryByTestId('insurance-hint')).toBeNull();
  });
});
