'use client';

import { useAmountVisibility } from '@/features/privacy';
import { ExpenseAnomalyReview } from './expense-anomaly-review';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CHART_AXIS_TICK_PROPS,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_COLORS,
  EXPENSE_TYPE_LABELS,
} from '../constants';
import { buildExpenseChart } from '../lib/expense-chart';
import type { ExpenseData, ExpenseType } from '../types';

interface ExpenseChartProps {
  expenses: ExpenseData[];
}

export function ExpenseChart({ expenses }: ExpenseChartProps) {
  const { hidden, mask } = useAmountVisibility();
  const summary = buildExpenseChart(expenses);
  if (expenses.length === 0 || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Expenses</CardTitle>
          <CardDescription>
            {expenses.length === 0
              ? 'No expenses yet. Open Transactions to add an expense or import a bank PDF.'
              : 'Spending totals are unavailable. Check amounts and shared splits in Transactions.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const { chartData, totalExpense, avgExpense, allTimeAvg } = summary;
  const activeTypes = EXPENSE_TYPES.filter((type) =>
    chartData.some((point) => (point[type] as number) > 0)
  );
  const maxTotal = Math.max(...chartData.map((point) => point.total), 0);
  const yMax = Math.ceil(maxTotal / 500) * 500 || 500;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl">Monthly Expenses</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
            <div className="mt-3">
              <ExpenseAnomalyReview />
            </div>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="text-muted-foreground mb-0.5 text-xs tracking-wide uppercase">
              12-month total
            </p>
            <p className="text-2xl font-bold break-words tabular-nums">
              {mask(formatSGDWhole(totalExpense))}
            </p>
            <p className="text-muted-foreground text-xs">
              All-time avg {mask(formatSGDWhole(allTimeAvg))} / mo
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hidden ? (
          <p className="text-muted-foreground flex h-[350px] items-center justify-center text-sm">
            Chart hidden while amounts are hidden.
          </p>
        ) : (
          <div className="expenses-bar-chart h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="15%">
                <XAxis
                  dataKey="month"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.split(' ')[0]}
                  {...CHART_AXIS_TICK_PROPS}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatSGDWhole(v)}
                  width={70}
                  domain={[0, yMax]}
                  {...CHART_AXIS_TICK_PROPS}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 10 }}
                  content={({
                    active,
                    payload,
                    label,
                  }: TooltipContentProps) => {
                    if (!active || !payload?.length) return null;
                    const items = payload.filter((p) => Number(p.value) > 0);
                    if (!items.length) return null;
                    const total = items.reduce(
                      (sum: number, p) => sum + Number(p.value),
                      0
                    );
                    return (
                      <div className="bg-background rounded-md border px-3 py-2 shadow-md">
                        <div className="mb-1.5 flex items-center justify-between gap-4">
                          <p className="text-xs font-semibold">{label}</p>
                          <p className="text-xs font-bold">
                            {formatSGDWhole(total)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <div
                              key={String(item.dataKey)}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-muted-foreground">
                                {EXPENSE_TYPE_LABELS[
                                  String(item.dataKey) as ExpenseType
                                ] ?? String(item.dataKey)}
                              </span>
                              <span className="ml-auto pl-4 font-medium tabular-nums">
                                {formatSGDWhole(Number(item.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    (EXPENSE_TYPE_LABELS[value as ExpenseType] ??
                      value) as string
                  }
                  wrapperStyle={{ fontSize: 11 }}
                />
                <ReferenceLine
                  y={avgExpense}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg ${formatSGDWhole(avgExpense)}`,
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: 'currentColor',
                  }}
                />
                {activeTypes.map((type) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    stackId="expenses"
                    fill={EXPENSE_TYPE_COLORS[type]}
                    radius={
                      type === activeTypes[activeTypes.length - 1]
                        ? [2, 2, 0, 0]
                        : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
