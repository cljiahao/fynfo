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

function monthIndex(period: string): number {
  const [year, month] = period.split('-').map(Number);
  return year * 12 + month;
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

function isSalaryLine(line: SalaryData['lines'][number]): boolean {
  return line.type === 'salary';
}

export function salaryGlance(salary: SalaryData[]): SalaryGlance | undefined {
  const all = sortedById(salary);
  // One-time-only months carry no recurring pay, so they would read as a 100% drop.
  const sorted = all.filter((record) => record.lines.some(isSalaryLine));
  const latest = sorted.at(-1);
  if (!latest) return undefined;
  const cutoff = shiftMonth(latest.id, -12);
  const yearAgo = sorted.findLast((record) => record.id <= cutoff);
  const yearPct =
    yearAgo && yearAgo.recurring > 0
      ? ((latest.recurring - yearAgo.recurring) / yearAgo.recurring) * 100
      : null;
  let sinceMonth = latest.id;
  let inRun = true;
  let lastRaise: SalaryGlance['lastRaise'] = null;
  for (let i = sorted.length - 1; i > 0; i--) {
    const current = sorted[i];
    const before = sorted[i - 1];
    if (inRun && current.recurring === latest.recurring) {
      if (before.recurring === latest.recurring) sinceMonth = before.id;
      else inRun = false;
    }
    if (current.recurring > before.recurring && before.recurring > 0) {
      lastRaise = {
        pct: ((current.recurring - before.recurring) / before.recurring) * 100,
        month: current.id,
      };
      break;
    }
  }
  const bonus = all.findLast((record) => record.bonus > 0);
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
  /** Monthly average over up to 12 full months since the first expense; null with no history. */
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
  let firstKey: string | undefined;
  for (const expense of expenses) {
    if (!isCountedInExpenseTotals(expense.type)) continue;
    const day = expense.date.slice(0, 10);
    if (!lastExpenseDate || day > lastExpenseDate) lastExpenseDate = day;
    const key = expense.date.slice(0, 7);
    if (key < month && (!firstKey || key < firstKey)) firstKey = key;
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
  const pastTotal = [...monthTotals]
    .filter(([key]) => key < month)
    .reduce((sum, [, v]) => sum + v, 0);
  // Gap months count as zero so a sparse history is not inflated; the
  // divisor matches the planner's recent-average expense.
  const monthsSpan = firstKey
    ? Math.min(12, monthIndex(month) - monthIndex(firstKey))
    : 0;
  return {
    total: roundCents(monthTotals.get(month) ?? 0),
    average: monthsSpan > 0 ? roundCents(pastTotal / monthsSpan) : null,
    categories: [...categoryTotals]
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, categoryLimit)
      .map(([key, amount]) => ({ key, amount: roundCents(amount) })),
    lastExpenseDate,
  };
}
