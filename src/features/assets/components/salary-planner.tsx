'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExpenses } from '@/features/expenses';
import { useSalaryRecords } from '@/features/salary/hooks/use-salary';
import {
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from '@/lib/recharts';
import { formatSGD } from '@/lib/utils/currency';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  usePlannerSettings,
  useUpsertPlannerSettings,
} from '../hooks/use-planner-settings';
import type {
  AssetCategory,
  PlannerSettingsData,
  SnapshotData,
} from '../types';

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

function ceilToThousand(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

function sumByCategory(
  entries: SnapshotData['entries'],
  category: AssetCategory
): number {
  return entries
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

const DEFAULT_SETTINGS: PlannerSettingsData = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: true,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
};

function calcAllTimeAvgExpense(
  expenses: ReturnType<typeof useExpenses>['data']
): number {
  if (!expenses?.length) return 0;
  const monthTotals = new Map<string, number>();
  for (const e of expenses) {
    const key = e.date.slice(0, 7);
    let userAmount = e.amount;
    if (e.splitType === 'shared' && e.splits.length > 0) {
      userAmount = e.amount - e.splits.reduce((sum, s) => sum + s.amount, 0);
    }
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + userAmount);
  }
  const totals = Array.from(monthTotals.values());
  return totals.reduce((sum, v) => sum + v, 0) / totals.length;
}

