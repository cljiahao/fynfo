'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/widgets';
import {
  AssetLineChart,
  calculateTotal,
  CategoryBreakdown,
  SnapshotTable,
  useChartData,
  useSnapshots,
} from '@/features/assets';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { AssetsSkeleton } from './assets-skeleton';

export default function AssetsPage() {
  const { data: snapshots, isLoading, isError, refetch } = useSnapshots();

  const snapshotsWithTotals = (snapshots ?? []).map((s) => ({
    ...s,
    total: calculateTotal(s.entries),
  }));

  // useChartData is a hook — must run before any conditional return.
  const chartData = useChartData(snapshots);
  const latest = snapshotsWithTotals[snapshotsWithTotals.length - 1];

  if (isLoading) return <AssetsSkeleton />;
  if (isError) return <DashboardError reset={() => void refetch()} />;

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <PageHeader
        title="Assets & Investments"
        description="Track your assets and investments over time"
        action={
          <Link href={PAGE_ROUTES.ENTRY}>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Snapshot
            </Button>
          </Link>
        }
      />

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
