'use client';

import {
  computeHouseholdPlan,
  householdRecommendations,
  useHouseholdPlan,
} from '@/features/household';
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
import { Skeleton } from '@/components/ui/skeleton';
import { QueryContent } from '@/components/widgets';
import { useExpenses } from '@/features/expenses';
import { trailingTwelveMonths, useSalaryRecords } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  shortfallImpactMonths,
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
  /** Spare savings the household plan already counts on; not deployable. */
  householdEarmark: number;
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
  expenseBufferPct: 0,
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

  const latestSalary = salaryRecords?.findLast((record) =>
    record.lines.some((line) => line.type === 'salary')
  );
  const lastRecord = salaryRecords?.at(-1);
  const otherIncome = lastRecord
    ? trailingTwelveMonths(salaryRecords ?? [], lastRecord.id)
    : { bonus: 0, oneTime: 0 };
  const now = new Date();
  const recentAvg = calcRecentAvgExpense(expenses, now, 12);

  return (
    <>
      {statusContent}
      <QueryContent
        ready={!isLoading && !isError && props.isSnapshotReady !== false}
      >
        <SalaryPlannerInner
          {...props}
          salary={latestSalary?.recurring ?? 0}
          otherIncome={otherIncome}
          initialSettings={savedSettings ?? DEFAULT_SETTINGS}
          recentAvg={recentAvg}
          now={now}
        />
      </QueryContent>
    </>
  );
}

function SalaryPlannerInner({
  snapshot,
  onPlannerValuesChange,
  salary,
  otherIncome,
  initialSettings,
  recentAvg,
  now,
}: SalaryPlannerProps & {
  salary: number;
  otherIncome: { bonus: number; oneTime: number };
  initialSettings: PlannerSettingsData;
  recentAvg: RecentAvgExpense;
  now: Date;
}) {
  const { canReveal, getHideEpoch, mask } = useAmountVisibility();
  const upsertSettings = useUpsertPlannerSettings();
  const mutateRef = useRef(upsertSettings.mutate);
  useEffect(() => {
    mutateRef.current = upsertSettings.mutate;
  });

  const { override: expensesOverride, setOverride: setExpensesOverride } =
    useExpensesOverride();
  const averageExpenses = Math.round(recentAvg.average);
  const expenses = expensesOverride ?? averageExpenses;

  const [settings, setSettings] = useState({
    emergencyMonths: initialSettings.emergencyMonths,
    warChestMonths: initialSettings.warChestMonths,
    titheEnabled: initialSettings.titheEnabled,
    tithePctInput: initialSettings.tithePct,
    allowanceEnabled: initialSettings.allowanceEnabled,
    allowancePctInput: initialSettings.allowancePct,
    expenseBufferPct: initialSettings.expenseBufferPct ?? 0,
  });
  const {
    emergencyMonths,
    warChestMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
    expenseBufferPct,
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
      expenseBufferPct,
    });
  }, [
    emergencyMonths,
    warChestMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
    expenseBufferPct,
    debouncedSave,
  ]);

  const planQuery = useHouseholdPlan();
  const planInput = planQuery.data;
  const householdStatus: HouseholdQueryStatus = planQuery.isError
    ? 'error'
    : planQuery.isPending
      ? 'loading'
      : 'ready';
  const readyInput =
    planInput && planInput.state === 'ready' ? planInput : null;

  const currentSavings = snapshot
    ? sumByCategory(snapshot.entries, 'savings')
    : 0;
  const currentBonds = snapshot ? sumByCategory(snapshot.entries, 'bonds') : 0;

  const planBase = {
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
    expenseBufferPct,
  };
  // The surplus depends only on savings, bonds and expenses, so it is known
  // before the household figure and the two steps never form a cycle.
  const baseline = computeSalaryPlan(planBase);
  const surplus = Math.max(0, baseline.goalsFunded - baseline.goalsNeeded);
  const householdPlan = readyInput
    ? computeHouseholdPlan(readyInput, { surplus, now })
    : null;
  const householdMonthlyDeduction = householdPlan ? householdPlan.monthly : 0;

  const plan = computeSalaryPlan({ ...planBase, householdMonthlyDeduction });
  const { investmentAmt, emergencyFundGoal, warChestGoal } = plan;
  const householdEarmark = householdPlan ? householdPlan.surplusUsed : 0;
  const shortfall = plan.householdShortfallAmt;
  const recommendations =
    readyInput && householdPlan
      ? householdRecommendations(readyInput, householdPlan, {
          now,
          shortfallPerMonth: shortfall,
        })
      : [];

  useEffect(() => {
    onPlannerValuesChange?.({
      investmentAmount: investmentAmt,
      emergencyFundGoal,
      warChestGoal,
      householdEarmark,
      expenses,
    });
  }, [
    investmentAmt,
    emergencyFundGoal,
    warChestGoal,
    householdEarmark,
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
    ...(plan.bufferAmt > 0
      ? [
          {
            key: 'buffer',
            label: `Buffer ${expenseBufferPct}%`,
            amount: plan.bufferAmt,
            pct: plan.bufferPct,
            color: chartColor(10),
          },
        ]
      : []),
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
    ...(readyInput && householdPlan
      ? [
          {
            key: 'household',
            label: 'Household',
            amount: plan.householdAmt,
            pct: plan.householdPct,
            color: chartColor(2),
            details: (
              <HouseholdBreakdown
                input={readyInput}
                plan={householdPlan}
                recommendations={recommendations}
                now={now}
              />
            ),
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
      label: 'Investment',
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
  ];

  const impactMonths = shortfallImpactMonths(
    householdPlan?.bindingMonths ?? null
  );
  const impact =
    shortfall > 0
      ? computeShortfallImpact({
          shortfallPerMonth: shortfall,
          monthsHorizon: impactMonths,
          currentSavings,
          expenses,
          emergencyMonths,
        })
      : null;

  const scenarioHousehold =
    householdMonthlyDeduction > 0 ? { householdMonthlyDeduction } : {};

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
              <p className="text-xs font-medium">Gross Salary</p>
              <p
                className="text-sm font-semibold tabular-nums"
                data-testid="planner-salary"
              >
                {salary > 0 ? mask(formatSGD(salary)) : 'No salary record'}
              </p>
              <Link
                href={PAGE_ROUTES.SALARY}
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
              >
                {salary > 0
                  ? 'From your latest salary record'
                  : 'Add a salary record'}
              </Link>
              {(otherIncome.bonus > 0 || otherIncome.oneTime > 0) && (
                <p
                  className="text-muted-foreground text-xs"
                  data-testid="planner-other-income"
                >
                  Last 12 months, not planned: bonus{' '}
                  {mask(formatSGD(otherIncome.bonus))} · one-time{' '}
                  {mask(formatSGD(otherIncome.oneTime))}
                </p>
              )}
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
            <HouseholdNote status={householdStatus} input={planInput} />
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
                  Savings and investment are 0. Over {mask(impactMonths)} months
                  this leaves {mask(impact.monthsCovered.toFixed(1))} of{' '}
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
