'use client';

import { useAmountVisibility } from '@/features/privacy';

import { StatCard } from '@/components/widgets';
import { formatSGDWhole } from '@/lib/utils/currency';
import { Wallet } from 'lucide-react';
import { INVESTMENT_CATEGORIES } from '../constants';
import {
  calculateMoMChange,
  getLatestSnapshot,
  getPreviousSnapshot,
} from '../lib/calculations';
import type { AssetCategory, SnapshotWithTotals } from '../types';

interface SummaryCardsProps {
  snapshots: SnapshotWithTotals[];
  compact?: boolean;
}

function sumByCategories(
  s: SnapshotWithTotals,
  categories: AssetCategory[]
): number {
  return s.entries
    .filter((e) => categories.includes(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
}

function ChangeCard({
  title,
  current,
  previous,
  previousId,
  compact,
}: {
  title: string;
  current: number;
  previous: number;
  previousId: string | undefined;
  compact?: boolean;
}) {
  const { hidden, mask } = useAmountVisibility();
  const { absolute: change, percentage: pct } = calculateMoMChange(
    current,
    previous
  );
  return (
    <StatCard
      compact={compact}
      label={title}
      value={mask(`${change >= 0 ? '+' : ''}${formatSGDWhole(change)}`)}
      tone={hidden ? 'default' : change >= 0 ? 'gain' : 'loss'}
      trend={hidden ? undefined : change >= 0 ? 'up' : 'down'}
      hint={
        previousId
          ? `${mask(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`)} from ${previousId}`
          : 'No previous month'
      }
    />
  );
}

export function SummaryCards({
  snapshots,
  compact = false,
}: SummaryCardsProps) {
  const { mask } = useAmountVisibility();
  const latest = getLatestSnapshot(snapshots);
  const previous = latest
    ? getPreviousSnapshot(snapshots, latest.id)
    : undefined;

  const currentTotal = latest?.total ?? 0;
  const latestExPension = latest
    ? latest.entries
        .filter((e) => e.category !== 'pension')
        .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  const currentSavings = latest ? sumByCategories(latest, ['savings']) : 0;
  const previousSavings = previous ? sumByCategories(previous, ['savings']) : 0;

  const currentInvestment = latest
    ? sumByCategories(latest, INVESTMENT_CATEGORIES)
    : 0;
  const previousInvestment = previous
    ? sumByCategories(previous, INVESTMENT_CATEGORIES)
    : 0;

  return (
    <div
      className={
        compact
          ? 'grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4'
          : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
      }
    >
      <StatCard
        compact={compact}
        label="Total Assets"
        value={mask(formatSGDWhole(currentTotal))}
        icon={Wallet}
        hint={latest?.id ?? 'No data'}
      />
      <StatCard
        compact={compact}
        label="Excl. Pension"
        value={mask(formatSGDWhole(latestExPension))}
        icon={Wallet}
        hint={latest?.id ?? 'No data'}
      />
      <ChangeCard
        compact={compact}
        title="Savings Change"
        current={currentSavings}
        previous={previousSavings}
        previousId={previous?.id}
      />
      <ChangeCard
        compact={compact}
        title="Investment Change"
        current={currentInvestment}
        previous={previousInvestment}
        previousId={previous?.id}
      />
    </div>
  );
}
