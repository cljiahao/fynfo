'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Wallet } from 'lucide-react';
import { INVESTMENT_CATEGORIES } from '../constants';
import {
  calculateMoMChange,
  getLatestSnapshot,
  getPreviousSnapshot,
} from '../lib/calculations';
import type { AssetCategory, SnapshotWithTotals } from '../types';

interface SummaryCardsProps {
  snapshots: SnapshotWithTotals[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
}: {
  title: string;
  current: number;
  previous: number;
  previousId: string | undefined;
}) {
  const { absolute: change, percentage: pct } = calculateMoMChange(
    current,
    previous
  );
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {change >= 0 ? (
          <ArrowUp className="size-4 text-emerald-500" />
        ) : (
          <ArrowDown className="size-4 text-red-500" />
        )}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {change >= 0 ? '+' : ''}
          {formatCurrency(change)}
        </div>
        <p className="text-muted-foreground text-xs">
          {previousId
            ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% from ${previousId}`
            : 'No previous month'}
        </p>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ snapshots }: SummaryCardsProps) {
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          <Wallet className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(currentTotal)}
          </div>
          <p className="text-muted-foreground text-xs">
            {latest?.id ?? 'No data'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Excl. Pension</CardTitle>
          <Wallet className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(latestExPension)}
          </div>
          <p className="text-muted-foreground text-xs">
            {latest?.id ?? 'No data'}
          </p>
        </CardContent>
      </Card>

      <ChangeCard
        title="Savings Change"
        current={currentSavings}
        previous={previousSavings}
        previousId={previous?.id}
      />

      <ChangeCard
        title="Investment Change"
        current={currentInvestment}
        previous={previousInvestment}
        previousId={previous?.id}
      />
    </div>
  );
}
