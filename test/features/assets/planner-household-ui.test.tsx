// @vitest-environment jsdom
import { SalaryPlanner } from '@/features/assets/components/salary-planner';
import { AmountVisibilityProvider } from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const OVERRIDE_KEY = 'fynfo:planner-expenses-override';

function monthsAgoIso(months: number): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth() - months,
    15,
    12
  ).toISOString();
}

function expense(id: string, monthsAgo: number, amount: number) {
  return {
    id,
    date: monthsAgoIso(monthsAgo),
    type: 'food_drink',
    item: id,
    info: '',
    amount,
    splitType: 'self',
    splits: [],
  };
}

function ready(monthlyDeduction: number) {
  return {
    state: 'ready',
    isDefaultSplit: false,
    reserve: 0,
    monthlyDeduction,
    goals: [],
    budgets: { monthlyTotal: 0, share: 0.5, monthlyShare: 0 },
    excluded: [],
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
    { id: '2026-01', salary: 5000, bonus: 0 },
  ]);
  api.getExpenses.mockResolvedValue([
    expense('a', 1, 1000),
    expense('b', 2, 1000),
  ]);
  api.getPlannerSettings.mockResolvedValue(null);
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.getScenarios.mockResolvedValue([]);
  api.getPlannerCommitment.mockResolvedValue({ state: 'none' });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('planner expenses source', () => {
  it('follows the recent average, then keeps a custom value until reset', async () => {
    mount();
    await screen.findByText(/Avg of last 2 full months/);
    expect(screen.getByLabelText('Expenses')).toHaveValue(1000);

    fireEvent.change(screen.getByLabelText('Expenses'), {
      target: { value: '1500' },
    });
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(window.localStorage.getItem(OVERRIDE_KEY)).toBe('1500');

    fireEvent.click(screen.getByRole('button', { name: /Reset to average/ }));
    await waitFor(() =>
      expect(screen.getByLabelText('Expenses')).toHaveValue(1000)
    );
    expect(screen.getByText(/Avg of last 2 full months/)).toBeTruthy();
    expect(window.localStorage.getItem(OVERRIDE_KEY)).toBeNull();
  });

  it('restores a stored override on mount', async () => {
    window.localStorage.setItem(OVERRIDE_KEY, '777');
    mount();
    await screen.findByText('Custom');
    expect(screen.getByLabelText('Expenses')).toHaveValue(777);
  });
});

describe('planner household states', () => {
  it('prompts to unlock when the household key is not in session', async () => {
    api.getPlannerCommitment.mockResolvedValue({
      ...ready(0),
      state: 'locked',
    });
    mount();
    expect(await screen.findByText(/Unlock your household/)).toBeTruthy();
  });

  it('says household is not included when the commitment fails to load', async () => {
    api.getPlannerCommitment.mockRejectedValue(new Error('boom'));
    mount();
    expect(
      await screen.findByText(/could not be loaded, so they are not included/)
    ).toBeTruthy();
    expect(screen.getByText('Gross Salary')).toBeTruthy();
  });

  it('shows the shortfall alert when household exceeds take-home', async () => {
    api.getPlannerCommitment.mockResolvedValue(ready(5000));
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/a month/);
    expect(alert).toHaveTextContent(/Savings and investment are 0/);
  });

  it('offers the personal household horizon in settings when in a household', async () => {
    api.getPlannerCommitment.mockResolvedValue(ready(500));
    mount();
    await screen.findByText(/Net \(after CPF\)/);
    fireEvent.click(screen.getByRole('button', { name: 'Adjust settings' }));
    expect(
      await screen.findByLabelText('Household horizon (months)')
    ).toHaveValue(24);
  });
});
