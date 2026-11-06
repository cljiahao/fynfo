'use client';

import { useAmountVisibility } from '@/features/privacy';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/widgets';
import {
  Bar,
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { formatRecordedMonth } from '@/lib/utils/month';
import { TrendingUp } from 'lucide-react';
import type { SalaryData } from '../types';

interface SalaryChartProps {
  records: SalaryData[];
}

const ALL_LABELS: Record<string, string> = {
  recurring: 'Recurring salary',
  bonus: 'Bonus',
  oneTime: 'One-time',
  cumulative: 'Cumulative Total',
};

export interface SalaryChartPoint {
  month: string;
  recurring: number;
  bonus: number;
  oneTime: number;
  cumulative: number;
}

export function buildSalaryChartData(
  records: readonly SalaryData[]
): SalaryChartPoint[] {
  let cumulative = 0;
  return records.map((r) => {
    cumulative += r.total;
    return {
      month: formatRecordedMonth(r.id),
      recurring: r.recurring,
      bonus: r.bonus,
      oneTime: r.oneTime,
      cumulative,
    };
  });
}

export function SalaryChart({ records }: SalaryChartProps) {
  const { hidden } = useAmountVisibility();
  if (hidden) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salary Growth</CardTitle>
          <CardDescription>
            Monthly recurring salary, bonus, one-time income and cumulative
            earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            className="text-muted-foreground flex h-[350px] items-center justify-center"
            role="status"
          >
            Show amounts to view the salary chart.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!records.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salary Growth</CardTitle>
          <CardDescription>
            Monthly recurring salary, bonus, one-time income and cumulative
            earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={TrendingUp}
            title="No salary records yet"
            description="Add salary records to see your growth chart"
            className="h-[300px] border-0"
          />
        </CardContent>
      </Card>
    );
  }

  const chartData = buildSalaryChartData(records);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary Growth</CardTitle>
        <CardDescription>
          Monthly recurring salary, bonus, one-time income and cumulative
          earnings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <XAxis
                dataKey="month"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                {...CHART_AXIS_TICK_PROPS}
              />
              <YAxis
                yAxisId="left"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatSGDWhole(v)}
                {...CHART_AXIS_TICK_PROPS}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatSGDWhole(v)}
                {...CHART_AXIS_TICK_PROPS}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  formatSGDWhole(Number(value)),
                  ALL_LABELS[String(name)] ?? String(name),
                ]}
                {...CHART_TOOLTIP_PROPS}
              />
              <Legend
                formatter={(value: string) => ALL_LABELS[value] ?? value}
              />
              <Bar
                yAxisId="left"
                dataKey="recurring"
                stackId="income"
                fill="var(--chart-1)"
              />
              <Bar
                yAxisId="left"
                dataKey="bonus"
                stackId="income"
                fill="var(--chart-3)"
              />
              <Bar
                yAxisId="left"
                dataKey="oneTime"
                stackId="income"
                fill="var(--chart-4)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="var(--chart-2)"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
