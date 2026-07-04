'use client';

import { Button } from '@/components/ui/button';
import {
  ConfirmDeleteDialog,
  EmptyState,
  PaginationControls,
} from '@/components/widgets';
import { formatCurrency } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { Coins, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteDividend } from '../hooks/use-dividends';
import type { DividendData } from '../types';

interface DividendTableProps {
  dividends: DividendData[];
  onEdit?: (dividend: DividendData) => void;
}

function RowActions({
  dividend,
  onEdit,
}: {
  dividend: DividendData;
  onEdit?: (dividend: DividendData) => void;
}) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteDividend();

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onEdit?.(dividend)}
        aria-label="Edit distribution"
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Delete distribution"
      >
        <Trash2 className="text-destructive size-4" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Distribution"
        description={
          <>
            Delete the {formatCurrency(dividend.amount, dividend.currency)}{' '}
            <span className="font-semibold">{dividend.ticker}</span>{' '}
            distribution? This cannot be undone.
          </>
        }
        isPending={deleteMutation.isPending}
        onConfirm={async () => {
          if (!dividend.id) return;
          await deleteMutation.mutateAsync(dividend.id);
          toast.success('Distribution deleted');
        }}
      />
    </div>
  );
}

export function DividendTable({ dividends, onEdit }: DividendTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const paged = dividends.slice(page * pageSize, (page + 1) * pageSize);

  if (!dividends.length) {
    return (
      <EmptyState
        icon={Coins}
        title="No distributions recorded yet"
        description="Add a distribution to start tracking your passive income."
        className="border-0"
      />
    );
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-left font-medium">Date</th>
            <th className="py-2 text-left font-medium">Ticker</th>
            <th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((d) => (
            <tr key={d.id} className="border-b last:border-0">
              <td className="py-2">
                {format(new Date(d.date), 'dd MMM yyyy')}
              </td>
              <td className="py-2 font-medium">{d.ticker}</td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(d.amount, d.currency)}
              </td>
              <td className="py-2">
                <RowActions dividend={d} onEdit={onEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={dividends.length}
        itemLabel="distribution"
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
