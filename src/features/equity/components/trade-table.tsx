'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDeleteDialog, PaginationControls } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteTrade } from '../hooks/use-equity';
import type { EquityTradeData } from '../types';

interface TradeTableProps {
  trades: EquityTradeData[];
  onEdit?: (trade: EquityTradeData) => void;
}

function TradeActionButtons({
  trade,
  onEdit,
}: {
  trade: EquityTradeData;
  onEdit?: (trade: EquityTradeData) => void;
}) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteTrade();

  return (
    <div className="flex justify-center gap-1">
      <Button variant="outline" size="sm" onClick={() => onEdit?.(trade)}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 text-red-500" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Trade"
        description={
          <>
            Delete {trade.action.toUpperCase()} {trade.shares}{' '}
            <span className="font-semibold">{trade.ticker}</span>? This cannot
            be undone.
          </>
        }
        isPending={deleteMutation.isPending}
        onConfirm={async () => {
          if (!trade.id) return;
          await deleteMutation.mutateAsync(trade.id);
          toast.success('Trade deleted');
        }}
      />
    </div>
  );
}

export function TradeTable({ trades, onEdit }: TradeTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const paged = trades.slice(page * pageSize, (page + 1) * pageSize);

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
                    <td className="py-2 text-center">{formatSGD(t.price)}</td>
                    <td className="py-2 text-center">
                      {t.fees > 0 ? formatSGD(t.fees) : '-'}
                    </td>
                    <td className="py-2 text-center font-semibold">
                      {formatSGD(total)}
                    </td>
                    <td className="py-2 text-center">
                      <TradeActionButtons trade={t} onEdit={onEdit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {trades.length > 0 && (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={trades.length}
            itemLabel="trade"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </CardContent>
    </Card>
  );
}
