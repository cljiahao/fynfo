'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { useMemo } from 'react';
import { useDividends } from '../hooks/use-dividends';
import { useTrades } from '../hooks/use-equity';
import { useExchangeRate } from '../hooks/use-prices';
import {
  averageMonthlyTTM,
  currencySplit,
  expenseCoverage,
  forwardEstimate,
  topTickerShares,
  trailingTwelveMonthChange,
} from '../lib/dividend-breakdown';
import { dividendSummary } from '../lib/dividend-metrics';
import { computeHoldings } from '../lib/holdings';
import { validExchangeRate } from '../lib/valuation';
import { DividendBreakdownPanel } from './dividend-breakdown-panel';
import { DividendIncomeChart } from './dividend-income-chart';
import { DividendMonthlyChart } from './dividend-monthly-chart';

const CHART_YEARS = 5;

interface DividendSummaryProps {
  /** Planned monthly expenses; the coverage line is hidden when null or 0. */
  monthlyExpenses?: number | null;
}

function changeHint(changePct: number | null): string {
  if (changePct === null) return 'vs prior 12 months: —';
  const rounded = Math.round(changePct * 100);
  return `vs prior 12 months: ${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function DividendSummary({ monthlyExpenses }: DividendSummaryProps) {
  const { mask } = useAmountVisibility();
  const { data: dividends, isPending, isError, refetch } = useDividends();
  const { data: rate, isError: rateError } = useExchangeRate('USD', 'SGD');
  const usdSgdRate = !rateError && validExchangeRate(rate) ? rate : null;
  const { data: trades } = useTrades();
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

  const convRate = usdSgdRate ?? 1;
  const holdings = trades ? computeHoldings(trades) : null;
  const change =
    summary === null ? null : trailingTwelveMonthChange(rows, convRate, asOf);
  const avgMonthly =
    summary === null ? null : averageMonthlyTTM(summary.trailing12m);
  const breakdown =
    summary === null || holdings === null
      ? null
      : topTickerShares(rows, holdings, convRate, asOf, 5);
  const forward =
    summary === null || holdings === null
      ? null
      : forwardEstimate(rows, holdings, convRate, asOf);
  const coverage =
    avgMonthly === null ? null : expenseCoverage(avgMonthly, monthlyExpenses);

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
      <div
        className={
          summary === null
            ? 'grid gap-4 sm:grid-cols-3'
            : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
        }
      >
        <StatCard label="Dividends earned" value={show(summary?.totalToDate)} />
        <StatCard
          label="Last 12 months"
          value={show(summary?.trailing12m)}
          hint={change === null ? undefined : changeHint(change.changePct)}
        />
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
        {avgMonthly !== null && (
          <StatCard label="Average per month" value={show(avgMonthly)} />
        )}
      </div>
      {summary !== null && (
        <Tabs defaultValue="yearly">
          <TabsList aria-label="Dividend chart period">
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
          <TabsContent value="yearly">
            <DividendIncomeChart
              dividends={rows}
              usdSgdRate={usdSgdRate ?? 1}
              years={CHART_YEARS}
            />
          </TabsContent>
          <TabsContent value="monthly">
            <DividendMonthlyChart
              dividends={rows}
              usdSgdRate={convRate}
              asOf={asOf}
            />
          </TabsContent>
        </Tabs>
      )}
      {summary !== null && (
        <DividendBreakdownPanel
          breakdown={breakdown}
          forward={forward}
          coverage={coverage}
          split={currencySplit(rows, convRate, asOf)}
        />
      )}
    </section>
  );
}
