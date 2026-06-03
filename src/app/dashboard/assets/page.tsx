'use client';

import { Button } from '@/components/ui/button';
import {
  AssetLineChart,
  calculateTotal,
  CategoryBreakdown,
  SnapshotTable,
  useChartData,
  useSnapshots,
} from '@/features/assets';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { AssetsSkeleton } from './assets-skeleton';

export default function AssetsPage() {
  const { data: snapshots, isLoading } = useSnapshots();

  const snapshotsWithTotals = (snapshots ?? []).map((s) => ({
    ...s,
    total: calculateTotal(s.entries),
  }));

  // useChartData is a hook — must run before any conditional return.
  const chartData = useChartData(snapshots);
  const latest = snapshotsWithTotals[snapshotsWithTotals.length - 1];

  if (isLoading) return <AssetsSkeleton />;

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Assets & Investments
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your assets and investments over time
          </p>
        </div>
        <Link href="/dashboard/entry">
          <Button>
            <Plus className="mr-2 size-4" />
            Add Snapshot
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AssetLineChart data={chartData} />
        </div>
        <CategoryBreakdown
          snapshot={latest ? snapshots?.[snapshots.length - 1] : undefined}
        />
      </div>

      <SnapshotTable snapshots={snapshots ?? []} />
    </div>
  );
}
