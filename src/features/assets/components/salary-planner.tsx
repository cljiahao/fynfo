'use client';

import { usePlannerCommitment } from '@/features/household';
import { useAmountVisibility } from '@/features/privacy';
import { chartColor } from '@/lib/chart-palette';
import { formatSGD } from '@/lib/utils/currency';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryContent } from '@/components/widgets';
import { useExpenses } from '@/features/expenses';
import { useSalaryRecords } from '@/features/salary';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_HOUSEHOLD_HORIZON_MONTHS } from '../constants';
import { useExpensesOverride } from '../hooks/use-expenses-override';
import {
  usePlannerSettings,
  useUpsertPlannerSettings,
} from '../hooks/use-planner-settings';
import {
  calcRecentAvgExpense,
  computeSalaryPlan,
  computeShortfallImpact,
  planStateLine,
  sumByCategory,
  type RecentAvgExpense,
} from '../lib/salary-plan';
import type { PlannerSettingsData, SnapshotData } from '../types';
import { PlannerExpensesField } from './planner-expenses-field';
import { PlannerFlow, type FlowSegment } from './planner-flow';
import {
  HouseholdBreakdown,
  HouseholdNote,
  type HouseholdQueryStatus,
} from './planner-household';
import { PlannerSettingsSheet } from './planner-settings-sheet';
import { PlannerTargets, type TargetBar } from './planner-targets';
import { PlanningScenarios } from './planning-scenarios';

export interface PlannerValues {
  investmentAmount: number;
  emergencyFundGoal: number;
  warChestGoal: number;
  expenses: number;
}

interface SalaryPlannerProps {
  snapshot?: SnapshotData;
  isSnapshotReady?: boolean;
  onPlannerValuesChange?: (values: PlannerValues) => void;
}

const DEFAULT_SETTINGS: PlannerSettingsData = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: true,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
  householdHorizonMonths: DEFAULT_HOUSEHOLD_HORIZON_MONTHS,
};

export function SalaryPlanner(props: SalaryPlannerProps) {
  const {
    data: salaryRecords,
    isLoading: salaryLoading,
    isError: salaryError,
    refetch: retrySalary,
  } = useSalaryRecords();
  const {
    data: savedSettings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: retrySettings,
  } = usePlannerSettings();
  const {
    data: expenses,
    isLoading: expensesLoading,
    isError: expensesError,
    refetch: retryExpenses,
  } = useExpenses();

  const isLoading = salaryLoading || settingsLoading || expensesLoading;
  const isError = salaryError || settingsError || expensesError;
  const statusContent = isLoading ? (
    <Card>
      <CardContent className="space-y-4 py-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  ) : isError ? (
    <Card>
      <CardHeader>
        <CardTitle>Couldn&apos;t load your planner</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => {
            void retrySalary();
            void retrySettings();
            void retryExpenses();
          }}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  ) : null;

  const latestSalary = salaryRecords?.[salaryRecords.length - 1];
  const recentAvg = calcRecentAvgExpense(expenses, new Date(), 6);

  return (
    <>
      {statusContent}
      <QueryContent
        ready={!isLoading && !isError && props.isSnapshotReady !== false}
      >
        <SalaryPlannerInner
          {...props}
          initialSalary={latestSalary?.salary ?? 0}
          initialSettings={savedSettings ?? DEFAULT_SETTINGS}
          recentAvg={recentAvg}
        />
      </QueryContent>
    </>
  );
}

