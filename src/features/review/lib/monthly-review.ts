import { calculateTotal, type SnapshotData } from '@/features/assets';
import type { ExpenseData } from '@/features/expenses';
import type { SalaryData } from '@/features/salary';
import { YYYY_MM } from '@/lib/zod-utils';

export function buildMonthlyReview(
  month: string,
  snapshots: SnapshotData[],
  salary: SalaryData[],
  expenses: ExpenseData[]
) {
  const period = YYYY_MM.parse(month);
  const [year, monthNumber] = period.split('-').map(Number);
  const previousMonth =
    monthNumber === 1
      ? `${year - 1}-12`
      : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
  const income = salary.filter((record) => record.id === period);
  const spending = expenses.filter(
    (record) => record.date.slice(0, 7) === period
  );
  const snapshot = snapshots.find((record) => record.id === period);
  const previous = snapshots.find((record) => record.id === previousMonth);
  const grossIncome =
    income.reduce(
      (sum, record) =>
        sum + Math.round(record.salary * 100) + Math.round(record.bonus * 100),
      0
    ) / 100;
  const invalidSplit = spending.some(
    (record) =>
      record.splitType === 'shared' &&
      record.splits.reduce(
        (sum, split) => sum + Math.round(split.amount * 100),
        0
      ) > Math.round(record.amount * 100)
  );
  const personalSpending =
    spending.reduce((sum, record) => {
      const others =
        record.splitType === 'shared'
          ? record.splits.reduce(
              (total, split) => total + Math.round(split.amount * 100),
              0
            )
          : 0;
      return sum + Math.round(record.amount * 100) - others;
    }, 0) / 100;
  return {
    grossIncome,
    personalSpending: invalidSplit ? null : personalSpending,
    incomeRecorded: income.length > 0,
    expenseCount: spending.length,
    assetTotal: snapshot ? calculateTotal(snapshot.entries) : null,
    assetChange:
      snapshot && previous
        ? (Math.round(calculateTotal(snapshot.entries) * 100) -
            Math.round(calculateTotal(previous.entries) * 100)) /
          100
        : null,
    previousMonth,
  };
}
