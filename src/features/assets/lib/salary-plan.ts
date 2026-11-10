import type { ExpenseData } from '@/features/expenses';
import { isCountedInExpenseTotals } from '@/features/expenses';
import { formatSGD } from '@/lib/utils/currency';
import { SHORTFALL_IMPACT_MONTHS } from '../constants';
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
 * the figure. The divisor runs from the first month with any expense to the
 * last full month (at most `months`), so quiet months in between count as 0.
 */
export function calcRecentAvgExpense(
  expenses: ExpenseData[] | undefined,
  now: Date,
  months = 12
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
  const first = Array.from(monthTotals.keys()).sort()[0];
  const [fy, fm] = first.split('-').map(Number);
  const span = (now.getFullYear() - fy) * 12 + (now.getMonth() + 1 - fm);
  const monthsUsed = Math.min(months, Math.max(1, span));
  return { average: total / monthsUsed, monthsUsed };
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
  /** Monthly set-aside for household goals and budgets; default 0. */
  householdMonthlyDeduction?: number;
  /** Accepted for old scenario payloads and ignored. */
  householdReserve?: number;
  /** Extra cushion on top of expenses, as a percent of expenses; default 0. */
  expenseBufferPct?: number;
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
  householdShortfallAmt: number;
  bufferPct: number;
  bufferAmt: number;
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
  const bufferInputPct = Math.max(0, input.expenseBufferPct ?? 0);
  const bufferAmt = (expenses * bufferInputPct) / 100;

  const netAfterCpf = salary * 0.8;

  const expensesPct = netAfterCpf > 0 ? expenses / netAfterCpf : 0;
  const insurancePct = 0.05;
  const tithePct = titheEnabled ? tithePctInput / 100 : 0;
  const allowancePct = allowanceEnabled ? allowancePctInput / 100 : 0;

  const emergencyFundGoal = ceilToThousand(expenses * emergencyMonths);
  const warChestGoal = ceilToThousand(expenses * warChestMonths);

  const householdPct =
    netAfterCpf > 0 ? householdMonthlyDeduction / netAfterCpf : 0;

  const bufferPct = netAfterCpf > 0 ? bufferAmt / netAfterCpf : 0;

  const usedPct =
    expensesPct +
    bufferPct +
    insurancePct +
    tithePct +
    allowancePct +
    householdPct;
  const available =
    netAfterCpf -
    expenses -
    bufferAmt -
    netAfterCpf * (insurancePct + tithePct + allowancePct) -
    householdMonthlyDeduction;
  const cappedPct = Math.max(1 - usedPct, 0);

  let savingsPct = 0;
  let investmentPct = 0;

  const emergencyFulfilled = currentSavings >= emergencyFundGoal;
  const warChestFulfilled = currentBonds >= warChestGoal;
  const goalsFulfilled = emergencyFulfilled && warChestFulfilled;

  const goalsNeeded = emergencyFundGoal + warChestGoal;
  const goalsFunded = currentSavings + currentBonds;

  if (netAfterCpf > 0) {
    if (!goalsFulfilled && usedPct < 1) {
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
    householdShortfallAmt: Math.max(0, -available),
    bufferPct,
    bufferAmt,
  };
}

/** One-line status shown above the plan; always returns text. */
export function planStateLine(plan: SalaryPlan): string {
  if (!plan.goalsFulfilled) {
    const short = Math.max(0, plan.goalsNeeded - plan.goalsFunded);
    return `Savings ${formatSGD(short)} short of emergency + war chest (${formatSGD(plan.goalsNeeded)})`;
  }
  return `Investing ${formatSGD(plan.investmentAmt)} a month`;
}

/**
 * A shortfall caused by a deadline N months away stops recurring once that
 * deadline passes, so the projection never runs longer than the binding
 * deadline nor than the cap.
 */
export function shortfallImpactMonths(bindingMonths: number | null): number {
  if (bindingMonths === null || !Number.isFinite(bindingMonths))
    return SHORTFALL_IMPACT_MONTHS;
  return Math.min(Math.max(1, bindingMonths), SHORTFALL_IMPACT_MONTHS);
}

export interface ShortfallImpactInput {
  shortfallPerMonth: number;
  /** Months the shortfall repeats; callers cap it at SHORTFALL_IMPACT_MONTHS. */
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