function SalaryPlannerInner({
  snapshot,
  onPlannerValuesChange,
  initialSalary,
  initialSettings,
  recentAvg,
}: SalaryPlannerProps & {
  initialSalary: number;
  initialSettings: PlannerSettingsData;
  recentAvg: RecentAvgExpense;
}) {
  const { canReveal, getHideEpoch, mask, hidden } = useAmountVisibility();
  const upsertSettings = useUpsertPlannerSettings();
  const mutateRef = useRef(upsertSettings.mutate);
  useEffect(() => {
    mutateRef.current = upsertSettings.mutate;
  });

  const [salary, setSalary] = useState(initialSalary);
  const { override: expensesOverride, setOverride: setExpensesOverride } =
    useExpensesOverride();
  const averageExpenses = Math.round(recentAvg.average);
  const expenses = expensesOverride ?? averageExpenses;

  const [settings, setSettings] = useState({
    emergencyMonths: initialSettings.emergencyMonths,
    warChestMonths: initialSettings.warChestMonths,
    householdHorizonMonths:
      initialSettings.householdHorizonMonths ??
      DEFAULT_HOUSEHOLD_HORIZON_MONTHS,
    titheEnabled: initialSettings.titheEnabled,
    tithePctInput: initialSettings.tithePct,
    allowanceEnabled: initialSettings.allowanceEnabled,
    allowancePctInput: initialSettings.allowancePct,
  });
  const {
    emergencyMonths,
    warChestMonths,
    householdHorizonMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
  } = settings;

  // Debounced auto-save using ref to avoid unstable dependency
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );
  const isFirstRender = useRef(true);
  const debouncedSave = useCallback(
    (data: PlannerSettingsData) => {
      if (!canReveal()) return;
      const hideEpoch = getHideEpoch();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (canReveal() && getHideEpoch() === hideEpoch)
          mutateRef.current(data);
      }, 800);
    },
    [canReveal, getHideEpoch]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    debouncedSave({
      emergencyMonths,
      warChestMonths,
      titheEnabled,
      tithePct: tithePctInput,
      allowanceEnabled,
      allowancePct: allowancePctInput,
      householdHorizonMonths,
    });
  }, [
    emergencyMonths,
    warChestMonths,
    householdHorizonMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
    debouncedSave,
  ]);

  const commitmentQuery = usePlannerCommitment(householdHorizonMonths);
  const commitment = commitmentQuery.data;
  const householdStatus: HouseholdQueryStatus = commitmentQuery.isError
    ? 'error'
    : commitmentQuery.isPending
      ? 'loading'
      : 'ready';
  const readyCommitment =
    commitment && commitment.state === 'ready' ? commitment : null;
  const householdMonthlyDeduction = readyCommitment
    ? readyCommitment.monthlyDeduction
    : 0;
  const householdReserve = readyCommitment ? readyCommitment.reserve : 0;

  const currentSavings = snapshot
    ? sumByCategory(snapshot.entries, 'savings')
    : 0;
  const currentBonds = snapshot ? sumByCategory(snapshot.entries, 'bonds') : 0;

  const plan = computeSalaryPlan({
    salary,
    expenses,
    emergencyMonths,
    warChestMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
    currentSavings,
    currentBonds,
    householdMonthlyDeduction,
    householdReserve,
  });
  const { investmentAmt, emergencyFundGoal, warChestGoal } = plan;

  useEffect(() => {
    onPlannerValuesChange?.({
      investmentAmount: investmentAmt,
      emergencyFundGoal,
      warChestGoal,
      expenses,
    });
  }, [
    investmentAmt,
    emergencyFundGoal,
    warChestGoal,
    expenses,
    onPlannerValuesChange,
  ]);

  const segments: FlowSegment[] = [
    {
      key: 'expenses',
      label: 'Expenses',
      amount: plan.expensesAmt,
      pct: plan.expensesPct,
      color: chartColor(8),
    },
    {
      key: 'insurance',
      label: 'Insurance',
      amount: plan.insuranceAmt,
      pct: plan.insurancePct,
      color: chartColor(4),
    },
    ...(titheEnabled
      ? [
          {
            key: 'tithe',
            label: 'Tithe',
            amount: plan.titheAmt,
            pct: plan.tithePct,
            color: chartColor(7),
          },
        ]
      : []),
    ...(allowanceEnabled
      ? [
          {
            key: 'allowance',
            label: 'Allowance',
            amount: plan.allowanceAmt,
            pct: plan.allowancePct,
            color: chartColor(12),
          },
        ]
      : []),
    ...(readyCommitment
      ? [
          {
            key: 'household',
            label: 'Household',
            amount: plan.householdAmt,
            pct: plan.householdPct,
            color: chartColor(2),
            details: <HouseholdBreakdown commitment={readyCommitment} />,
          },
        ]
      : []),
    {
      key: 'savings',
      label: 'Savings',
      amount: plan.savingsAmt,
      pct: plan.savingsPct,
      color: chartColor(1),
    },
    {
      key: 'investment',
      label: plan.investmentPaused ? 'Investment (paused)' : 'Investment',
      amount: plan.investmentAmt,
      pct: plan.investmentPct,
      color: chartColor(6),
    },
  ];

  const targetBars: TargetBar[] = [
    {
      key: 'emergency',
      label: 'Emergency fund',
      funded: currentSavings,
      target: plan.emergencyFundGoal,
    },
    {
      key: 'war-chest',
      label: 'War chest',
      funded: currentBonds,
      target: plan.warChestGoal,
    },
    ...(plan.householdReserve > 0
      ? [
          {
            key: 'reserve',
            label: 'Household reserve',
            funded: Math.max(0, plan.goalsFunded - plan.goalsNeeded),
            target: plan.householdReserve,
          },
        ]
      : []),
  ];

  const shortfall = plan.householdShortfallAmt;
  const impact =
    shortfall > 0
      ? computeShortfallImpact({
          shortfallPerMonth: shortfall,
          monthsHorizon: householdHorizonMonths,
          currentSavings,
          expenses,
          emergencyMonths,
        })
      : null;

  const scenarioHousehold =
    householdMonthlyDeduction > 0 || householdReserve > 0
      ? { householdMonthlyDeduction, householdReserve }
      : {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planner</CardTitle>
        <CardDescription>
          Where your monthly take-home goes, after 20% CPF
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="planner-salary" className="text-xs">
                Gross Salary
              </Label>
              <Input
                disabled={hidden}
                id="planner-salary"
                type="number"
                min="0"
                placeholder="0"
                className="h-8 text-sm"
                value={hidden ? '' : salary || ''}
                onChange={(e) =>
                  canReveal() && setSalary(Number(e.target.value) || 0)
                }
              />
            </div>
            <PlannerExpensesField
              value={expenses}
              average={averageExpenses}
              monthsUsed={recentAvg.monthsUsed}
              isCustom={expensesOverride !== null}
              onChange={setExpensesOverride}
              onReset={() => setExpensesOverride(null)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Emergency {mask(emergencyMonths)} mo · War chest{' '}
              {mask(warChestMonths)} mo
              {titheEnabled ? ` · Tithe ${mask(tithePctInput)}%` : ''}
              {allowanceEnabled
                ? ` · Allowance ${mask(allowancePctInput)}%`
                : ''}
            </p>
            <PlannerSettingsSheet
              values={settings}
              onChange={(patch) =>
                setSettings((current) => ({ ...current, ...patch }))
              }
              showHorizon={commitment?.state !== 'none'}
            />
          </div>
        </div>

        {salary > 0 && (
          <div className="space-y-4">
            <PlannerFlow
              net={plan.netAfterCpf}
              segments={segments}
              stateLine={planStateLine(plan)}
            />
            <HouseholdNote status={householdStatus} commitment={commitment} />
            {shortfall > 0 && impact && (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/10 rounded-md border p-3 text-sm"
              >
                <p className="font-medium">
                  {mask(formatSGD(shortfall))} a month{' '}
                  {plan.householdAmt > 0
                    ? 'drawn from savings'
                    : 'over your take-home'}
                </p>
                <p className="text-muted-foreground text-xs">
                  Savings and investment are 0. Over{' '}
                  {mask(householdHorizonMonths)} months this leaves{' '}
                  {mask(impact.monthsCovered.toFixed(1))} of{' '}
                  {mask(impact.emergencyMonths)} months of emergency fund.
                </p>
              </div>
            )}
            <PlannerTargets bars={targetBars} />
          </div>
        )}

        <PlanningScenarios
          sourceSnapshotMonth={snapshot?.id}
          inputs={{
            salary,
            expenses,
            emergencyMonths,
            warChestMonths,
            titheEnabled,
            tithePctInput,
            allowanceEnabled,
            allowancePctInput,
            currentSavings,
            currentBonds,
            ...scenarioHousehold,
          }}
        />

        {salary === 0 && (
          <div className="flex-center text-muted-foreground py-8 text-sm">
            Enter salary to see allocation
          </div>
        )}
      </CardContent>
    </Card>
  );
}
