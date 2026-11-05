'use client';

import { ProgressBar } from '@/components/widgets/progress-bar';
import { useAmountVisibility } from '@/features/privacy';
import { formatSGD } from '@/lib/utils/currency';

export interface TargetBar {
  key: string;
  label: string;
  funded: number;
  target: number;
}

function TargetProgress({ bar }: { bar: TargetBar }) {
  const { mask } = useAmountVisibility();
  const pct =
    bar.target > 0
      ? Math.min(100, Math.round((bar.funded / bar.target) * 100))
      : 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span>{bar.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {mask(formatSGD(Math.min(bar.funded, bar.target)))} of{' '}
          {mask(formatSGD(bar.target))}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={bar.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <ProgressBar segments={[{ pct, className: 'fill-primary' }]} />
      </div>
    </div>
  );
}

/** Funded-of-target bars for the emergency fund, war chest and household reserve. */
export function PlannerTargets({ bars }: { bars: TargetBar[] }) {
  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <TargetProgress key={bar.key} bar={bar} />
      ))}
    </div>
  );
}
