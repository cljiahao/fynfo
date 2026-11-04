'use client';

import { useAmountVisibility } from '@/features/privacy';

import {
  Bar,
  BarChart,
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { ITEM_CHART_NAME_WIDTH } from '../constants';
import { itemChartRows } from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

/** Above this many rows the paired bars need the taller chart to stay legible. */
const TALL_CHART_ROWS = 4;

export function GoalItemsChart({ goal }: { goal: HouseholdGoal }) {
  const { hidden } = useAmountVisibility();
  if (hidden)
    return <p className="text-muted-foreground text-sm">Budget chart hidden</p>;
  const { rows, more } = itemChartRows(goal);

  return (
    <div className="space-y-2">
      <div
        className={rows.length > TALL_CHART_ROWS ? 'h-[340px]' : 'h-[220px]'}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 8, top: 4 }}
          >
            <XAxis
              type="number"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatSGDWhole(v)}
              {...CHART_AXIS_TICK_PROPS}
            />
            <YAxis
              type="category"
              dataKey="name"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={ITEM_CHART_NAME_WIDTH}
              {...CHART_AXIS_TICK_PROPS}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [
                formatSGDWhole(Number(value)),
                String(name),
              ]}
              {...CHART_TOOLTIP_PROPS}
            />
            <Bar
              dataKey="budget"
              name="Budget"
              fill="var(--chart-3)"
              radius={[0, 4, 4, 0]}
            />
            <Bar dataKey="paid" name="Paid" radius={[0, 4, 4, 0]}>
              {rows.map((row) => (
                <Cell
                  key={row.id}
                  fill={row.over > 0 ? 'var(--loss)' : 'var(--chart-2)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {more > 0 && (
        <p className="text-muted-foreground text-xs">+{more} more below</p>
      )}
    </div>
  );
}
