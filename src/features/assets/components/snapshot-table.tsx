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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 0,
  }).format(value);
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

export function SnapshotTable({ snapshots }: SnapshotTableProps) {
  const router = useRouter();
  const deleteMutation = useDeleteSnapshot();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  if (!snapshots.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>No snapshots recorded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const PAGE_SIZES = [10, 25, 50] as const;
  const reversed = [...snapshots].reverse();
  const totalPages = Math.max(Math.ceil(reversed.length / pageSize), 1);
  const paged = reversed.slice(page * pageSize, (page + 1) * pageSize);

  function ActionButtons({ id }: { id: string }) {
    const [open, setOpen] = useState(false);

    async function handleDelete() {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(`Deleted ${id}`);
        setOpen(false);
      } catch {
        toast.error('Failed to delete');
      }
    }

    return (
      <div className="flex justify-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/entry?edit=${id}`)}
        >
          <Pencil className="size-4" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Snapshot</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the snapshot for{' '}
                <span className="font-semibold">{id}</span>? This action cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

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
                        <td key={cat} className="py-2 text-center">
                          {amount > 0 ? formatCurrency(amount) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 text-center font-semibold">
                      {formatCurrency(total)}
                    </td>
                    <td className="py-2 text-center">
                      <ActionButtons id={s.id} />
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
                        <td key={col.label} className="py-2 text-center">
                          {amount > 0 ? formatCurrency(amount) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 text-center font-semibold">
                      {formatCurrency(total)}
                    </td>
                    <td className="py-2 text-center">
                      <ActionButtons id={s.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {reversed.length > 0 && (
          <div className="flex-between mt-4 text-sm">
            <span className="text-muted-foreground text-xs">
              Showing {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, reversed.length)} of{' '}
              {reversed.length} snapshot{reversed.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span>Page</span>
                <input
                  key={page}
                  type="number"
                  defaultValue={page + 1}
                  min={1}
                  max={totalPages}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const n = parseInt(e.currentTarget.value, 10);
                      if (!isNaN(n))
                        setPage(Math.max(0, Math.min(n - 1, totalPages - 1)));
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.currentTarget.value, 10);
                    if (!isNaN(n))
                      setPage(Math.max(0, Math.min(n - 1, totalPages - 1)));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="h-8 w-12 [appearance:textfield] rounded-md border text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span>of {totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
