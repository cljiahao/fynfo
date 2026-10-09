'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGD } from '@/lib/utils/currency';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants';
import {
  useSnapshot,
  useSnapshots,
  useUpsertSnapshot,
} from '../hooks/use-snapshots';
import { snapshotFormSchema, type SnapshotFormValues } from '../schemas';
import type { AssetCategory } from '../types';

interface SnapshotFormProps {
  editId?: string;
}

export function SnapshotForm({ editId }: SnapshotFormProps) {
  const router = useRouter();
  const {
    data: existing,
    isLoading: loadingExisting,
    isError: existingError,
    refetch: retryExisting,
  } = useSnapshot(editId ?? '');
  const {
    data: allSnapshots,
    isLoading: snapshotsLoading,
    isError: snapshotsError,
    refetch: retrySnapshots,
  } = useSnapshots();
  const upsert = useUpsertSnapshot();

  const defaultMonth = format(new Date(), 'yyyy-MM');
  const emptyAmount = '' as unknown as number;
  const initializedFor = useRef<string | null>(null);

  const form = useForm<SnapshotFormValues>({
    resolver: zodResolver(snapshotFormSchema),
    defaultValues: {
      id: editId ?? defaultMonth,
      entries: CATEGORIES.map((cat) => ({
        category: cat,
        account: '',
        amount: emptyAmount,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries',
  });

  const selectedMonth = useWatch({ control: form.control, name: 'id' });
  const currentEntries = useWatch({ control: form.control, name: 'entries' });
  const isDirty = form.formState.isDirty;
  const isDuplicate = !!allSnapshots?.some(
    (s) => s.id === selectedMonth && s.id !== editId
  );

  // Refresh untouched editors; preserve dirty values until explicit navigation.
  useEffect(() => {
    if (
      editId ||
      !allSnapshots ||
      (initializedFor.current === 'new' && isDirty)
    )
      return;
    const latest = allSnapshots[allSnapshots.length - 1];
    const entries = (latest?.entries ?? []).map((e) => ({
      category: e.category,
      account: e.account,
      amount: emptyAmount,
    }));
    for (const cat of CATEGORIES) {
      if (!entries.some((e) => e.category === cat)) {
        entries.push({ category: cat, account: '', amount: emptyAmount });
      }
    }
    initializedFor.current = 'new';
    form.reset({ id: defaultMonth, entries });
  }, [allSnapshots, editId, form, defaultMonth, emptyAmount, isDirty]);

  useEffect(() => {
    if (editId && existing && (initializedFor.current !== editId || !isDirty)) {
      const existingEntries = existing.entries.map((e) => ({
        category: e.category,
        account: e.account,
        amount: e.amount,
      }));
      for (const cat of CATEGORIES) {
        if (!existingEntries.some((e) => e.category === cat)) {
          existingEntries.push({
            category: cat,
            account: '',
            amount: emptyAmount,
          });
        }
      }
      initializedFor.current = editId;
      form.reset({
        id: existing.id,
        entries: existingEntries,
      });
    }
  }, [existing, editId, form, emptyAmount, isDirty]);

  function addRow(category: AssetCategory) {
    append({ category, account: '', amount: '' as unknown as number });
  }

  function getRowsForCategory(category: AssetCategory) {
    return fields
      .map((field, idx) => ({ field, idx }))
      .filter(({ idx }) => currentEntries[idx]?.category === category);
  }

  function getCategoryTotal(category: AssetCategory) {
    return getRowsForCategory(category).reduce((sum, { idx }) => {
      const val = currentEntries[idx]?.amount;
      return sum + (Number(val) || 0);
    }, 0);
  }

  async function onSubmit(values: SnapshotFormValues) {
    if (
      allSnapshots?.some(
        (snapshot) => snapshot.id === values.id && snapshot.id !== editId
      )
    ) {
      toast.error('A snapshot for this month already exists.');
      return;
    }
    try {
      const filledEntries = values.entries
        .filter((e) => e.amount > 0 || e.account.trim() !== '')
        .map((e) => ({
          ...e,
          account: e.account.trim() || e.category,
          category: e.category as AssetCategory,
        }));
      await upsert.mutateAsync({
        data: {
          id: values.id,
          entries: filledEntries,
        },
        originalId: editId,
      });
      toast.success(`Snapshot ${values.id} saved`);
      router.push(PAGE_ROUTES.ASSETS);
    } catch {
      toast.error('Failed to save snapshot');
    }
  }

  if ((editId && loadingExisting) || snapshotsLoading) {
    return (
      <div className="flex-center py-12">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (snapshotsError || (editId && (existingError || !existing))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load your snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              void retrySnapshots();
              if (editId) void retryExisting();
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{editId ? 'Edit' : 'New'} Monthly Snapshot</CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Label
                htmlFor="month"
                className="text-muted-foreground text-sm whitespace-nowrap"
              >
                Select Month
              </Label>
              <Input
                id="month"
                type="month"
                className="relative w-44 cursor-pointer pr-4 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                {...form.register('id')}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <CardDescription>
              Enter your asset values for each account.
            </CardDescription>
            {form.formState.errors.id && (
              <p className="text-destructive text-sm">
                {form.formState.errors.id.message}
              </p>
            )}
            {!form.formState.errors.id && isDuplicate && (
              <p className="text-destructive text-sm">
                A snapshot for this month already exists.
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {CATEGORIES.map((cat) => {
            const rows = getRowsForCategory(cat);
            const catTotal = getCategoryTotal(cat);

            return (
              <div key={cat} className="space-y-3 rounded-lg border p-4">
                <div className="flex-between">
                  <Label className="flex items-center gap-2 text-base font-semibold">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    {CATEGORY_LABELS[cat]}
                    {rows.length > 0 && (
                      <span className="text-muted-foreground text-sm font-normal">
                        ({formatSGD(catTotal)})
                      </span>
                    )}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRow(cat)}
                  >
                    <Plus className="mr-1 size-3" />
                    Add Row
                  </Button>
                </div>

                {rows.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-muted-foreground grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium">
                      <span>Account</span>
                      <span>Amount</span>
                      <span className="w-9" />
                    </div>
                    {rows.map(({ field, idx }) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                      >
                        <Input
                          placeholder="Account name"
                          {...form.register(`entries.${idx}.account`)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...form.register(`entries.${idx}.amount`, {
                            setValueAs: (v: string) =>
                              v === '' ? 0 : parseFloat(v),
                          })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(idx)}
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                        {form.formState.errors.entries?.[idx]?.account && (
                          <p className="text-destructive col-span-3 text-sm">
                            {
                              form.formState.errors.entries[idx].account
                                ?.message
                            }
                          </p>
                        )}
                        {form.formState.errors.entries?.[idx]?.amount && (
                          <p className="text-destructive col-span-3 text-sm">
                            {form.formState.errors.entries[idx].amount?.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {rows.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    No accounts added. Click &quot;Add Row&quot; to add one.
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex gap-3">
            <Button type="submit" disabled={upsert.isPending || isDuplicate}>
              {upsert.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {editId ? 'Update' : 'Save'} Snapshot
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(PAGE_ROUTES.ASSETS)}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