export function SalaryPlanner(props: SalaryPlannerProps) {
  const { data: salaryRecords, isLoading: salaryLoading } = useSalaryRecords();
  const { data: savedSettings, isLoading: settingsLoading } =
    usePlannerSettings();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();

  if (salaryLoading || settingsLoading || expensesLoading) {
    return (
      <Card>
        <CardContent className="flex-center py-12">
          <Loader2 className="size-6 animate-spin" />
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

  const netAfterCpf = salary * 0.8;

  // Fixed percentages
  const expensesPct = netAfterCpf > 0 ? expenses / netAfterCpf : 0;
  const insurancePct = 0.05;
  const tithePct = titheEnabled ? tithePctInput / 100 : 0;
  const allowancePct = allowanceEnabled ? allowancePctInput / 100 : 0;

  // Goals
  const emergencyFundGoal = ceilToThousand(expenses * emergencyMonths);
  const warChestGoal = ceilToThousand(expenses * warChestMonths);

  // Current asset values
  const currentSavings = snapshot
    ? sumByCategory(snapshot.entries, 'savings')
    : 0;
  const currentBonds = snapshot ? sumByCategory(snapshot.entries, 'bonds') : 0;

  // Determine savings % dynamically
  const usedPct = expensesPct + insurancePct + tithePct + allowancePct;
  const cappedPct = Math.max(1 - usedPct, 0);

  let savingsPct = 0;
  let investmentPct = 0;

  const emergencyFulfilled = currentSavings >= emergencyFundGoal;
  const warChestFulfilled = currentBonds >= warChestGoal;
  const goalsFulfilled = emergencyFulfilled && warChestFulfilled;

  const goalsNeeded = emergencyFundGoal + warChestGoal;
  const goalsFunded = currentSavings + currentBonds;

  if (netAfterCpf > 0) {
    if (!goalsFulfilled && usedPct < 1) {
      const remaining = Math.max(goalsNeeded - goalsFunded, 0);
      const average = remaining / 9;
      const cappedAmount = cappedPct * netAfterCpf;

      if (average < cappedAmount) {
        savingsPct = average / netAfterCpf;
      } else {
        savingsPct = cappedPct;
      }
    }
    // else goals fulfilled: savings = 0, all goes to investment

    investmentPct = Math.max(cappedPct - savingsPct, 0);
  }

  // Calculated amounts
  const savingsAmt = netAfterCpf * savingsPct;
  const expensesAmt = expenses;
  const insuranceAmt = netAfterCpf * insurancePct;
  const investmentAmt = netAfterCpf * investmentPct;
  const titheAmt = netAfterCpf * tithePct;
  const allowanceAmt = netAfterCpf * allowancePct;

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
      ? [{ name: 'Allowance', value: allowanceAmt, fill: '#92400e' }]
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
            color: '#92400e',
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
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Gross Salary</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              className="h-8 text-sm"
              value={salary || ''}
              onChange={(e) => setSalary(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {avgExpenses > 0 ? 'Avg. Expenses' : 'Est. Expenses'}
            </Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              className="h-8 text-sm"
              value={expenses || ''}
              onChange={(e) => setExpenses(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Emergency Fund (months)</Label>
            <Input
              type="number"
              min="1"
              placeholder="3"
              className="h-8 text-sm"
              value={emergencyMonths || ''}
              onChange={(e) => setEmergencyMonths(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">War Chest (months)</Label>
            <Input
              type="number"
              min="1"
              placeholder="9"
              className="h-8 text-sm"
              value={warChestMonths || ''}
              onChange={(e) => setWarChestMonths(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        {salary > 0 && (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Pie chart */}
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                    style={{ cursor: 'default', outline: 'none' }}
                  />
                  <Tooltip
                    formatter={(value: unknown) => {
                      const amt = Number(value);
                      const pct =
                        netAfterCpf > 0 ? (amt / netAfterCpf) * 100 : 0;
                      return `${formatSGD(amt)} (${pct.toFixed(1)}%)`;
                    }}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Breakdown + Goals */}
            <div className="space-y-4">
              {/* Optional deductions */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="tithe"
                    checked={titheEnabled}
                    onCheckedChange={(v) => setTitheEnabled(v === true)}
                  />
                  <Label htmlFor="tithe" className="text-xs">
                    Tithe
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="h-6 w-14 text-xs"
                    disabled={!titheEnabled}
                    value={tithePctInput || ''}
                    onChange={(e) =>
                      setTithePctInput(Number(e.target.value) || 0)
                    }
                  />
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="allowance"
                    checked={allowanceEnabled}
                    onCheckedChange={(v) => setAllowanceEnabled(v === true)}
                  />
                  <Label htmlFor="allowance" className="text-xs">
                    Allowance
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="h-6 w-14 text-xs"
                    disabled={!allowanceEnabled}
                    value={allowancePctInput || ''}
                    onChange={(e) =>
                      setAllowancePctInput(Number(e.target.value) || 0)
                    }
                  />
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex-between">
                  <span className="text-muted-foreground">Net (after CPF)</span>
                  <span className="font-medium">{formatSGD(netAfterCpf)}</span>
                </div>
                {breakdownItems.map((item) => (
                  <div key={item.label} className="flex-between">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </span>
                    <span
                      className={
                        item.value < 0
                          ? 'font-medium text-red-500'
                          : 'font-medium'
                      }
                    >
                      {formatSGD(item.value)}
                    </span>
                  </div>
                ))}
              </div>

              {expenses > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    Savings Goals
                  </p>
                  <div className="flex-between text-sm">
                    <span>Emergency Fund ({emergencyMonths}mo)</span>
                    <span className="font-semibold">
                      {formatSGD(emergencyFundGoal)}
                    </span>
                  </div>
                  <div className="flex-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      Current (Savings)
                    </span>
                    <span
                      className={`text-xs ${currentSavings >= emergencyFundGoal ? 'text-emerald-500' : 'text-amber-500'}`}
                    >
                      {formatSGD(currentSavings)}{' '}
                      {currentSavings >= emergencyFundGoal
                        ? '✓'
                        : `(need ${formatSGD(emergencyFundGoal - currentSavings)})`}
                    </span>
                  </div>
                  <div className="flex-between text-sm">
                    <span>War Chest ({warChestMonths}mo)</span>
                    <span className="font-semibold">
                      {formatSGD(warChestGoal)}
                    </span>
                  </div>
                  <div className="flex-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      Current (Bonds)
                    </span>
                    <span
                      className={`text-xs ${currentBonds >= warChestGoal ? 'text-emerald-500' : 'text-amber-500'}`}
                    >
                      {formatSGD(currentBonds)}{' '}
                      {currentBonds >= warChestGoal
                        ? '✓'
                        : `(need ${formatSGD(warChestGoal - currentBonds)})`}
                    </span>
                  </div>
                  {goalsFulfilled && (
                    <p className="text-xs font-medium text-emerald-500">
                      All goals fulfilled — surplus goes to investment
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
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
