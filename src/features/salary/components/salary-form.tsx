'use client';

import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns/format';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, type FormEvent } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useSalaryRecord,
  useSalaryRecords,
  useUpsertSalary,
} from '../hooks/use-salary';
import {
  MAX_INCOME_LABEL,
  MAX_INCOME_LINES,
  salaryMonthSchema,
} from '../schemas';
import type { IncomeLine, IncomeLineType } from '../types';

interface LineValues {
  type: IncomeLineType;
  label: string;
  amount: number | string;
}

interface SalaryFormValues {
  id: string;
  lines: LineValues[];
}

interface SalaryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string;
}

const TYPE_OPTIONS: { value: IncomeLineType; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'one_time', label: 'One-time' },
];

const DEFAULT_LABEL: Record<IncomeLineType, string> = {
  salary: 'Salary',
  bonus: 'Bonus',
  one_time: 'One-time',
};

function blankLine(type: IncomeLineType = 'salary'): LineValues {
  return { type, label: DEFAULT_LABEL[type], amount: '' };
}

function toLineValues(lines: readonly IncomeLine[]): LineValues[] {
  return lines.map(({ type, label, amount }) => ({ type, label, amount }));
}

export function SalaryFormDialog({
  open,
  onOpenChange,
  editId,
}: SalaryFormDialogProps) {
  const { hidden, canReveal, getHideEpoch } = useAmountVisibility();
  const fieldId = useId();
  const {
    data: existing,
    isLoading: loadingExisting,
    isError,
    refetch,
  } = useSalaryRecord(editId ?? '');
  const records = useSalaryRecords();
  const upsert = useUpsertSalary();

  // Records are ordered by month, so the last one is the latest. A raise then
  // means editing one prefilled amount instead of retyping every line.
  const prefillKey = useMemo(
    () =>
      JSON.stringify(
        toLineValues(
          records.data
            ?.at(-1)
            ?.lines.filter((line) => line.type === 'salary') ?? []
        )
      ),
    [records.data]
  );

  const defaultMonth = format(new Date(), 'yyyy-MM');

  const form = useForm<SalaryFormValues>({
    defaultValues: {
      id: editId ?? defaultMonth,
      lines: [blankLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
    keyName: 'key',
  });

  useEffect(() => {
    if (existing && editId) {
      form.reset({ id: existing.id, lines: toLineValues(existing.lines) });
    }
  }, [existing, editId, form]);

  useEffect(() => {
    if (!open && !editId) {
      form.reset({ id: defaultMonth, lines: [blankLine()] });
    }
  }, [open, editId, form, defaultMonth]);

  // Never overwrite lines the user has already started editing.
  useEffect(() => {
    if (!open || editId) return;
    if (form.getFieldState('lines', form.formState).isDirty) return;
    const prefill = JSON.parse(prefillKey) as LineValues[];
    form.reset({
      id: form.getValues('id'),
      lines: prefill.length > 0 ? prefill : [blankLine()],
    });
  }, [open, editId, form, prefillKey]);

  const selectedMonth = useWatch({ control: form.control, name: 'id' });
  const replacesExisting =
    !editId && !!records.data?.some((record) => record.id === selectedMonth);

  async function onSubmit(values: SalaryFormValues) {
    if (!canReveal()) {
      toast.info('Show amounts before saving salary');
      return;
    }
    const lines = values.lines
      .filter((line) => String(line.amount).trim() !== '')
      .map((line, index) => ({
        id: `${line.type}-${index}`,
        type: line.type,
        label: line.label.trim(),
        amount: Number(line.amount),
      }));
    const parsed = salaryMonthSchema.safeParse({ id: values.id, lines });
    if (!parsed.success) {
      toast.error(
        lines.length === 0
          ? 'Add at least one income line'
          : (parsed.error.issues[0]?.message ?? 'Check the income lines')
      );
      return;
    }
    try {
      await upsert.mutateAsync(parsed.data);
      toast.success(`Salary for ${values.id} saved`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to save salary');
    }
  }

  async function submitSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) {
      toast.info('Show amounts before saving salary');
      return;
    }
    const hideEpoch = getHideEpoch();
    await form.handleSubmit(async function submitVisibleSalary(values) {
      if (canReveal() && getHideEpoch() === hideEpoch) await onSubmit(values);
    })(event);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editId ? 'Edit' : 'New'} Salary Record</DialogTitle>
          <DialogDescription>
            Record your monthly salary, bonus and one-time income
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
          <form onSubmit={submitSalary} className="space-y-4">
            <AmountsHiddenNotice />
            <div className="space-y-2">
              <Label htmlFor={fieldId + '-month'}>Month</Label>
              <Input
                id={fieldId + '-month'}
                type="month"
                className="relative cursor-pointer pr-4 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                {...form.register('id')}
                disabled={hidden || !!editId}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              />
              {replacesExisting && (
                <p role="status" className="text-warning text-sm">
                  {selectedMonth} already has a record. Saving replaces it.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex-between">
                <Label>Income lines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={hidden || fields.length >= MAX_INCOME_LINES}
                  onClick={() => append(blankLine('bonus'))}
                >
                  <Plus className="mr-1 size-4" />
                  Add line
                </Button>
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.key}
                  className="grid grid-cols-[7.5rem_1fr_7rem_auto] items-center gap-2"
                >
                  <Controller
                    name={`lines.${index}.type`}
                    control={form.control}
                    render={({ field: typeField }) => (
                      <Select
                        disabled={hidden}
                        value={typeField.value}
                        onValueChange={(value) => {
                          if (!canReveal()) return;
                          const next = value as IncomeLineType;
                          const label = form.getValues(`lines.${index}.label`);
                          typeField.onChange(next);
                          if (
                            label === '' ||
                            label === DEFAULT_LABEL[typeField.value]
                          )
                            form.setValue(
                              `lines.${index}.label`,
                              DEFAULT_LABEL[next],
                              { shouldDirty: true }
                            );
                        }}
                      >
                        <SelectTrigger aria-label={`Line ${index + 1} type`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Controller
                    name={`lines.${index}.label`}
                    control={form.control}
                    render={({ field: labelField }) => (
                      <Input
                        {...labelField}
                        aria-label={`Line ${index + 1} label`}
                        maxLength={MAX_INCOME_LABEL}
                        placeholder={hidden ? 'Hidden' : 'Employer or source'}
                        disabled={hidden}
                        value={hidden ? '' : labelField.value}
                        onChange={(event) => {
                          if (canReveal())
                            labelField.onChange(event.target.value);
                        }}
                      />
                    )}
                  />
                  <Controller
                    name={`lines.${index}.amount`}
                    control={form.control}
                    render={({ field: amountField }) => (
                      <Input
                        {...amountField}
                        aria-label={`Line ${index + 1} amount`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={hidden ? 'Hidden' : '0.00'}
                        disabled={hidden}
                        value={hidden ? '' : amountField.value}
                        onChange={(event) => {
                          if (canReveal())
                            amountField.onChange(event.target.value);
                        }}
                      />
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove line ${index + 1}`}
                    disabled={hidden || fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={hidden || upsert.isPending}>
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
