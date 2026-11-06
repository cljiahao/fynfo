'use client';

import { useAmountVisibility } from '@/features/privacy';
import {
  CHART_TOOLTIP_PROPS,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from '@/lib/recharts';
import { formatSGD } from '@/lib/utils/currency';

export interface DonutSlice {
  key: string;
  label: string;
  amount: number;
  color: string;
}

interface PlannerDonutProps {
  slices: DonutSlice[];
  total: number;
  ariaLabel: string;
}

/** Donut of the monthly take-home split; the legend lives beside it. */
export function PlannerDonut({ slices, total, ariaLabel }: PlannerDonutProps) {
  const { mask } = useAmountVisibility();
  return (
    <div role="img" aria-label={ariaLabel} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
            className="outline-none"
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown) => {
              const amount = Number(value);
              const pct = total > 0 ? (amount / total) * 100 : 0;
              return `${mask(formatSGD(amount))} (${pct.toFixed(1)}%)`;
            }}
            {...CHART_TOOLTIP_PROPS}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
