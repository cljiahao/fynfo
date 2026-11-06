'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  calculateTotal,
  CATEGORY_LABELS,
  type AssetCategory,
  type SnapshotData,
} from '@/features/assets';
import { EXPENSE_TYPE_LABELS, type ExpenseData } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { buildMonthlyReview } from '@/features/review';
import type { SalaryData } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGDWhole } from '@/lib/utils/currency';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  salaryGlance,
  snapshotGlance,
  spendingGlance,
  topCategories,
} from '../lib/glance';

type ReadState = 'loading' | 'error' | 'ready';
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
  const assets =
    assetsState === 'ready'
      ? snapshotGlance(snapshots ?? [], calculateTotal)
      : undefined;
  const pay = salaryState === 'ready' ? salaryGlance(salary ?? []) : undefined;
  const spending =
    expensesState === 'ready'
      ? buildMonthlyReview(currentMonth, [], [], expenses ?? [])
      : null;
  const spend =
    expensesState === 'ready'
      ? spendingGlance(expenses ?? [], currentMonth)
      : undefined;
  const money = (value: number) => mask(formatSGDWhole(value));
  const arrow = (value: number) => (value > 0 ? '▲' : '▼');

  const assetsLine = !assets
    ? 'No records yet'
    : assets.change === null
      ? 'First snapshot'
      : assets.change === 0
        ? 'No change since last snapshot'
        : `${arrow(assets.change)} ${money(Math.abs(assets.change))} since last snapshot`;
  const assetsDetail = assets ? (
    <>
      <DetailRow label="Snapshot" value={periodLabel(assets.latest.id)} />
      {topCategories(assets.latest.entries, 3).map(({ key, amount }) => (
        <DetailRow
          key={key}
          label={CATEGORY_LABELS[key as AssetCategory] ?? key}
          value={money(amount)}
        />
      ))}
    </>
  ) : null;

  const yearPct =
    pay?.yearPct == null ? null : Math.round(pay.yearPct * 10) / 10;
  const payLine = !pay
    ? 'No records yet'
    : yearPct === null || yearPct === 0
      ? `Since ${periodLabel(pay.sinceMonth)}`
      : `${arrow(yearPct)} ${Math.abs(yearPct)}% vs a year ago`;
  const payDetail = pay ? (
    <>
      <DetailRow label="Record" value={periodLabel(pay.latest.id)} />
      <DetailRow
        label="Last raise"
        value={
          pay.lastRaise
            ? `+${Math.round(pay.lastRaise.pct * 10) / 10}% · ${periodLabel(pay.lastRaise.month)}`
            : 'None recorded'
        }
      />
      {pay.latestBonus && (
        <DetailRow
          label="Latest bonus"
          value={`${money(pay.latestBonus.amount)} · ${periodLabel(pay.latestBonus.month)}`}
        />
      )}
    </>
  ) : null;

  const spendDiff =
    spend && spend.average !== null ? spend.total - spend.average : null;
  const spendLine =
    spending?.personalSpending === null
      ? 'Some splits exceed the amount'
      : !spending?.expenseCount
        ? 'No expenses this month'
        : spendDiff === null
          ? 'No 12-month average yet'
          : Math.round(spendDiff) === 0
            ? 'In line with 12-month average'
            : `${arrow(spendDiff)} ${money(Math.abs(spendDiff))} vs 12-month average`;
  const spendDetail =
    spend && (spend.categories.length > 0 || spend.lastExpenseDate) ? (
      <>
        {spend.categories.map(({ key, amount }) => (
          <DetailRow
            key={key}
            label={
              EXPENSE_TYPE_LABELS[key as keyof typeof EXPENSE_TYPE_LABELS] ??
              key
            }
            value={money(amount)}
          />
        ))}
        {spend.lastExpenseDate && (
          <DetailRow
            label="Last expense"
            value={periodLabel(spend.lastExpenseDate)}
          />
        )}
      </>
    ) : null;

  const records: {
    label: string;
    state: ReadState;
    href: string;
    source: string;
    retry: () => void;
    value: string;
    line: string;
    detail: ReactNode;
  }[] = [
    {
      label: 'Total Assets',
      state: assetsState,
      href: PAGE_ROUTES.ASSETS,
      source: 'assets',
      retry: retryAssets,
      value: assets
        ? money(calculateTotal(assets.latest.entries))
        : 'Not recorded',
      line: assetsLine,
      detail: assetsDetail,
    },
    {
      label: 'Salary',
      state: salaryState,
      href: PAGE_ROUTES.SALARY,
      source: 'salary',
      retry: retrySalary,
      value: pay ? money(pay.latest.salary) : 'Not recorded',
      line: payLine,
      detail: payDetail,
    },
    {
      label: 'Spending this month',
      state: expensesState,
      href: PAGE_ROUTES.EXPENSES,
      source: 'expenses',
      retry: retryExpenses,
      value:
        spending?.personalSpending === null
          ? 'Check shared splits'
          : spending?.expenseCount
            ? money(spending.personalSpending)
            : 'Not recorded',
      line: spendLine,
      detail: spendDetail,
    },
  ];
  return (
    <section aria-labelledby="latest-records-heading" className="space-y-4">
      <h2 id="latest-records-heading" className="font-semibold">
        At a glance
      </h2>
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
                <GlanceFigure
                  label={record.label}
                  value={record.value}
                  line={record.line}
                  detail={record.detail}
                />
              </>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

// Hover previews the detail for mouse users; a click or tap pins it so touch
// and keyboard users get the same content.
function GlanceFigure({
  label,
  value,
  line,
  detail,
}: {
  label: string;
  value: string;
  line: string;
  detail: ReactNode;
}) {
  const [state, setState] = useState({ open: false, byHover: false });
  const body = (
    <>
      <span className="block text-2xl font-semibold break-words tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground block text-sm">{line}</span>
    </>
  );
  if (!detail) return <div>{body}</div>;
  return (
    <Popover
      open={state.open}
      onOpenChange={(next) =>
        setState((current) =>
          !next && current.byHover
            ? { open: true, byHover: false }
            : { open: next, byHover: false }
        )
      }
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} details`}
          className="focus-visible:ring-ring block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:outline-hidden"
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse')
              setState((current) =>
                current.open ? current : { open: true, byHover: true }
              );
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse')
              setState((current) =>
                current.byHover ? { open: false, byHover: false } : current
              );
          }}
        >
          {body}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 space-y-1 p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <dl className="space-y-1">{detail}</dl>
      </PopoverContent>
    </Popover>
  );
}
