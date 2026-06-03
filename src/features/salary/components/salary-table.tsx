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
import { formatSGD } from '@/lib/utils/currency';
import { Loader2, Pencil, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteSalary, useSalaryRecords } from '../hooks/use-salary';

interface SalaryTableProps {
  onEdit?: (id: string) => void;
}

function SalaryActionButtons({
  id,
  onEdit,
}: {
  id: string;
  onEdit?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteSalary();

  return (
    <div className="flex justify-center gap-1">
      <Button variant="outline" size="sm" onClick={() => onEdit?.(id)}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 text-red-500" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Salary Record"
        description={
          <>
            Are you sure you want to delete the record for{' '}
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

export function SalaryTable({ onEdit }: SalaryTableProps) {
  const { data: records, isLoading } = useSalaryRecords();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  const reversed = [...(records ?? [])].reverse();
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
          <EmptyState
            icon={Wallet}
            title="No salary records yet"
            description="Add your first record to track salary, tax, and CPF."
            className="border-0 py-8"
          />
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
                        {formatSGD(r.salary)}
                      </td>
                      <td className="py-2 text-center">
                        {r.bonus > 0 ? formatSGD(r.bonus) : '-'}
                      </td>
                      <td className="py-2 text-center font-semibold">
                        {formatSGD(r.salary + r.bonus)}
                      </td>
                      <td className="py-2 text-center">
                        <SalaryActionButtons id={r.id} onEdit={onEdit} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reversed.length > 0 && (
              <PaginationControls
                page={page}
                pageSize={pageSize}
                total={reversed.length}
                itemLabel="record"
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
