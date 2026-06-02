import type { ExpenseData } from '@/features/expenses';
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
    const key = e.date.slice(0, 7);
    let userAmount = e.amount;
    if (e.splitType === 'shared' && e.splits.length > 0) {
      userAmount = e.amount - e.splits.reduce((sum, s) => sum + s.amount, 0);
    }
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + userAmount);
  }
  const totals = Array.from(monthTotals.values());
  return totals.reduce((sum, v) => sum + v, 0) / totals.length;
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

  const netAfterCpf = salary * 0.8;

  const expensesPct = netAfterCpf > 0 ? expenses / netAfterCpf : 0;
  const insurancePct = 0.05;
  const tithePct = titheEnabled ? tithePctInput / 100 : 0;
  const allowancePct = allowanceEnabled ? allowancePctInput / 100 : 0;

  const emergencyFundGoal = ceilToThousand(expenses * emergencyMonths);
  const warChestGoal = ceilToThousand(expenses * warChestMonths);

  const usedPct = expensesPct + insurancePct + tithePct + allowancePct;
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
  };
}
