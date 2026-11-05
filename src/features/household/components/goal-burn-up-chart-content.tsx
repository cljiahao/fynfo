'use client';

import { useAmountVisibility } from '@/features/privacy';

import {
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { useState } from 'react';
import { burnUpSeries } from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

const SAVED_STROKE = 'var(--chart-2)';
const SERIES_LABEL = { saved: 'Saved', needed: 'Needed pace' } as const;

export function GoalBurnUpChart({ goal }: { goal: HouseholdGoal }) {
  const { hidden } = useAmountVisibility();
  const [now] = useState(() => new Date());
  if (hidden)
    return (
      <p className="text-muted-foreground text-sm">Burn-up chart hidden</p>
    );
  // A numeric time axis keeps the pace line straight when contributions are unevenly spaced.
  const data = burnUpSeries(goal, now).map((row) => ({
    t: parseISO(row.date).getTime(),
    saved: row.saved,
    needed: row.needed,
  }));
  const yMax = Math.max(
    goal.targetAmount,
    ...data.map((row) => Math.max(row.saved ?? 0, row.needed ?? 0))
  );
  const hasPace = data.some((row) => row.needed !== null);

  return (
    <div className="space-y-2">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={(v: number) => format(new Date(v), 'd MMM')}
              {...CHART_AXIS_TICK_PROPS}
            />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={[0, yMax]}
              ticks={[0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax]}
              tickFormatter={(v: number) => formatSGDWhole(v)}
              {...CHART_AXIS_TICK_PROPS}
            />
            <Tooltip
              labelFormatter={(label: unknown) =>
                format(new Date(Number(label)), 'dd MMM yyyy')
              }
              formatter={(value: unknown, name: unknown) => [
                formatSGDWhole(Number(value)),
                SERIES_LABEL[name as keyof typeof SERIES_LABEL] ?? String(name),
              ]}
              {...CHART_TOOLTIP_PROPS}
            />
            {hasPace && (
              <Line
                type="linear"
                dataKey="needed"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="saved"
              stroke={SAVED_STROKE}
              strokeWidth={2}
              dot={data.length < 3}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full bg-[var(--chart-2)]"
          />
          Saved
        </span>
        {hasPace && <span>Dashed: needed pace to the target date</span>}
      </p>
    </div>
  );
}
