'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { useMemo } from 'react';
import { useDividends } from '../hooks/use-dividends';
import { useExchangeRate } from '../hooks/use-prices';
import { dividendSummary } from '../lib/dividend-metrics';
import { validExchangeRate } from '../lib/valuation';
import { DividendIncomeChart } from './dividend-income-chart';

const CHART_YEARS = 5;

export function DividendSummary() {
  const { mask } = useAmountVisibility();
  const { data: dividends, isPending, isError, refetch } = useDividends();
  const { data: rate, isError: rateError } = useExchangeRate('USD', 'SGD');
  const usdSgdRate = !rateError && validExchangeRate(rate) ? rate : null;
  const rows = useMemo(() => dividends ?? [], [dividends]);

  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Loading dividends"
        className="grid gap-4 sm:grid-cols-3"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <DashboardError
        compact
        title="Couldn’t load dividends"
        reset={() => void refetch()}
      />
    );
  }
  if (rows.length === 0) return null;

  const requiresRate = rows.some((row) => row.currency === 'USD');
  const asOf = new Date().toISOString().slice(0, 10);
  const candidate =
    !requiresRate || usdSgdRate !== null
      ? dividendSummary(rows, usdSgdRate ?? 1, asOf)
      : null;
  const summary =
    candidate !== null &&
    Number.isFinite(candidate.totalToDate) &&
    Number.isFinite(candidate.trailing12m) &&
    (candidate.averagePerYear === null ||
      Number.isFinite(candidate.averagePerYear))
      ? candidate
      : null;

  const show = (value: number | null | undefined) =>
    summary === null
      ? 'Unavailable'
      : value === null || value === undefined
        ? '—'
        : mask(formatSGDWhole(value));

  return (
    <section aria-label="Dividend summary" className="space-y-4">
      {summary === null && (
        <p role="status" className="text-warning text-sm">
          Exchange rate unavailable. Converted dividend totals and the chart are
          hidden.
        </p>
      )}
      {summary !== null && requiresRate && (
        <p className="text-muted-foreground text-sm">
          SGD totals use a current exchange-rate estimate, not the rate on each
          payment date.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Dividends earned" value={show(summary?.totalToDate)} />
        <StatCard label="Last 12 months" value={show(summary?.trailing12m)} />
        <StatCard
          label="Average per year"
          value={show(summary?.averagePerYear)}
          hint={
            summary === null
              ? undefined
              : summary.fullYears > 0
                ? `${summary.fullYears} full calendar ${summary.fullYears === 1 ? 'year' : 'years'}`
                : 'Needs a full calendar year'
          }
        />
      </div>
      {summary !== null && (
        <DividendIncomeChart
          dividends={rows}
          usdSgdRate={usdSgdRate ?? 1}
          years={CHART_YEARS}
        />
      )}
    </section>
  );
}
