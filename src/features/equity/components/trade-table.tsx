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
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteTrade } from '../hooks/use-equity';
import type { EquityTradeData } from '../types';

interface TradeTableProps {
  trades: EquityTradeData[];
  onEdit?: (trade: EquityTradeData) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value);
}

const PAGE_SIZES = [10, 25, 50] as const;

export function TradeTable({ trades, onEdit }: TradeTableProps) {
  const deleteMutation = useDeleteTrade();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const totalPages = Math.max(Math.ceil(trades.length / pageSize), 1);
  const paged = trades.slice(page * pageSize, (page + 1) * pageSize);

  function ActionButtons({ trade }: { trade: EquityTradeData }) {
    const [open, setOpen] = useState(false);

    async function handleDelete() {
      if (!trade.id) return;
      try {
        await deleteMutation.mutateAsync(trade.id);
        toast.success('Trade deleted');
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
          onClick={() => onEdit?.(trade)}
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
              <DialogTitle>Delete Trade</DialogTitle>
              <DialogDescription>
                Delete {trade.action.toUpperCase()} {trade.shares}{' '}
                <span className="font-semibold">{trade.ticker}</span>? This
                cannot be undone.
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

  if (!trades.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>No trades recorded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade History</CardTitle>
        <CardDescription>All equity trades</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Date</th>
                <th className="py-2 text-center font-medium">Broker</th>
                <th className="py-2 text-center font-medium">Ticker</th>
                <th className="py-2 text-center font-medium">Action</th>
                <th className="py-2 text-center font-medium">Shares</th>
                <th className="py-2 text-center font-medium">Price</th>
                <th className="py-2 text-center font-medium">Fees</th>
                <th className="py-2 text-center font-medium">Total</th>
                <th className="py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => {
                const total = t.shares * t.price;
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      {format(new Date(t.date), 'dd MMM yyyy')}
                    </td>
                    <td className="py-2 text-center">{t.broker}</td>
                    <td className="py-2 text-center font-mono font-medium">
                      {t.ticker}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          t.action === 'buy'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {t.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 text-center">{t.shares}</td>
                    <td className="py-2 text-center">
                      {formatCurrency(t.price)}
                    </td>
                    <td className="py-2 text-center">
                      {t.fees > 0 ? formatCurrency(t.fees) : '-'}
                    </td>
                    <td className="py-2 text-center font-semibold">
                      {formatCurrency(total)}
                    </td>
                    <td className="py-2 text-center">
                      <ActionButtons trade={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {trades.length > 0 && (
          <div className="flex-between mt-4 text-sm">
            <span className="text-muted-foreground text-xs">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, trades.length)} of{' '}
              {trades.length} trade{trades.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
              >
                <SelectTrigger className="h-8 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
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
                      if (!isNaN(n)) setPage(Math.max(0, Math.min(n - 1, totalPages - 1)));
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.currentTarget.value, 10);
                    if (!isNaN(n)) setPage(Math.max(0, Math.min(n - 1, totalPages - 1)));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="h-8 w-12 rounded-md border text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
