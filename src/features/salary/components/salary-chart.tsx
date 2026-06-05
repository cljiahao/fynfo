'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CHART_AXIS_TICK_PROPS,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { format, parse } from 'date-fns';
import type { SalaryData } from '../types';

interface SalaryChartProps {
  records: SalaryData[];
}

const ALL_LABELS: Record<string, string> = {
  salary: 'Gross Salary',
  bonus: 'Bonus',
  cumulative: 'Cumulative Total',
};

export function SalaryChart({ records }: SalaryChartProps) {
  if (!records.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salary Growth</CardTitle>
          <CardDescription>No salary records yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex-center text-muted-foreground h-[300px] text-sm">
            Add salary records to see your growth chart
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = records.reduce<
    { month: string; salary: number; bonus: number; cumulative: number }[]
  >((acc, r) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({
      month: format(parse(r.id, 'yyyy-MM', new Date()), 'MMM yyyy'),
      salary: r.salary,
      bonus: r.bonus,
      cumulative: prev + r.salary + r.bonus,
    });
    return acc;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary Growth</CardTitle>
        <CardDescription>
          Monthly salary, bonus, and cumulative earnings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend
                formatter={(value: string) => ALL_LABELS[value] ?? value}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="salary"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="bonus"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
