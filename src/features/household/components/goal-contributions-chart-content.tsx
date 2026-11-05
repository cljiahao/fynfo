'use client';

import { useAmountVisibility } from '@/features/privacy';

import {
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { cumulativeContributions } from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

export function GoalContributionsChart({ goal }: { goal: HouseholdGoal }) {
  const { hidden } = useAmountVisibility();
  if (hidden)
    return (
      <p className="text-muted-foreground text-sm">
        Contributions chart hidden
      </p>
    );
  const data = cumulativeContributions(goal);

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <XAxis
            dataKey="date"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(v: string) => format(parseISO(v), 'd MMM')}
            {...CHART_AXIS_TICK_PROPS}
          />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={[0, (max: number) => Math.max(max, goal.targetAmount)]}
            tickFormatter={(v: number) => formatSGDWhole(v)}
            {...CHART_AXIS_TICK_PROPS}
          />
          <Tooltip
            labelFormatter={(label: unknown) =>
              format(parseISO(String(label)), 'dd MMM yyyy')
            }
            formatter={(value: unknown) => [
              formatSGDWhole(Number(value)),
              'Contributed',
            ]}
            {...CHART_TOOLTIP_PROPS}
          />
          <ReferenceLine
            y={goal.targetAmount}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={data.length < 2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
