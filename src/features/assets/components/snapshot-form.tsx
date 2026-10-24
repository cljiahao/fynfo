'use client';

import { ColorSwatch } from '@/components/widgets';
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
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants';
import { useSnapshotEditor } from '../hooks/use-snapshot-editor';
import type { AssetCategory } from '../types';

interface SnapshotFormProps {
  editId?: string;
}

export function SnapshotForm({ editId }: SnapshotFormProps) {
  const { hidden, mask, canReveal, getHideEpoch } = useAmountVisibility();
  const router = useRouter();
  const categoryId = useId();
  const [selectedCategory, setSelectedCategory] =
    useState<AssetCategory>('savings');
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
  const errorFocus = useRef<
    `entries.${number}.account` | `entries.${number}.amount` | null
  >(null);
  useEffect(() => {
    const field = errorFocus.current;
    errorFocus.current = null;
    if (field && canReveal()) form.setFocus(field);
  }, [selectedCategory, form, canReveal]);
  const isDuplicate = !!history.data?.some(
    (record) => record.id === selectedMonth && record.id !== editId
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const hideEpoch = getHideEpoch();
    // Native submit validation cannot focus inputs in a hidden category. Check
    // the same browser constraints here, then reveal the first invalid field.
    const invalidInput = Array.from(event.currentTarget.elements).find(
      (input): input is HTMLInputElement =>
        input instanceof HTMLInputElement && !input.validity.valid
    );
    if (invalidInput) {
      const match = /^entries\.(\d+)\.amount$/.exec(invalidInput.name);
      if (match) {
        const index = Number(match[1]);
        const field = `entries.${index}.amount` as const;
        form.setError(field, {
          type: 'native',
          message: invalidInput.validity.badInput
            ? 'Enter a valid amount'
            : invalidInput.validity.stepMismatch
              ? 'Use no more than two decimal places'
              : invalidInput.validity.rangeUnderflow
                ? 'Amount must be positive'
                : 'Check this amount',
        });
        const category = currentEntries[index]?.category;
        if (category && category !== selectedCategory) {
          errorFocus.current = field;
          setSelectedCategory(category);
        } else form.setFocus(field);
      } else {
        form.setError('id', {
          type: 'native',
          message: 'Choose a valid month',
        });
        invalidInput.focus();
      }
      return;
    }
    await form.handleSubmit(
      async function submitVisibleSnapshot(values) {
        if (canReveal() && getHideEpoch() === hideEpoch)
          await editor.submit(values);
      },
      (errors) => {
        const invalidIndex = currentEntries.findIndex(
          (_, index) => errors.entries?.[index]
        );
        if (invalidIndex >= 0 && canReveal()) {
          errorFocus.current = errors.entries?.[invalidIndex]?.account
            ? `entries.${invalidIndex}.account`
            : `entries.${invalidIndex}.amount`;
          setSelectedCategory(currentEntries[invalidIndex].category);
        }
      }
    )(event);
  }

  function addRow(category: AssetCategory) {
    if (!canReveal()) return;
    append({ category, account: '', amount: '' as unknown as number });
  }

  function amountPlaceholder(category: AssetCategory, account: string) {
    const amount = editor.previousAmount(category, account);
    return amount === undefined ? '0.00' : `Last: ${mask(formatSGD(amount))}`;
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
    <form noValidate onSubmit={handleSubmit}>
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
              Choose a category and enter your account balances. Save includes
              every category.
            </CardDescription>
            {form.formState.errors.id && (
              <p className="text-destructive text-sm">
                {form.formState.errors.id.message}
              </p>
            )}
            {!form.formState.errors.id && isDuplicate && (
              <p className="text-destructive text-sm">
                A snapshot for this month already exists.{' '}
                <Link
                  href={`${PAGE_ROUTES.ENTRY}?edit=${encodeURIComponent(selectedMonth)}`}
                  className="underline underline-offset-4"
                >
                  Edit {selectedMonth} instead
                </Link>
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
            {editor.previousMonth && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (canReveal()) editor.copyPrevious();
                  }}
                >
                  <Copy className="mr-1 size-3" />
                  Copy {editor.previousMonth} amounts
                </Button>
                <span className="text-muted-foreground">
                  Fills blank amounts. Edit only what changed.
                </span>
              </div>
            )}
            <div
              role="group"
              aria-label="Asset categories"
              className="flex flex-wrap gap-1 border-b pb-3"
            >
              {CATEGORIES.map((cat) => {
                const hasError = currentEntries.some(
                  (entry, index) =>
                    entry.category === cat &&
                    form.formState.errors.entries?.[index]
                );
                return (
                  <Button
                    key={cat}
                    id={`${categoryId}-${cat}-button`}
                    type="button"
                    variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                    aria-pressed={selectedCategory === cat}
                    aria-controls={`${categoryId}-${cat}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat]}
                    {hasError ? ' · Check fields' : ''}
                  </Button>
                );
              })}
            </div>
            {CATEGORIES.map((cat) => {
              const rows = getRowsForCategory(cat);
              const catTotal = getCategoryTotal(cat);

              return (
                <div
                  key={cat}
                  id={`${categoryId}-${cat}`}
                  role="region"
                  aria-labelledby={`${categoryId}-${cat}-button`}
                  hidden={selectedCategory !== cat}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Label className="flex flex-wrap items-center gap-2 text-base font-semibold">
                      <ColorSwatch
                        color={CATEGORY_COLORS[cat]}
                        className="size-3"
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
                      <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-xs font-medium">
                        <span>Account</span>
                        <span>Amount</span>
                        <span className="w-9" />
                      </div>
                      {rows.map(({ field, idx }) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
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
                            onBlur={(event) => {
                              if (canReveal())
                                void form
                                  .register(`entries.${idx}.account`)
                                  .onBlur(event);
                            }}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={amountPlaceholder(
                              cat,
                              currentEntries[idx]?.account ?? ''
                            )}
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
                            onBlur={(event) => {
                              if (canReveal())
                                void form
                                  .register(`entries.${idx}.amount`)
                                  .onBlur(event);
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
