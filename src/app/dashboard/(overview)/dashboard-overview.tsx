'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, QueryContent } from '@/components/widgets';
import type { MarketBudgets, PlannerValues } from '@/features/assets';
import {
  calculateTotal,
  FirstRecordPrompt,
  InvestmentAllocation,
  InvestmentBreakdown,
  SalaryPlanner,
  SummaryCards,
  usePlannerSettings,
  useSnapshots,
} from '@/features/assets';
import { useTrades } from '@/features/equity';
import { useExpenses } from '@/features/expenses';
import { MonthlyReview } from '@/features/review';
import { SalarySummaryCards, useSalaryRecords } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export function DashboardOverview() {
  const {
    data: snapshots,
    isPending: assetsPending,
    isError: assetsError,
    refetch: retryAssets,
  } = useSnapshots();
  const {
    data: salaryRecords,
    isPending: salaryPending,
    isError: salaryError,
    refetch: retrySalary,
  } = useSalaryRecords();
  const { isSuccess: settingsReady } = usePlannerSettings();
  const { data: expenses, isSuccess: expensesReady } = useExpenses();
  const { data: trades, isSuccess: tradesReady } = useTrades();

  const [plannerValues, setPlannerValues] = useState<PlannerValues>({
    investmentAmount: 0,
    emergencyFundGoal: 0,
    warChestGoal: 0,
    expenses: 0,
  });
  const [marketBudgets, setMarketBudgets] = useState<MarketBudgets | null>(
    null
  );

  // useCallback justified: stabilizes references passed to child useEffects that notify parent of derived state
  const handlePlannerValuesChange = useCallback((values: PlannerValues) => {
    setPlannerValues(values);
  }, []);

  const handleBudgetsChange = useCallback((budgets: MarketBudgets | null) => {
    setMarketBudgets(budgets);
  }, []);

  const snapshotsWithTotals = (snapshots ?? []).slice(-2).map((s) => ({
    ...s,
    total: calculateTotal(s.entries),
  }));

  const latest = snapshotsWithTotals[snapshotsWithTotals.length - 1];

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your financial health"
        action={
          <Link href={PAGE_ROUTES.ENTRY}>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Snapshot
            </Button>
          </Link>
        }
      />

      {!assetsPending &&
        !assetsError &&
        !salaryPending &&
        !salaryError &&
        expensesReady &&
        tradesReady &&
        snapshots?.length === 0 &&
        salaryRecords?.length === 0 &&
        expenses?.length === 0 &&
        trades?.length === 0 && <FirstRecordPrompt />}

      {assetsPending ? (
        <SummarySkeleton label="Loading assets" />
      ) : assetsError ? (
        <DashboardError
          compact
          title="Couldn’t load assets"
          reset={() => void retryAssets()}
        />
      ) : (
        <SummaryCards snapshots={snapshotsWithTotals} />
      )}

      {salaryPending ? (
        <SummarySkeleton label="Loading salary" />
      ) : salaryError ? (
        <DashboardError
          compact
          title="Couldn’t load salary"
          reset={() => void retrySalary()}
        />
      ) : (
        <SalarySummaryCards records={salaryRecords ?? []} />
      )}

      <SalaryPlanner
        isSnapshotReady={!assetsPending && !assetsError}
        snapshot={latest ? snapshots?.[snapshots.length - 1] : undefined}
        onPlannerValuesChange={handlePlannerValuesChange}
      />

      <MonthlyReview />

      <QueryContent
        ready={
          !assetsPending &&
          !assetsError &&
          !salaryPending &&
          !salaryError &&
          settingsReady &&
          expensesReady
        }
      >
        <InvestmentBreakdown
          investmentAmount={plannerValues.investmentAmount}
          emergencyFundGoal={plannerValues.emergencyFundGoal}
          warChestGoal={plannerValues.warChestGoal}
          snapshot={latest ? snapshots?.[snapshots.length - 1] : undefined}
          onBudgetsChange={handleBudgetsChange}
        />

        <InvestmentAllocation budgets={marketBudgets} />
      </QueryContent>
    </div>
  );
}

function SummarySkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
