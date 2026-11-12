// @vitest-environment jsdom
import { FreedomCard } from '@/features/assets/components/freedom-card';
import {
  SalaryPlanner,
  type PlannerValues,
} from '@/features/assets/components/salary-planner';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { format } from 'date-fns/format';
import { useCallback, useState } from 'react';
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
vi.mock('@/features/assets/components/planning-scenarios', () => ({
  PlanningScenarios: () => null,
}));
vi.mock('@/features/equity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/equity')>()),
  useDividends: () => ({ data: [] }),
  useExchangeRate: () => ({ data: 1.3, isError: false }),
}));

const published = vi.hoisted(() => ({ last: null as PlannerValues | null }));

const SETTINGS = {
  emergencyMonths: 6,
  warChestMonths: 6,
  titheEnabled: false,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
  expenseBufferPct: 0,
};
const WITH_ASSUMPTIONS = {
  ...SETTINGS,
  freedomRealReturnPct: 4,
  freedomWithdrawalRatePct: 3.5,
};

const snapshot = (stocks: number) => ({
  id: '2026-10',
  entries: [{ category: 'stocks' as const, account: 'a', amount: stocks }],
});

const SNAPSHOT = snapshot(100_000);

function plannerValues(over: Partial<PlannerValues> = {}): PlannerValues {
  return {
    investmentAmount: 1000,
    emergencyFundGoal: 0,
    warChestGoal: 0,
    householdEarmark: 0,
    expenses: 3000,
    savingsAmt: 0,
    netAfterCpf: 8000,
    bufferAmt: 0,
    budgetsMonthly: 0,
    goalsMonthly: 0,
    householdGoalsMonthlyByYear: [],
    householdGoalEnds: [],
    householdIncluded: false,
    expenseDriftPct: null,
    expensesOverridden: false,
    safetyRelease: null,
    ...over,
  };
}

function Hider() {
  const { hideAmounts } = useAmountVisibility();
  return <button onClick={hideAmounts}>Hide amounts</button>;
}

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <Hider />
        {children}
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

function renderCard(
  planner: PlannerValues,
  stocks: number | null,
  settings: unknown = WITH_ASSUMPTIONS
) {
  api.getPlannerSettings.mockResolvedValue(settings);
  return render(
    wrap(
      <FreedomCard
        planner={planner}
        snapshot={stocks === null ? undefined : snapshot(stocks)}
      />
    )
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.getScenarios.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FreedomCard states', () => {
  it('invites assumptions when none are saved', async () => {
    renderCard(plannerValues(), 100_000, SETTINGS);
    expect(
      await screen.findByText(/Add your return and withdrawal assumptions/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add assumptions' })
    ).toBeInTheDocument();
  });

  it('asks for expenses when there is no living cost', async () => {
    renderCard(plannerValues({ expenses: 0 }), 100_000);
    expect(
      await screen.findByText('Add expenses to set a freedom number.')
    ).toBeInTheDocument();
  });

  it('says the projection is unavailable for unusable figures', async () => {
    renderCard(plannerValues({ expenses: Number.NaN }), 100_000);
    expect(
      await screen.findByText(/Projection unavailable/)
    ).toBeInTheDocument();
  });

  it('leads with the empty portfolio when nothing is invested', async () => {
    renderCard(plannerValues(), null);
    expect(
      await screen.findByText(/No invested portfolio yet\. On track for/)
    ).toBeInTheDocument();
  });

  it('says so when the portfolio already covers living costs', async () => {
    renderCard(plannerValues(), 10_000_000);
    expect(
      await screen.findByText(
        'Your portfolio already covers your living costs at your assumptions.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show detail' }));
    const row = screen.getByText('Base case').closest('div') as HTMLElement;
    expect(row).toHaveTextContent(format(new Date(), 'MMM yyyy'));
  });

  it('says when the date is not reached within the cap', async () => {
    renderCard(plannerValues({ expenses: 100_000, investmentAmount: 0 }), 1000);
    expect(
      await screen.findByText(/Not reached within 60 years at this pace\./)
    ).toBeInTheDocument();
  });

  it('says when only the low case is not reached', async () => {
    renderCard(
      plannerValues({ expenses: 1450, investmentAmount: 0 }),
      100_000,
      {
        ...SETTINGS,
        freedomRealReturnPct: 2,
        freedomWithdrawalRatePct: 3.5,
      }
    );
    expect(
      await screen.findByText(/From \d{4}; the low case is not reached/)
    ).toBeInTheDocument();
  });

  it('shows a range with its assumptions and the disclaimer', async () => {
    renderCard(plannerValues(), 100_000);
    expect(
      await screen.findByText(/\d+% of the way\. On track for/)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Assumes 4% real return (+/- 2), 3.5% withdrawal rate.')
    ).toBeInTheDocument();
    expect(screen.getByText(/not a forecast or advice/)).toBeInTheDocument();
  });
});

