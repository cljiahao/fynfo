'use client';

import { Button } from '@/components/ui/button';
import type { MarketBudgets, PlannerValues } from '@/features/assets';
import {
  calculateTotal,
  InvestmentAllocation,
  InvestmentBreakdown,
  SalaryPlanner,
  SummaryCards,
  usePlannerSettings,
  useSnapshots,
} from '@/features/assets';
import { useExpenses } from '@/features/expenses';
import { SalarySummaryCards, useSalaryRecords } from '@/features/salary';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export default function DashboardOverviewPage() {
  const { data: snapshots } = useSnapshots();
  const { data: salaryRecords } = useSalaryRecords();
  // Prefetch planner data in parallel with snapshots/salary so SalaryPlanner
  // finds it in cache when it mounts, eliminating the two-phase waterfall.
  usePlannerSettings();
  useExpenses();

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

  const handleBudgetsChange = useCallback((budgets: MarketBudgets) => {
    setMarketBudgets(budgets);
  }, []);

  const snapshotsWithTotals = (snapshots ?? []).map((s) => ({
    ...s,
    total: calculateTotal(s.entries),
  }));

  const latest = snapshotsWithTotals[snapshotsWithTotals.length - 1];

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your financial health
          </p>
        </div>
        <Link href="/dashboard/entry">
          <Button>
            <Plus className="mr-2 size-4" />
            Add Snapshot
          </Button>
        </Link>
      </div>

      <SummaryCards snapshots={snapshotsWithTotals} />

      <SalarySummaryCards records={salaryRecords ?? []} />

      <SalaryPlanner
        snapshot={latest ? snapshots?.[snapshots.length - 1] : undefined}
        onPlannerValuesChange={handlePlannerValuesChange}
      />

      <InvestmentBreakdown
        investmentAmount={plannerValues.investmentAmount}
        emergencyFundGoal={plannerValues.emergencyFundGoal}
        warChestGoal={plannerValues.warChestGoal}
        snapshot={latest ? snapshots?.[snapshots.length - 1] : undefined}
        onBudgetsChange={handleBudgetsChange}
      />

      <InvestmentAllocation budgets={marketBudgets} />
    </div>
  );
}
