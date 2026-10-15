'use client';

import { Button } from '@/components/ui/button';
import { PageHeader, PageViews, QueryContent } from '@/components/widgets';
import type { MarketBudgets, PlannerValues } from '@/features/assets';
import {
  FirstRecordPrompt,
  InvestmentAllocation,
  InvestmentBreakdown,
  SalaryPlanner,
  usePlannerSettings,
  useSnapshots,
} from '@/features/assets';
import { useTrades } from '@/features/equity';
import { useExpenses } from '@/features/expenses';
import { LatestRecords, OverviewReadProvider } from '@/features/overview';
import { MonthlyReview } from '@/features/review';
import { useSalaryRecords } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export function DashboardOverview() {
  return (
    <OverviewReadProvider>
      <DashboardOverviewContent />
    </OverviewReadProvider>
  );
}

function DashboardOverviewContent() {
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
  const {
    data: expenses,
    isSuccess: expensesReady,
    isError: expensesError,
    refetch: retryExpenses,
  } = useExpenses();
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

  const latest = (snapshots ?? []).reduce<
    NonNullable<typeof snapshots>[number] | undefined
  >(
    (current, snapshot) =>
      !current || snapshot.id > current.id ? snapshot : current,
    undefined
  );

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your financial health"
        action={
          <Button asChild>
            <Link href={PAGE_ROUTES.ENTRY}>
              <Plus className="mr-2 size-4" />
              Add Snapshot
            </Link>
          </Button>
        }
      />

      <PageViews
        label="Dashboard views"
        views={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <>
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

                <LatestRecords
                  snapshots={snapshots}
                  salary={salaryRecords}
                  expenses={expenses}
                  assetsState={
                    assetsError ? 'error' : assetsPending ? 'loading' : 'ready'
                  }
                  salaryState={
                    salaryError ? 'error' : salaryPending ? 'loading' : 'ready'
                  }
                  expensesState={
                    expensesError
                      ? 'error'
                      : expensesReady
                        ? 'ready'
                        : 'loading'
                  }
                  retryAssets={() => void retryAssets()}
                  retrySalary={() => void retrySalary()}
                  retryExpenses={() => void retryExpenses()}
                />
              </>
            ),
          },
          {
            id: 'plan',
            label: 'Plan income',
            content: (
              <>
                <SalaryPlanner
                  isSnapshotReady={!assetsPending && !assetsError}
                  snapshot={latest}
                  onPlannerValuesChange={handlePlannerValuesChange}
                />
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
                    snapshot={latest}
                    onBudgetsChange={handleBudgetsChange}
                  />

                  <InvestmentAllocation budgets={marketBudgets} />
                </QueryContent>
              </>
            ),
          },
          { id: 'review', label: 'Review month', content: <MonthlyReview /> },
        ]}
      />
    </div>
  );
}
