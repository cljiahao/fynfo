'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ConfirmDeleteDialog,
  EmptyState,
  PaginationControls,
} from '@/components/widgets';
import { formatSGDWhole } from '@/lib/utils/currency';
import { LineChart, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  INVESTMENT_CATEGORIES,
} from '../constants';
import { useDeleteSnapshot } from '../hooks/use-snapshots';
import { calculateTotal } from '../lib/calculations';
import type { AssetCategory, SnapshotData } from '../types';

interface SnapshotTableProps {
  snapshots: SnapshotData[];
}

function sumCategory(
  entries: SnapshotData['entries'],
  category: AssetCategory
): number {
  return entries
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

function sumCategories(
  entries: SnapshotData['entries'],
  categories: AssetCategory[]
): number {
  return entries
    .filter((e) => categories.includes(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
}

const COMPACT_COLUMNS = [
  {
    label: 'Savings',
    getValue: (e: SnapshotData['entries']) => sumCategory(e, 'savings'),
  },
  {
    label: 'Bonds',
    getValue: (e: SnapshotData['entries']) => sumCategory(e, 'bonds'),
  },
  {
    label: 'Investment',
    getValue: (e: SnapshotData['entries']) =>
      sumCategories(e, INVESTMENT_CATEGORIES),
  },
  {
    label: 'Pension',
    getValue: (e: SnapshotData['entries']) => sumCategory(e, 'pension'),
  },
] as const;

function SnapshotActionButtons({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const deleteMutation = useDeleteSnapshot();

  return (
    <div className="flex justify-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(`/dashboard/entry?edit=${id}`)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="text-destructive size-4" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Snapshot"
        description={
          <>
            Are you sure you want to delete the snapshot for{' '}
            <span className="font-semibold">{id}</span>? This action cannot be
            undone.
          </>
        }
        isPending={deleteMutation.isPending}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(id);
          toast.success(`Deleted ${id}`);
        }}
      />
    </div>
  );
}

export function SnapshotTable({ snapshots }: SnapshotTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  if (!snapshots.length) {
    return (
      <EmptyState
        icon={LineChart}
        title="No snapshots recorded yet"
        description="Add a monthly snapshot to start tracking your assets over time."
      />
    );
  }

  const reversed = [...snapshots].reverse();
  const paged = reversed.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>All monthly snapshots</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Full table - hidden on small screens */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Month</th>
                {CATEGORIES.map((cat) => (
                  <th key={cat} className="py-2 text-center font-medium">
                    {CATEGORY_LABELS[cat]}
                  </th>
                ))}
                <th className="py-2 text-center font-medium">Total</th>
                <th className="py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => {
                const total = calculateTotal(s.entries);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.id}</td>
                    {CATEGORIES.map((cat) => {
                      const amount = sumCategory(s.entries, cat);
                      return (
                        <td key={cat} className="py-2 text-center tabular-nums">
                          {amount > 0 ? formatSGDWhole(amount) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 text-center font-semibold tabular-nums">
                      {formatSGDWhole(total)}
                    </td>
                    <td className="py-2 text-center">
                      <SnapshotActionButtons id={s.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Compact table - shown on small screens */}
        <div className="overflow-x-auto lg:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Month</th>
                {COMPACT_COLUMNS.map((col) => (
                  <th key={col.label} className="py-2 text-center font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="py-2 text-center font-medium">Total</th>
                <th className="py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => {
                const total = calculateTotal(s.entries);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.id}</td>
                    {COMPACT_COLUMNS.map((col) => {
                      const amount = col.getValue(s.entries);
                      return (
                        <td
                          key={col.label}
                          className="py-2 text-center tabular-nums"
                        >
                          {amount > 0 ? formatSGDWhole(amount) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 text-center font-semibold tabular-nums">
                      {formatSGDWhole(total)}
                    </td>
                    <td className="py-2 text-center">
                      <SnapshotActionButtons id={s.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {reversed.length > 0 && (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={reversed.length}
            itemLabel="snapshot"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </CardContent>
    </Card>
  );
}
