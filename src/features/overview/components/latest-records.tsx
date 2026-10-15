'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { calculateTotal, type SnapshotData } from '@/features/assets';
import type { ExpenseData } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { buildMonthlyReview } from '@/features/review';
import type { SalaryData } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGDWhole } from '@/lib/utils/currency';
import Link from 'next/link';

type ReadState = 'loading' | 'error' | 'ready';
function latestRecord<T extends { id: string }>(records: T[]) {
  return records.reduce<T | undefined>(
    (latest, record) => (!latest || record.id > latest.id ? record : latest),
    undefined
  );
}
function periodLabel(period: string) {
  const date = new Date(
    `${period.length === 7 ? `${period}-01` : period}T00:00:00Z`
  );
  return Number.isNaN(date.valueOf())
    ? period
    : new Intl.DateTimeFormat('en-SG', {
        month: 'short',
        year: 'numeric',
        ...(period.length > 7 ? { day: 'numeric' as const } : {}),
        timeZone: 'UTC',
      }).format(date);
}
export function LatestRecords({
  snapshots,
  salary,
  expenses,
  assetsState,
  salaryState,
  expensesState,
  retryAssets,
  retrySalary,
  retryExpenses,
}: {
  snapshots?: SnapshotData[];
  salary?: SalaryData[];
  expenses?: ExpenseData[];
  assetsState: ReadState;
  salaryState: ReadState;
  expensesState: ReadState;
  retryAssets: () => void;
  retrySalary: () => void;
  retryExpenses: () => void;
}) {
  const { mask } = useAmountVisibility();
  const parts = new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const currentMonth = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
  const snapshot =
    assetsState === 'ready' ? latestRecord(snapshots ?? []) : undefined;
  const income =
    salaryState === 'ready' ? latestRecord(salary ?? []) : undefined;
  const spending =
    expensesState === 'ready'
      ? buildMonthlyReview(currentMonth, [], [], expenses ?? [])
      : null;
  const expenseDate = (expenses ?? []).reduce<string | undefined>(
    (latest, record) =>
      !latest || record.date.slice(0, 10) > latest
        ? record.date.slice(0, 10)
        : latest,
    undefined
  );
  const records = [
    {
      label: 'Total Assets',
      period: snapshot?.id,
      state: assetsState,
      href: PAGE_ROUTES.ASSETS,
      monthly: true,
      source: 'assets',
      retry: retryAssets,
      value: snapshot
        ? mask(formatSGDWhole(calculateTotal(snapshot.entries)))
        : 'Not recorded',
      hint: 'Latest snapshot',
    },
    {
      label: 'Current Salary',
      period: income?.id,
      state: salaryState,
      href: PAGE_ROUTES.SALARY,
      monthly: true,
      source: 'salary',
      retry: retrySalary,
      value: income ? mask(formatSGDWhole(income.salary)) : 'Not recorded',
      hint: 'Latest base salary',
    },
    {
      label: 'Recorded spending',
      period: expenseDate,
      state: expensesState,
      href: PAGE_ROUTES.EXPENSES,
      monthly: false,
      source: 'expenses',
      retry: retryExpenses,
      value:
        spending?.personalSpending === null
          ? 'Check shared splits'
          : spending?.expenseCount
            ? mask(formatSGDWhole(spending.personalSpending))
            : 'Not recorded',
      hint: `${periodLabel(currentMonth)} · your share`,
    },
  ];
  return (
    <section aria-labelledby="latest-records-heading" className="space-y-4">
      <div>
        <h2 id="latest-records-heading" className="font-semibold">
          At a glance
        </h2>
        <p className="text-muted-foreground text-sm">
          Based on your saved records. Dates show the recorded period.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {records.map((record) => (
          <section
            key={record.source}
            aria-label={record.label}
            className="min-w-0 space-y-2 border-b pb-5"
          >
            {record.state === 'loading' ? (
              <p
                role="status"
                aria-label={`Loading ${record.source}`}
                className="text-muted-foreground text-sm"
              >
                Loading {record.source}…
              </p>
            ) : record.state === 'error' ? (
              <DashboardError
                compact
                title={`Couldn’t load ${record.source}`}
                reset={record.retry}
              />
            ) : (
              <>
                <Link
                  href={record.href}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  {record.label}
                </Link>
                <p className="text-2xl font-semibold break-words tabular-nums">
                  {record.value}
                </p>
                <p className="text-muted-foreground text-sm">{record.hint}</p>
                <p className="text-muted-foreground text-xs">
                  {record.period
                    ? `${record.monthly ? 'Latest' : 'Last expense'}: ${periodLabel(record.period)}`
                    : 'No records yet'}
                </p>
                {record.period &&
                  record.monthly &&
                  record.period < currentMonth && (
                    <p className="text-muted-foreground text-xs">
                      Earlier than this month
                    </p>
                  )}
              </>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
