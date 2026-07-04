'use client';

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
import { incomeByYear } from '../lib/dividend-metrics';
import type { DividendData } from '../types';

interface DividendIncomeChartProps {
  dividends: DividendData[];
  usdSgdRate: number;
}

export function DividendIncomeChart({
  dividends,
  usdSgdRate,
}: DividendIncomeChartProps) {
  const data = incomeByYear(dividends, usdSgdRate);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="year"
            fontSize={12}
            tickLine={false}
            axisLine={false}
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
