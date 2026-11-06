import type { SnapshotData } from '@/features/assets';
import type { ExpenseData } from '@/features/expenses';
import { isCountedInExpenseTotals } from '@/features/expenses';
import type { SalaryData } from '@/features/salary';

type AssetEntryData = SnapshotData['entries'][number];

export interface CategoryAmount {
  key: string;
  amount: number;
}

function sortedById<T extends { id: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function shiftMonth(period: string, delta: number): string {
  const [year, month] = period.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function topCategories(
  entries: AssetEntryData[],
  limit: number
): CategoryAmount[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(
      entry.category,
      (totals.get(entry.category) ?? 0) + entry.amount
    );
  }
  return [...totals]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, amount]) => ({ key, amount }));
}

export interface SnapshotGlance {
  latest: SnapshotData;
  /** Null when there is no earlier snapshot. */
  change: number | null;
}

export function snapshotGlance(
  snapshots: SnapshotData[],
  total: (entries: AssetEntryData[]) => number
): SnapshotGlance | undefined {
  const sorted = sortedById(snapshots);
  const latest = sorted.at(-1);
  if (!latest) return undefined;
  const previous = sorted.at(-2);
  return {
    latest,
    change: previous
      ? roundCents(total(latest.entries) - total(previous.entries))
      : null,
  };
}

export interface SalaryGlance {
  latest: SalaryData;
  /** Percent change against the record about 12 months earlier; null without one. */
  yearPct: number | null;
  /** First month of the current unchanged salary run. */
  sinceMonth: string;
  lastRaise: { pct: number; month: string } | null;
  latestBonus: { amount: number; month: string } | null;
}

export function salaryGlance(salary: SalaryData[]): SalaryGlance | undefined {
  const sorted = sortedById(salary);
  const latest = sorted.at(-1);
  if (!latest) return undefined;
  const cutoff = shiftMonth(latest.id, -12);
  const yearAgo = sorted.findLast((record) => record.id <= cutoff);
  const yearPct =
    yearAgo && yearAgo.salary > 0
      ? ((latest.salary - yearAgo.salary) / yearAgo.salary) * 100
      : null;
  let sinceMonth = latest.id;
  let inRun = true;
  let lastRaise: SalaryGlance['lastRaise'] = null;
  for (let i = sorted.length - 1; i > 0; i--) {
    const current = sorted[i];
    const before = sorted[i - 1];
    if (inRun && current.salary === latest.salary) {
      if (before.salary === latest.salary) sinceMonth = before.id;
      else inRun = false;
    }
    if (current.salary > before.salary && before.salary > 0) {
      lastRaise = {
        pct: ((current.salary - before.salary) / before.salary) * 100,
        month: current.id,
      };
      break;
    }
  }
  const bonus = sorted.findLast((record) => record.bonus > 0);
  return {
    latest,
    yearPct,
    sinceMonth,
    lastRaise,
    latestBonus: bonus ? { amount: bonus.bonus, month: bonus.id } : null,
  };
}

function userAmount(expense: ExpenseData): number {
  if (expense.splitType === 'shared' && expense.splits.length > 0) {
    return (
      expense.amount - expense.splits.reduce((sum, s) => sum + s.amount, 0)
    );
  }
  return expense.amount;
}

export interface SpendingGlance {
  /** Counted personal spending in the month. */
  total: number;
  /** Average over the previous 12 months that have data; null with none. */
  average: number | null;
  categories: CategoryAmount[];
  lastExpenseDate: string | undefined;
}

export function spendingGlance(
  expenses: ExpenseData[],
  month: string,
  categoryLimit = 3
): SpendingGlance {
  const windowStart = shiftMonth(month, -12);
  const monthTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  let lastExpenseDate: string | undefined;
  for (const expense of expenses) {
    const day = expense.date.slice(0, 10);
    if (!lastExpenseDate || day > lastExpenseDate) lastExpenseDate = day;
    if (!isCountedInExpenseTotals(expense.type)) continue;
    const key = expense.date.slice(0, 7);
    if (key < windowStart || key > month) continue;
    const amount = userAmount(expense);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + amount);
    if (key === month) {
      categoryTotals.set(
        expense.type,
        (categoryTotals.get(expense.type) ?? 0) + amount
      );
    }
  }
  const past = [...monthTotals].filter(([key]) => key < month);
  return {
    total: roundCents(monthTotals.get(month) ?? 0),
    average: past.length
      ? roundCents(past.reduce((sum, [, v]) => sum + v, 0) / past.length)
      : null,
    categories: [...categoryTotals]
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, categoryLimit)
      .map(([key, amount]) => ({ key, amount: roundCents(amount) })),
    lastExpenseDate,
  };
}
