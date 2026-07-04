'use client';

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
import { format, subMonths } from 'date-fns';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_COLORS,
  EXPENSE_TYPE_LABELS,
} from '../constants';
import type { ExpenseData, ExpenseType } from '../types';

interface ChartDataPoint {
  month: string; // "Mar 2026"
  monthKey: string; // "2026-03"
  total: number;
  [key: string]: number | string;
}

function buildChartData(expenses: ExpenseData[]): ChartDataPoint[] {
  const now = new Date();
  const months: ChartDataPoint[] = [];

  // Generate past 12 months
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    const monthKey = format(d, 'yyyy-MM');
    const label = format(d, 'MMM yyyy');
    const point: ChartDataPoint = { month: label, monthKey, total: 0 };
    for (const t of EXPENSE_TYPES) {
      point[t] = 0;
    }
    months.push(point);
  }

  // Fill in expenses
  for (const e of expenses) {
    const key = e.date.slice(0, 7); // "2026-03"
    const point = months.find((m) => m.monthKey === key);
    if (!point) continue;

    // Use the user's share (total - what others owe) for shared expenses
    let userAmount = e.amount;
    if (e.splitType === 'shared' && e.splits.length > 0) {
      const othersTotal = e.splits.reduce((sum, s) => sum + s.amount, 0);
      userAmount = e.amount - othersTotal;
    }

    point[e.type] = (point[e.type] as number) + userAmount;
    point.total += userAmount;
  }

  return months;
}

function getActiveTypes(data: ChartDataPoint[]): ExpenseType[] {
  return EXPENSE_TYPES.filter((t) => data.some((d) => (d[t] as number) > 0));
}

interface ExpenseChartProps {
  expenses: ExpenseData[];
}

export function ExpenseChart({ expenses }: ExpenseChartProps) {
  const chartData = buildChartData(expenses);
  const activeTypes = getActiveTypes(chartData);

  const monthsWithData = chartData.filter((d) => d.total > 0);
  const avgExpense =
    monthsWithData.length > 0
      ? monthsWithData.reduce((sum, d) => sum + d.total, 0) /
        monthsWithData.length
      : 0;

  const totalExpense = chartData.reduce((sum, d) => sum + d.total, 0);

  // All-time average: group all expenses by month, average across every month with spend
  const allTimeMonthTotals = new Map<string, number>();
  for (const e of expenses) {
    const key = e.date.slice(0, 7);
    let userAmount = e.amount;
    if (e.splitType === 'shared' && e.splits.length > 0) {
      userAmount = e.amount - e.splits.reduce((sum, s) => sum + s.amount, 0);
    }
    allTimeMonthTotals.set(
      key,
      (allTimeMonthTotals.get(key) ?? 0) + userAmount
    );
  }
  const allTimeAvg =
    allTimeMonthTotals.size > 0
      ? Array.from(allTimeMonthTotals.values()).reduce((sum, v) => sum + v, 0) /
        allTimeMonthTotals.size
      : 0;
  const maxTotal = Math.max(...chartData.map((d) => d.total), 0);
  const yMax = Math.ceil(maxTotal / 500) * 500 || 500;

  if (expenses.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex-between">
          <div>
            <CardTitle className="text-xl">Monthly Expenses</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground mb-0.5 text-xs tracking-wide uppercase">
              12-month total
            </p>
            <p className="text-2xl font-bold">{formatSGDWhole(totalExpense)}</p>
            <p className="text-muted-foreground text-xs">
              All-time avg {formatSGDWhole(allTimeAvg)} / mo
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
                content={({ active, payload, label }: TooltipContentProps) => {
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
                  (EXPENSE_TYPE_LABELS[value as ExpenseType] ?? value) as string
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
      </CardContent>
    </Card>
  );
}
