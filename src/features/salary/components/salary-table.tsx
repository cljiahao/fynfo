'use client';

import { useAmountVisibility } from '@/features/privacy';

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
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { useDeleteSalary, useSalaryRecords } from '../hooks/use-salary';
import { recurringByEmployer } from '../lib/income-aggregates';
import type { IncomeLineType, SalaryData } from '../types';

interface SalaryTableProps {
  onEdit?: (id: string) => void;
}

const TYPE_LABELS: Record<IncomeLineType, string> = {
  salary: 'Salary',
  bonus: 'Bonus',
  one_time: 'One-time',
};

/**
 * Months whose salary lines differ from the previous recorded month's, by
 * employer (normalized label) or amount. Months without salary lines are
 * skipped so a bonus-only month is not read as a pay change.
 */
export function salaryChangedMonths(
  records: readonly SalaryData[]
): Set<string> {
  const changed = new Set<string>();
  for (let i = 1; i < records.length; i += 1) {
    const current = recurringByEmployer(records[i].lines);
    if (current.size === 0) continue;
    const previous = recurringByEmployer(records[i - 1].lines);
    const same =
      current.size === previous.size &&
      [...current].every(
        ([employer, amount]) => previous.get(employer) === amount
      );
    if (!same) changed.add(records[i].id);
  }
  return changed;
}

function SalaryActionButtons({
  id,
  onEdit,
}: {
  id: string;
  onEdit?: (id: string) => void;
}) {
  const { hidden, canReveal } = useAmountVisibility();
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteSalary();

  return (
    <div className="flex justify-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={hidden}
        onClick={() => {
          if (canReveal()) onEdit?.(id);
        }}
        aria-label="Edit salary record"
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={hidden}
        onClick={() => {
          if (canReveal()) setOpen(true);
        }}
        aria-label="Delete salary record"
      >
        <Trash2 className="text-destructive size-4" />
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
          if (!canReveal()) {
            toast.info('Show amounts before deleting salary records');
            return;
          }
          await deleteMutation.mutateAsync(id);
          toast.success(`Deleted ${id}`);
        }}
      />
    </div>
  );
}

export function SalaryTable({ onEdit }: SalaryTableProps) {
  const { hidden, mask } = useAmountVisibility();
  const { data: records } = useSalaryRecords();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const changed = salaryChangedMonths(records ?? []);
  const reversed = [...(records ?? [])].reverse();
  const paged = reversed.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary History</CardTitle>
        <CardDescription>All monthly income records</CardDescription>
      </CardHeader>
      <CardContent>
        {hidden && (
          <p className="text-muted-foreground mb-3 text-sm">
            Show amounts before editing or deleting salary records.
          </p>
        )}
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
                    <th className="py-2 text-center font-medium">Recurring</th>
                    <th className="py-2 text-center font-medium">Bonus</th>
                    <th className="py-2 text-center font-medium">One-time</th>
                    <th className="py-2 text-center font-medium">Total</th>
                    <th className="py-2 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => {
                    const isOpen = expanded.has(r.id);
                    return (
                      <Fragment key={r.id}>
                        <tr className="border-b last:border-0">
                          <td className="py-2 font-medium">
                            <button
                              type="button"
                              className="flex items-center gap-1"
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'Hide' : 'Show'} income lines for ${r.id}`}
                              onClick={() =>
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (!next.delete(r.id)) next.add(r.id);
                                  return next;
                                })
                              }
                            >
                              {isOpen ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                              {r.id}
                            </button>
                            {changed.has(r.id) && (
                              <span
                                className="bg-muted text-muted-foreground ml-1 rounded px-1.5 py-0.5 text-xs font-medium"
                                title="Salary amount or employer differs from the previous month"
                              >
                                Salary changed
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-center tabular-nums">
                            {mask(formatSGD(r.recurring))}
                          </td>
                          <td className="py-2 text-center tabular-nums">
                            {mask(r.bonus > 0 ? formatSGD(r.bonus) : '-')}
                          </td>
                          <td className="py-2 text-center tabular-nums">
                            {mask(r.oneTime > 0 ? formatSGD(r.oneTime) : '-')}
                          </td>
                          <td className="py-2 text-center font-semibold tabular-nums">
                            {mask(formatSGD(r.total))}
                          </td>
                          <td className="py-2 text-center">
                            <SalaryActionButtons id={r.id} onEdit={onEdit} />
                          </td>
                        </tr>
                        {isOpen &&
                          r.lines.map((line) => (
                            <tr
                              key={line.id}
                              className="text-muted-foreground border-b text-xs last:border-0"
                            >
                              <td className="py-1 pl-6">
                                {TYPE_LABELS[line.type]}
                              </td>
                              <td className="py-1 text-center" colSpan={3}>
                                {mask(line.label)}
                              </td>
                              <td className="py-1 text-center tabular-nums">
                                {mask(formatSGD(line.amount))}
                              </td>
                              <td />
                            </tr>
                          ))}
                      </Fragment>
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
