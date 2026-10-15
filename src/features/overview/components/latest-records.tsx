'use client';

import { Button } from '@/components/ui/button';
import type { SnapshotData } from '@/features/assets';
import type { ExpenseData } from '@/features/expenses';
import type { SalaryData } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';

type ReadState = 'loading' | 'error' | 'ready';

function latestPeriod(values: string[]) {
  return values.reduce<string | undefined>(
    (latest, value) => (!latest || value > latest ? value : latest),
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
  retryExpenses,
}: {
  snapshots?: SnapshotData[];
  salary?: SalaryData[];
  expenses?: ExpenseData[];
  assetsState: ReadState;
  salaryState: ReadState;
  expensesState: ReadState;
  retryExpenses: () => void;
}) {
  const parts = new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const currentMonth = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
  const records = [
    {
      label: 'Asset snapshot',
      period: latestPeriod((snapshots ?? []).map((record) => record.id)),
      state: assetsState,
      href: PAGE_ROUTES.ASSETS,
      monthly: true,
    },
    {
      label: 'Salary',
      period: latestPeriod((salary ?? []).map((record) => record.id)),
      state: salaryState,
      href: PAGE_ROUTES.SALARY,
      monthly: true,
    },
    {
      label: 'Expenses',
      period: latestPeriod(
        (expenses ?? []).map((record) => record.date.slice(0, 10))
      ),
      state: expensesState,
      href: PAGE_ROUTES.EXPENSES,
      monthly: false,
    },
  ];
  return (
    <section aria-labelledby="latest-records-heading" className="space-y-3">
      <div>
        <h2 id="latest-records-heading" className="font-semibold">
          Latest records
        </h2>
        <p className="text-muted-foreground text-sm">
          Recorded periods, not save dates. Recent records may still be
          incomplete.
        </p>
      </div>
      <dl className="grid gap-4 border-y py-4 sm:grid-cols-3">
        {records.map((record) => (
          <div
            key={record.label}
            className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 sm:block sm:space-y-1"
          >
            <dt>
              <Link
                href={record.href}
                className="text-sm font-medium underline underline-offset-4"
              >
                {record.label}
              </Link>
            </dt>
            <dd className="text-sm">
              {record.state === 'loading'
                ? 'Loading…'
                : record.state === 'error'
                  ? 'Unavailable'
                  : record.period
                    ? periodLabel(record.period)
                    : 'No records yet'}
            </dd>
            {record.state === 'ready' &&
              record.period &&
              record.monthly &&
              record.period < currentMonth && (
                <dd className="text-muted-foreground col-span-2 text-xs">
                  Earlier than this month
                </dd>
              )}
            {record.label === 'Expenses' && record.state === 'error' && (
              <dd>
                <Button size="sm" variant="ghost" onClick={retryExpenses}>
                  Retry expenses
                </Button>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
