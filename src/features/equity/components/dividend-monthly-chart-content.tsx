'use client';

import { useAmountVisibility } from '@/features/privacy';
import {
  Bar,
  BarChart,
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { incomeForRecentMonths } from '../lib/dividend-breakdown';
import type { DividendData } from '../types';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function monthLabel(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

interface DividendMonthlyChartProps {
  dividends: DividendData[];
  usdSgdRate: number;
  // ISO date
  asOf: string;
}

export function DividendMonthlyChart({
  dividends,
  usdSgdRate,
  asOf,
}: DividendMonthlyChartProps) {
  const { hidden } = useAmountVisibility();
  if (hidden)
    return (
      <p className="text-muted-foreground text-sm">
        Monthly distribution chart hidden
      </p>
    );
  const data = incomeForRecentMonths(dividends, usdSgdRate, asOf, 12);

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="month"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={monthLabel}
            {...CHART_AXIS_TICK_PROPS}
          />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatSGDWhole(v)}
            {...CHART_AXIS_TICK_PROPS}
          />
          <Tooltip
            formatter={(value: unknown) => [
              formatSGDWhole(Number(value)),
              'Distributions',
            ]}
            {...CHART_TOOLTIP_PROPS}
          />
          <Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
