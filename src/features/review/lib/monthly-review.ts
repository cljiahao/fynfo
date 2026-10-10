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
  const income = salary
    .filter((record) => record.id === period)
    .map((record) => ({
      month: record.id,
      salaryCents: Math.round(record.salary * 100),
      bonusCents: Math.round(record.bonus * 100),
    }));
  const spending = expenses
    .filter((record) => record.date.slice(0, 7) === period)
    .map((record) => {
      const grossCents = Math.round(record.amount * 100);
      const otherCents =
        record.splitType === 'shared'
          ? record.splits.reduce(
              (sum, split) => sum + Math.round(split.amount * 100),
              0
            )
          : 0;
      return {
        id: record.id,
        date: record.date,
        item: record.item,
        grossCents,
        otherCents,
        personalCents:
          record.splitType === 'shared' && otherCents > grossCents
            ? null
            : grossCents - otherCents,
      };
    });
  const snapshot = snapshots.find((record) => record.id === period);
  const previous = snapshots.find((record) => record.id === previousMonth);
  const assetTotal = snapshot ? calculateTotal(snapshot.entries) : null;
  const previousAssetTotal = previous ? calculateTotal(previous.entries) : null;
  const invalidSplit = spending.some((record) => record.personalCents === null);
  return {
    grossIncome:
      income.reduce(
        (sum, record) => sum + record.salaryCents + record.bonusCents,
        0
      ) / 100,
    personalSpending: invalidSplit
      ? null
      : spending.reduce((sum, record) => sum + (record.personalCents ?? 0), 0) /
        100,
    incomeRecorded: income.length > 0,
    expenseCount: spending.length,
    assetTotal,
    assetChange:
      assetTotal !== null && previousAssetTotal !== null
        ? (Math.round(assetTotal * 100) -
            Math.round(previousAssetTotal * 100)) /
          100
        : null,
    previousMonth,
    sources: { income, expenses: spending, previousAssetTotal },
  };
}
