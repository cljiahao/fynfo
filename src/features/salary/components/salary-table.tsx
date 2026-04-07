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
import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteSalary, useSalaryRecords } from '../hooks/use-salary';

interface SalaryTableProps {
  onEdit?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function SalaryTable({ onEdit }: SalaryTableProps) {
  const { data: records, isLoading } = useSalaryRecords();
  const deleteMutation = useDeleteSalary();

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
          onClick={() => onEdit?.(id)}
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
              <DialogTitle>Delete Salary Record</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the record for{' '}
                <span className="font-semibold">{id}</span>? This action
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

  const PAGE_SIZES = [10, 25, 50] as const;
  const reversed = [...(records ?? [])].reverse();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const totalPages = Math.max(Math.ceil(reversed.length / pageSize), 1);
  const paged = reversed.slice(page * pageSize, (page + 1) * pageSize);

  if (isLoading) {
    return (
      <div className="flex-center py-12">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary History</CardTitle>
        <CardDescription>All monthly salary records</CardDescription>
      </CardHeader>
      <CardContent>
        {reversed.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No salary records yet. Add your first one.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Month</th>
                    <th className="py-2 text-center font-medium">
                      Gross Salary
                    </th>
                    <th className="py-2 text-center font-medium">Bonus</th>
                    <th className="py-2 text-center font-medium">Total</th>
                    <th className="py-2 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{r.id}</td>
                      <td className="py-2 text-center">
                        {formatCurrency(r.salary)}
                      </td>
                      <td className="py-2 text-center">
                        {r.bonus > 0 ? formatCurrency(r.bonus) : '-'}
                      </td>
                      <td className="py-2 text-center font-semibold">
                        {formatCurrency(r.salary + r.bonus)}
                      </td>
                      <td className="py-2 text-center">
                        <ActionButtons id={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reversed.length > 0 && (
              <div className="flex-between mt-4 text-sm">
                <span className="text-muted-foreground text-xs">
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, reversed.length)} of{' '}
                  {reversed.length} record{reversed.length !== 1 ? 's' : ''}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
