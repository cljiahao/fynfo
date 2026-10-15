import { EXPENSE_TYPES } from '../constants';
import { expenseDataSchema } from '../schemas';
import type { ExpenseData } from '../types';

interface ChartDataPoint {
  month: string;
  monthKey: string;
  total: number;
  [key: string]: number | string;
}

/** Read-only aggregation; invalid history must not look like valid spending. */
export function buildExpenseChart(expenses: ExpenseData[], now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const chartData: ChartDataPoint[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 12 + index, 1));
    return {
      month: new Intl.DateTimeFormat('en-SG', {
        timeZone: 'UTC',
        month: 'short',
        year: 'numeric',
      }).format(date),
      monthKey: date.toISOString().slice(0, 7),
      total: 0,
      ...Object.fromEntries(EXPENSE_TYPES.map((type) => [type, 0])),
    };
  });
  const allTimeMonthCents = new Map<string, number>();
  for (const expense of expenses) {
    if (!expenseDataSchema.safeParse(expense).success) return null;
    const grossCents = Math.round(expense.amount * 100);
    const otherCents =
      expense.splitType === 'shared'
        ? expense.splits.reduce(
            (sum, split) => sum + Math.round(split.amount * 100),
            0
          )
        : 0;
    if (!Number.isSafeInteger(grossCents)) return null;
    const personalCents = grossCents - otherCents;
    const key = expense.date.slice(0, 7);
    const monthCents = (allTimeMonthCents.get(key) ?? 0) + personalCents;
    if (!Number.isSafeInteger(monthCents)) return null;
    allTimeMonthCents.set(key, monthCents);
    const point = chartData.find((entry) => entry.monthKey === key);
    if (point) {
      point[expense.type] = (point[expense.type] as number) + personalCents;
      point.total += personalCents;
    }
  }
  const allTimeCents = [...allTimeMonthCents.values()].reduce(
    (sum, value) => sum + value,
    0
  );
  if (!Number.isSafeInteger(allTimeCents)) return null;
  const totalCents = chartData.reduce((sum, point) => sum + point.total, 0);
  const monthsWithSpend = chartData.filter((point) => point.total > 0).length;
  for (const point of chartData) {
    point.total /= 100;
    for (const type of EXPENSE_TYPES)
      point[type] = (point[type] as number) / 100;
  }
  return {
    chartData,
    totalExpense: totalCents / 100,
    avgExpense: monthsWithSpend ? totalCents / monthsWithSpend / 100 : 0,
    allTimeAvg: allTimeMonthCents.size
      ? allTimeCents / allTimeMonthCents.size / 100
      : 0,
  };
}
