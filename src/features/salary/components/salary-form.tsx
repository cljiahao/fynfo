'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSalaryRecord, useUpsertSalary } from '../hooks/use-salary';

interface SalaryFormValues {
  id: string;
  salary: number;
  bonus: number;
}

interface SalaryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string;
}

export function SalaryFormDialog({
  open,
  onOpenChange,
  editId,
}: SalaryFormDialogProps) {
  const fieldId = useId();
  const {
    data: existing,
    isLoading: loadingExisting,
    isError,
    refetch,
  } = useSalaryRecord(editId ?? '');
  const upsert = useUpsertSalary();

  const defaultMonth = format(new Date(), 'yyyy-MM');

  const form = useForm<SalaryFormValues>({
    defaultValues: {
      id: editId ?? defaultMonth,
      salary: '' as unknown as number,
      bonus: '' as unknown as number,
    },
  });

  useEffect(() => {
    if (existing && editId) {
      form.reset({
        id: existing.id,
        salary: existing.salary,
        bonus: existing.bonus,
      });
    }
  }, [existing, editId, form]);

  useEffect(() => {
    if (open && !editId) {
      form.reset({
        id: defaultMonth,
        salary: '' as unknown as number,
        bonus: '' as unknown as number,
      });
    }
  }, [open, editId, form, defaultMonth]);

  async function onSubmit(values: SalaryFormValues) {
    try {
      await upsert.mutateAsync({
        id: values.id,
        salary: Number(values.salary) || 0,
        bonus: Number(values.bonus) || 0,
      });
      toast.success(`Salary for ${values.id} saved`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to save salary');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editId ? 'Edit' : 'New'} Salary Record</DialogTitle>
          <DialogDescription>
            Record your monthly salary and bonus
          </DialogDescription>
        </DialogHeader>

        {editId && loadingExisting ? (
          <div className="flex-center py-8">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : editId && (isError || !existing) ? (
          <div className="space-y-3">
            <p>Couldn&apos;t load your salary record</p>
            <Button
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={fieldId + '-month'}>Month</Label>
              <Input
                id={fieldId + '-month'}
                type="month"
                className="relative cursor-pointer pr-4 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                {...form.register('id')}
                disabled={!!editId}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={fieldId + '-salary'}>Gross Salary</Label>
                <Input
                  id={fieldId + '-salary'}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register('salary', {
                    setValueAs: (v: string) => (v === '' ? 0 : parseFloat(v)),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={fieldId + '-bonus'}>Bonus</Label>
                <Input
                  id={fieldId + '-bonus'}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register('bonus', {
                    setValueAs: (v: string) => (v === '' ? 0 : parseFloat(v)),
                  })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {editId ? 'Update' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
