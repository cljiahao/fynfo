import type { ExpenseData } from '@/features/expenses';
import { isCountedInExpenseTotals } from '@/features/expenses';
import { formatSGD } from '@/lib/utils/currency';
import type { AssetCategory, SnapshotData } from '../types';

export function ceilToThousand(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

export function sumByCategory(
  entries: SnapshotData['entries'],
  category: AssetCategory
): number {
  return entries
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * All-time average of the user's *own* monthly expense (shared splits subtract
 * the other people's portions). Averages across the months that have data.
 */
export function calcAllTimeAvgExpense(
  expenses: ExpenseData[] | undefined
): number {
  if (!expenses?.length) return 0;
  const monthTotals = new Map<string, number>();
  for (const e of expenses) {
    if (!isCountedInExpenseTotals(e.type)) continue;
    const key = e.date.slice(0, 7);
    let userAmount = e.amount;
    if (e.splitType === 'shared' && e.splits.length > 0) {
      userAmount = e.amount - e.splits.reduce((sum, s) => sum + s.amount, 0);
    }
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + userAmount);
  }
  const totals = Array.from(monthTotals.values());
  if (totals.length === 0) return 0;
  return totals.reduce((sum, v) => sum + v, 0) / totals.length;
}

function userExpenseAmount(e: ExpenseData): number {
  if (e.splitType === 'shared' && e.splits.length > 0) {
    return e.amount - e.splits.reduce((sum, s) => sum + s.amount, 0);
  }
  return e.amount;
}

export interface RecentAvgExpense {
  average: number;
  monthsUsed: number;
}

/**
 * Average of the user's own monthly expense over the last `months` full
 * calendar months, leaving out the current partial month so it cannot dilute
 * the figure. Only months in the window that have data are averaged.
 */
export function calcRecentAvgExpense(
  expenses: ExpenseData[] | undefined,
  now: Date,
  months = 6
): RecentAvgExpense {
  if (!expenses?.length || months <= 0) return { average: 0, monthsUsed: 0 };
  const monthKey = (y: number, m: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}`;
  const end = monthKey(now.getFullYear(), now.getMonth());
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const start = monthKey(startDate.getFullYear(), startDate.getMonth());

  const monthTotals = new Map<string, number>();
  for (const e of expenses) {
    if (!isCountedInExpenseTotals(e.type)) continue;
    const key = e.date.slice(0, 7);
    if (key < start || key >= end) continue;
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + userExpenseAmount(e));
  }
  if (monthTotals.size === 0) return { average: 0, monthsUsed: 0 };
  const total = Array.from(monthTotals.values()).reduce((a, v) => a + v, 0);
  return { average: total / monthTotals.size, monthsUsed: monthTotals.size };
}

export interface SalaryPlanInput {
  salary: number;
  expenses: number;
  emergencyMonths: number;
  warChestMonths: number;
  titheEnabled: boolean;
  tithePctInput: number;
  allowanceEnabled: boolean;
  allowancePctInput: number;
  currentSavings: number;
  currentBonds: number;
  /** Monthly household budget share plus long-dated goal pace; default 0. */
  householdMonthlyDeduction?: number;
  /** Caller's share of goals due within the horizon; default 0. */
  householdReserve?: number;
}

export interface SalaryPlan {
  netAfterCpf: number;
  expensesPct: number;
  insurancePct: number;
  tithePct: number;
  allowancePct: number;
  savingsPct: number;
  investmentPct: number;
  emergencyFundGoal: number;
  warChestGoal: number;
  emergencyFulfilled: boolean;
  warChestFulfilled: boolean;
  goalsFulfilled: boolean;
  goalsNeeded: number;
  goalsFunded: number;
  savingsAmt: number;
  expensesAmt: number;
  insuranceAmt: number;
  investmentAmt: number;
  titheAmt: number;
  allowanceAmt: number;
  householdPct: number;
  householdAmt: number;
  householdReserve: number;
  savingsTarget: number;
  savingsGap: number;
  investmentPaused: boolean;
  householdShortfallAmt: number;
}

/**
 * Monthly take-home allocation. Net is salary after a flat 20% CPF. Fixed
 * slices (expenses, 5% insurance, optional tithe/allowance) are taken first;
 * the remainder funds savings until the emergency + war-chest goals are met,
 * then flows to investment. Pure — all inputs passed in.
 */
export function computeSalaryPlan(input: SalaryPlanInput): SalaryPlan {
  const {
    salary,
    expenses,
    emergencyMonths,
    warChestMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
    currentSavings,
    currentBonds,
  } = input;
  const householdMonthlyDeduction = Math.max(
    0,
    input.householdMonthlyDeduction ?? 0
  );
  const householdReserve = Math.max(0, input.householdReserve ?? 0);

  const netAfterCpf = salary * 0.8;

  const expensesPct = netAfterCpf > 0 ? expenses / netAfterCpf : 0;
  const insurancePct = 0.05;
  const tithePct = titheEnabled ? tithePctInput / 100 : 0;
  const allowancePct = allowanceEnabled ? allowancePctInput / 100 : 0;

  const emergencyFundGoal = ceilToThousand(expenses * emergencyMonths);
  const warChestGoal = ceilToThousand(expenses * warChestMonths);

  const householdPct =
    netAfterCpf > 0 ? householdMonthlyDeduction / netAfterCpf : 0;

  const usedPct =
    expensesPct + insurancePct + tithePct + allowancePct + householdPct;
  const cappedPct = Math.max(1 - usedPct, 0);

  let savingsPct = 0;
  let investmentPct = 0;

  const emergencyFulfilled = currentSavings >= emergencyFundGoal;
  const warChestFulfilled = currentBonds >= warChestGoal;
  const goalsFulfilled = emergencyFulfilled && warChestFulfilled;

  const goalsNeeded = emergencyFundGoal + warChestGoal;
  const goalsFunded = currentSavings + currentBonds;

  const savingsTarget = goalsNeeded + householdReserve;
  // Strict all-to-savings applies only while the household reserve is
  // unfunded, so plans without a household keep the 9-month spread.
  const reserveGap = Math.max(
    0,
    householdReserve - Math.max(0, goalsFunded - goalsNeeded)
  );

  if (netAfterCpf > 0) {
    if (reserveGap > 0) {
      savingsPct = cappedPct;
    } else if (!goalsFulfilled && usedPct < 1) {
      const remaining = Math.max(goalsNeeded - goalsFunded, 0);
      const average = remaining / 9;
      const cappedAmount = cappedPct * netAfterCpf;
      savingsPct = average < cappedAmount ? average / netAfterCpf : cappedPct;
    }
    investmentPct = Math.max(cappedPct - savingsPct, 0);
  }

  return {
    netAfterCpf,
    expensesPct,
    insurancePct,
    tithePct,
    allowancePct,
    savingsPct,
    investmentPct,
    emergencyFundGoal,
    warChestGoal,
    emergencyFulfilled,
    warChestFulfilled,
    goalsFulfilled,
    goalsNeeded,
    goalsFunded,
    savingsAmt: netAfterCpf * savingsPct,
    expensesAmt: expenses,
    insuranceAmt: netAfterCpf * insurancePct,
    investmentAmt: netAfterCpf * investmentPct,
    titheAmt: netAfterCpf * tithePct,
    allowanceAmt: netAfterCpf * allowancePct,
    householdPct,
    householdAmt: householdMonthlyDeduction,
    householdReserve,
    savingsTarget,
    savingsGap: Math.max(0, savingsTarget - goalsFunded),
    investmentPaused: reserveGap > 0,
    householdShortfallAmt: Math.max(
      0,
      -(
        netAfterCpf -
        expenses -
        netAfterCpf * insurancePct -
        netAfterCpf * tithePct -
        netAfterCpf * allowancePct -
        householdMonthlyDeduction
      )
    ),
  };
}

/** One-line status shown above the plan; always returns text. */
export function planStateLine(plan: SalaryPlan): string {
  if (plan.investmentPaused) {
    return `Investing paused: savings ${formatSGD(plan.savingsGap)} short of emergency + war chest + household reserve (${formatSGD(plan.savingsTarget)})`;
  }
  if (!plan.goalsFulfilled) {
    return `Savings ${formatSGD(plan.savingsGap)} short of emergency + war chest (${formatSGD(plan.savingsTarget)})`;
  }
  return `Investing ${formatSGD(plan.investmentAmt)} a month`;
}

export interface ShortfallImpactInput {
  shortfallPerMonth: number;
  monthsHorizon: number;
  currentSavings: number;
  expenses: number;
  emergencyMonths: number;
}

export interface ShortfallImpact {
  projectedSavings: number;
  monthsCovered: number;
  emergencyMonths: number;
}

/**
 * Projects the savings balance after drawing the monthly shortfall for the
 * horizon. Only the savings category is drawn, not bonds.
 */
export function computeShortfallImpact(
  input: ShortfallImpactInput
): ShortfallImpact {
  const projectedSavings =
    input.currentSavings - input.shortfallPerMonth * input.monthsHorizon;
  return {
    projectedSavings,
    monthsCovered:
      input.expenses > 0 ? Math.max(0, projectedSavings) / input.expenses : 0,
    emergencyMonths: input.emergencyMonths,
  };
}
