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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGD } from '@/lib/utils/currency';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants';
import { useSnapshotEditor } from '../hooks/use-snapshot-editor';
import type { AssetCategory } from '../types';

interface SnapshotFormProps {
  editId?: string;
}

export function SnapshotForm({ editId }: SnapshotFormProps) {
  const { hidden, mask, canReveal, getHideEpoch } = useAmountVisibility();
  const router = useRouter();
  const editor = useSnapshotEditor(editId);
  const {
    form,
    history,
    isSaving,
    fields,
    append,
    remove,
    selectedMonth,
    currentEntries,
  } = editor;
  const isDuplicate = !!history.data?.some(
    (record) => record.id === selectedMonth && record.id !== editId
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const hideEpoch = getHideEpoch();
    await form.handleSubmit(async function submitVisibleSnapshot(values) {
      if (canReveal() && getHideEpoch() === hideEpoch)
        await editor.submit(values);
    })(event);
  }

  function addRow(category: AssetCategory) {
    if (!canReveal()) return;
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

  if (editor.loading) {
    return (
      <div className="flex-center py-12">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (editor.loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load your snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={editor.retryLoads}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                disabled={hidden || isSaving || editor.isReviewing}
                className="relative w-44 cursor-pointer pr-4 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                {...form.register('id')}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
          {editor.backgroundError && (
            <p role="status" className="text-warning text-sm">
              Latest data could not be refreshed. Your draft is preserved.
            </p>
          )}
          {editor.issue && (
            <div
              role="alert"
              className="border-warning space-y-2 rounded-lg border p-3 text-sm"
            >
              <p>
                {editor.issue.kind === 'conflict'
                  ? 'This snapshot changed or already exists. Your draft is preserved.'
                  : editor.issue.kind === 'missing'
                    ? 'This snapshot no longer exists. Your draft is preserved; cancel to start a new snapshot.'
                    : editor.issue.kind === 'read-failed'
                      ? 'Could not check the latest snapshot. Your draft is preserved.'
                      : 'The save may have completed. Your draft is preserved; check the latest snapshot before saving again.'}
              </p>
              <p className="text-muted-foreground">
                If a saved snapshot exists, checking loads its values and
                discards this draft. Otherwise, a new draft stays ready to save.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={hidden || editor.isReviewing}
                onClick={() => {
                  if (canReveal()) void editor.reviewLatest();
                }}
              >
                {editor.isReviewing ? 'Checking…' : 'Check latest and reload'}
              </Button>
            </div>
          )}
          <fieldset
            disabled={hidden || isSaving || editor.isReviewing}
            className="space-y-6"
          >
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
                          ({mask(formatSGD(catTotal))})
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
                            aria-label={`${CATEGORY_LABELS[cat]} account ${idx + 1}`}
                            {...form.register(`entries.${idx}.account`)}
                            value={
                              hidden ? '' : (currentEntries[idx]?.account ?? '')
                            }
                            onChange={(event) => {
                              if (canReveal())
                                void form
                                  .register(`entries.${idx}.account`)
                                  .onChange(event);
                            }}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            aria-label={`${CATEGORY_LABELS[cat]} amount ${idx + 1}`}
                            {...form.register(`entries.${idx}.amount`, {
                              setValueAs: (v: string) =>
                                v === '' ? 0 : parseFloat(v),
                            })}
                            value={
                              hidden ? '' : currentEntries[idx]?.amount || ''
                            }
                            onChange={(event) => {
                              if (canReveal())
                                void form
                                  .register(`entries.${idx}.amount`)
                                  .onChange(event);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (canReveal()) remove(idx);
                            }}
                            aria-label={`Remove ${CATEGORY_LABELS[cat]} account ${idx + 1}`}
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
                              {
                                form.formState.errors.entries[idx].amount
                                  ?.message
                              }
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
              <Button
                type="submit"
                disabled={hidden || isSaving || isDuplicate || !!editor.issue}
              >
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
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
          </fieldset>
        </CardContent>
      </Card>
    </form>
  );
}
