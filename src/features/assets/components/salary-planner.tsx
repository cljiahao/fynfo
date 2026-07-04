'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useExpenses } from '@/features/expenses';
import { useSalaryRecords } from '@/features/salary/hooks/use-salary';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  usePlannerSettings,
  useUpsertPlannerSettings,
} from '../hooks/use-planner-settings';
import {
  calcAllTimeAvgExpense,
  computeSalaryPlan,
  sumByCategory,
} from '../lib/salary-plan';
import type { PlannerSettingsData, SnapshotData } from '../types';
import { PlannerInputs } from './planner-inputs';
import { PlannerResults } from './planner-results';

export interface PlannerValues {
  investmentAmount: number;
  emergencyFundGoal: number;
  warChestGoal: number;
  expenses: number;
}

interface SalaryPlannerProps {
  snapshot?: SnapshotData;
  onPlannerValuesChange?: (values: PlannerValues) => void;
}

const DEFAULT_SETTINGS: PlannerSettingsData = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: true,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
};

export function SalaryPlanner(props: SalaryPlannerProps) {
  const { data: salaryRecords, isLoading: salaryLoading } = useSalaryRecords();
  const { data: savedSettings, isLoading: settingsLoading } =
    usePlannerSettings();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();

  if (salaryLoading || settingsLoading || expensesLoading) {
    return (
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
    );
  }

  const latestSalary = salaryRecords?.[salaryRecords.length - 1];
  const avgExpenses = calcAllTimeAvgExpense(expenses);

  return (
    <SalaryPlannerInner
      {...props}
      initialSalary={latestSalary?.salary ?? 0}
      initialSettings={savedSettings ?? DEFAULT_SETTINGS}
      avgExpenses={avgExpenses}
    />
  );
}

function SalaryPlannerInner({
  snapshot,
  onPlannerValuesChange,
  initialSalary,
  initialSettings,
  avgExpenses,
}: SalaryPlannerProps & {
  initialSalary: number;
  initialSettings: PlannerSettingsData;
  avgExpenses: number;
}) {
  const upsertSettings = useUpsertPlannerSettings();
  const mutateRef = useRef(upsertSettings.mutate);
  useEffect(() => {
    mutateRef.current = upsertSettings.mutate;
  });

  const [salary, setSalary] = useState(initialSalary);
  const [expenses, setExpenses] = useState(Math.round(avgExpenses));

  const [emergencyMonths, setEmergencyMonths] = useState(
    initialSettings.emergencyMonths
  );
  const [warChestMonths, setWarChestMonths] = useState(
    initialSettings.warChestMonths
  );
  const [titheEnabled, setTitheEnabled] = useState(
    initialSettings.titheEnabled
  );
  const [tithePctInput, setTithePctInput] = useState(initialSettings.tithePct);
  const [allowanceEnabled, setAllowanceEnabled] = useState(
    initialSettings.allowanceEnabled
  );
  const [allowancePctInput, setAllowancePctInput] = useState(
    initialSettings.allowancePct
  );

  // Debounced auto-save using ref to avoid unstable dependency
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const debouncedSave = useCallback((data: PlannerSettingsData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      mutateRef.current(data);
    }, 800);
  }, []);

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
    });
  }, [
    emergencyMonths,
    warChestMonths,
    titheEnabled,
    tithePctInput,
    allowanceEnabled,
    allowancePctInput,
    debouncedSave,
  ]);

  const currentSavings = snapshot
    ? sumByCategory(snapshot.entries, 'savings')
    : 0;
  const currentBonds = snapshot ? sumByCategory(snapshot.entries, 'bonds') : 0;

  const {
    netAfterCpf,
    expensesPct,
    insurancePct,
    tithePct,
    allowancePct,
    savingsPct,
    investmentPct,
    emergencyFundGoal,
    warChestGoal,
    goalsFulfilled,
    savingsAmt,
    expensesAmt,
    insuranceAmt,
    investmentAmt,
    titheAmt,
    allowanceAmt,
  } = computeSalaryPlan({
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
  });

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

  const pieData = [
    { name: 'Savings', value: Math.max(savingsAmt, 0), fill: '#3b82f6' },
    { name: 'Expenses', value: expensesAmt, fill: '#ef4444' },
    { name: 'Insurance', value: insuranceAmt, fill: '#eab308' },
    { name: 'Investment', value: Math.max(investmentAmt, 0), fill: '#22c55e' },
    ...(titheEnabled
      ? [{ name: 'Tithe', value: titheAmt, fill: '#8b5cf6' }]
      : []),
    ...(allowanceEnabled
      ? [{ name: 'Allowance', value: allowanceAmt, fill: '#b45309' }]
      : []),
  ];

  const breakdownItems = [
    {
      label: `Savings (${(savingsPct * 100).toFixed(1)}%)`,
      value: savingsAmt,
      color: '#3b82f6',
    },
    {
      label: `Expenses (${(expensesPct * 100).toFixed(1)}%)`,
      value: expensesAmt,
      color: '#ef4444',
    },
    {
      label: `Insurance (${(insurancePct * 100).toFixed(0)}%)`,
      value: insuranceAmt,
      color: '#eab308',
    },
    {
      label: `Investment (${(investmentPct * 100).toFixed(1)}%)`,
      value: investmentAmt,
      color: '#22c55e',
    },
    ...(titheEnabled
      ? [
          {
            label: `Tithe (${(tithePct * 100).toFixed(0)}%)`,
            value: titheAmt,
            color: '#8b5cf6',
          },
        ]
      : []),
    ...(allowanceEnabled
      ? [
          {
            label: `Allowance (${(allowancePct * 100).toFixed(0)}%)`,
            value: allowanceAmt,
            color: '#b45309',
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planner</CardTitle>
        <CardDescription>
          Salary allocation simulator (after 20% CPF)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PlannerInputs
          salary={salary}
          expenses={expenses}
          emergencyMonths={emergencyMonths}
          warChestMonths={warChestMonths}
          avgExpenses={avgExpenses}
          setSalary={setSalary}
          setExpenses={setExpenses}
          setEmergencyMonths={setEmergencyMonths}
          setWarChestMonths={setWarChestMonths}
        />

        {salary > 0 && (
          <PlannerResults
            pieData={pieData}
            netAfterCpf={netAfterCpf}
            breakdownItems={breakdownItems}
            titheEnabled={titheEnabled}
            setTitheEnabled={setTitheEnabled}
            tithePctInput={tithePctInput}
            setTithePctInput={setTithePctInput}
            allowanceEnabled={allowanceEnabled}
            setAllowanceEnabled={setAllowanceEnabled}
            allowancePctInput={allowancePctInput}
            setAllowancePctInput={setAllowancePctInput}
            expenses={expenses}
            emergencyMonths={emergencyMonths}
            warChestMonths={warChestMonths}
            emergencyFundGoal={emergencyFundGoal}
            warChestGoal={warChestGoal}
            currentSavings={currentSavings}
            currentBonds={currentBonds}
            goalsFulfilled={goalsFulfilled}
          />
        )}

        {salary === 0 && (
          <div className="flex-center text-muted-foreground py-8 text-sm">
            Enter salary to see allocation
          </div>
        )}
      </CardContent>
    </Card>
  );
}