describe('FreedomCard levers', () => {
  const endMonth = format(
    new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1),
    'yyyy-MM'
  );
  const withLevers = (over: Partial<PlannerValues> = {}) =>
    plannerValues({
      expenseDriftPct: 20,
      householdIncluded: true,
      householdGoalEnds: [
        { goalId: 'g1', name: 'Holiday', endMonth, extraInvesting: 300 },
      ],
      ...over,
    });

  async function openLevers() {
    fireEvent.click(await screen.findByRole('button', { name: 'Show detail' }));
    const showAll = screen.queryByRole('button', { name: 'Show all' });
    if (showAll) fireEvent.click(showAll);
    const heading = screen.getByRole('heading', { name: 'What could move it' });
    return heading.parentElement as HTMLElement;
  }

  it('masks goal names and amounts but not percentages or years when hidden', async () => {
    renderCard(withLevers(), 100_000);
    const levers = await openLevers();
    expect(levers).toHaveTextContent(/Holiday/);
    expect(levers).toHaveTextContent(/\$300/);

    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(levers).not.toHaveTextContent(/Holiday/);
    expect(levers).not.toHaveTextContent(/\$/);
    expect(levers).not.toHaveTextContent(/300/);
    expect(levers).toHaveTextContent(/20% above/);
    expect(levers).toHaveTextContent(new RegExp(endMonth.slice(0, 4)));
    expect(screen.getByText(/\d+% of the way/)).toBeInTheDocument();
  });

  it('words the drift against the 12-month average without an override', async () => {
    renderCard(withLevers(), 100_000);
    const levers = await openLevers();
    expect(levers).toHaveTextContent(/above your 12-month average/);
  });

  it('words the drift against planner expenses when an override is active', async () => {
    renderCard(withLevers({ expensesOverridden: true }), 100_000);
    const levers = await openLevers();
    expect(levers).toHaveTextContent(
      /12-month spending is 20% above the expenses entered in the planner/
    );
    expect(levers).not.toHaveTextContent(/above your 12-month average/);
  });
});

describe('FreedomCard layout at 375px', () => {
  it('uses no fixed widths outside the scrolling table', async () => {
    const { container } = renderCard(
      plannerValues({ householdIncluded: true, expenseDriftPct: 20 }),
      100_000
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show detail' }));
    const table = await screen.findByRole('table');
    expect(table.closest('.overflow-x-auto')).not.toBeNull();

    const fixed =
      /(^|\s)(w-\[[^\]]+\]|min-w-(?!0(\s|$))\S+|w-screen|w-\d{2,}|max-w-none)(\s|$)/;
    const offenders = Array.from(container.querySelectorAll('*'))
      .filter((el) => !el.closest('.overflow-x-auto'))
      .filter((el) => fixed.test(el.getAttribute('class') ?? ''))
      .map((el) => el.getAttribute('class'));
    expect(offenders).toEqual([]);
  });
});

describe('household unavailable', () => {
  function Harness() {
    const [values, setValues] = useState<PlannerValues | null>(null);
    const onChange = useCallback((next: PlannerValues) => {
      published.last = next;
      setValues(next);
    }, []);
    return (
      <>
        <SalaryPlanner snapshot={SNAPSHOT} onPlannerValuesChange={onChange} />
        {values && <FreedomCard planner={values} snapshot={SNAPSHOT} />}
      </>
    );
  }

  async function runCase(arrange: () => void) {
    published.last = null;
    api.getSalaryRecords.mockResolvedValue([salaryRow('2026-01', 5000, 0)]);
    const date = (months: number) =>
      new Date(
        new Date().getFullYear(),
        new Date().getMonth() - months,
        15,
        12
      ).toISOString();
    api.getExpenses.mockResolvedValue(
      [1, 2].map((months) => ({
        id: `e${months}`,
        date: date(months),
        type: 'food_drink',
        item: 'x',
        info: '',
        amount: 1000,
        splitType: 'self',
        splits: [],
      }))
    );
    api.getPlannerSettings.mockResolvedValue(WITH_ASSUMPTIONS);
    arrange();
    render(wrap(<Harness />));
    await screen.findByText(/Net \(after CPF\)/);
    await waitFor(() => expect(published.last?.expenses).toBe(1000));
    const summary = (await screen.findByText(/\d+% of the way\. On track for/))
      .textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Show detail' }));
    expect(
      await screen.findByText('Household goals not included.')
    ).toBeInTheDocument();
    const values = published.last;
    if (values === null) throw new Error('planner values were not published');
    cleanup();
    return { summary, values };
  }

  it('matches the no-household projection for locked, loading and error', async () => {
    const baseline = await runCase(() =>
      api.getHouseholdPlanInput.mockResolvedValue({
        state: 'none',
        isDefaultSplit: false,
        callerShares: { default: 0.5 },
        goals: [],
        budgets: [],
      })
    );
    const cases: [string, () => void][] = [
      [
        'locked',
        () =>
          api.getHouseholdPlanInput.mockResolvedValue({
            state: 'locked',
            isDefaultSplit: false,
            callerShares: { default: 0.5 },
            goals: [],
            budgets: [],
          }),
      ],
      [
        'loading',
        () =>
          api.getHouseholdPlanInput.mockReturnValue(
            new Promise(() => undefined)
          ),
      ],
      [
        'error',
        () => api.getHouseholdPlanInput.mockRejectedValue(new Error('boom')),
      ],
    ];
    for (const [, arrange] of cases) {
      const result = await runCase(arrange);
      expect(result.summary).toBe(baseline.summary);
      expect(result.values).toEqual(baseline.values);
    }
    expect(baseline.values).toMatchObject({
      householdIncluded: false,
      householdGoalsMonthlyByYear: [],
      householdGoalEnds: [],
      budgetsMonthly: 0,
      goalsMonthly: 0,
      householdEarmark: 0,
    });
  });
});
