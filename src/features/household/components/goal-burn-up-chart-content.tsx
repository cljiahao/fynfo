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
import { useState, type ReactNode } from 'react';
import {
  burnUpSeries,
  goalBasis,
  paidSeries,
  plannedTotal,
} from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

const SAVED_STROKE = 'var(--chart-2)';
const SERIES_LABEL = {
  saved: 'Saved',
  needed: 'Needed pace',
  paid: 'Paid',
  due: 'Due by date',
} as const;

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border p-3 sm:p-4">
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-center text-sm">
        {children}
      </p>
    </div>
  );
}

export function GoalBurnUpChart({ goal }: { goal: HouseholdGoal }) {
  const { hidden } = useAmountVisibility();
  const [now] = useState(() => new Date());
  // Placeholders keep the chart's 220px so nothing shifts when amounts are
  // hidden or the first contribution arrives.
  if (hidden)
    return <Placeholder>Chart hidden while amounts are hidden</Placeholder>;
  if (goalBasis(goal) === 'paid') {
    const hasPayments = goal.items.some((item) => item.payments.length > 0);
    if (!hasPayments)
      return <Placeholder>Record a payment to start the chart</Placeholder>;
    return <PaidChart goal={goal} now={now} />;
  }
  if (goal.contributions.length === 0)
    return <Placeholder>Add to the goal to start the chart</Placeholder>;
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
    <div className="space-y-2 rounded-xl border p-3 sm:p-4">
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
      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full bg-[var(--chart-2)]"
          />
          Saved
        </span>
        {hasPace && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="border-muted-foreground inline-block w-4 border-t-2 border-dashed"
            />
            Needed pace to the target date
          </span>
        )}
      </p>
    </div>
  );
}

function PaidChart({ goal, now }: { goal: HouseholdGoal; now: Date }) {
  const data = paidSeries(goal, now).map((row) => ({
    t: parseISO(row.date).getTime(),
    paid: row.paid,
    due: row.due,
  }));
  const yMax = Math.max(
    plannedTotal(goal),
    ...data.map((row) => Math.max(row.paid ?? 0, row.due ?? 0))
  );
  const hasDue = data.some((row) => row.due !== null);

  return (
    <div className="space-y-2 rounded-xl border p-3 sm:p-4">
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
            {hasDue && (
              <Line
                type="stepAfter"
                dataKey="due"
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
              dataKey="paid"
              stroke={SAVED_STROKE}
              strokeWidth={2}
              dot={data.length < 3}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full bg-[var(--chart-2)]"
          />
          Paid
        </span>
        {hasDue && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="border-muted-foreground inline-block w-4 border-t-2 border-dashed"
            />
            Due by date
          </span>
        )}
      </p>
    </div>
  );
}
