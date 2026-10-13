'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  EXPENSE_TYPE_LABELS,
  buildImportNote,
  type ExpenseType,
} from '@/features/expenses';
import {
  MerchantRuleManager,
  MerchantSuggestionReview,
  applyMerchantSuggestion,
  restoreMerchantSource,
  useMerchantRulebook,
  type MerchantRule,
  type MerchantSuggestion,
} from '@/features/merchant-rules';
import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';
import { useEffect, useId, useRef, useState } from 'react';
import {
  STATEMENT_BANKS,
  STATEMENT_CLASSIFICATIONS,
  STATEMENT_LIMITS,
  STATEMENT_REVIEW_STATUS_LABELS,
} from '../constants';
import { useStatementSave } from '../hooks/use-statement-save';
import type { LocalStatementPdf } from '../lib/local-pdf';
import {
  getStatementReview,
  parseStatementLines,
  validStatementPeriod,
} from '../lib/statement-parser';
import type { StatementBank, StatementCandidate } from '../types';
import { StatementSaveReview } from './statement-save-review';

function StatementReviewBody({
  discardGuard,
}: {
  discardGuard: React.RefObject<(() => boolean) | null>;
}) {
  const { hidden, mask, canReveal, getHideEpoch } = useAmountVisibility();
  const id = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<LocalStatementPdf | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [bank, setBank] = useState<StatementBank>('uob');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<StatementCandidate[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [view, setView] = useState<'statement' | 'extracted'>('extracted');
  const [selected, setSelected] = useState('');
  const [rowPage, setRowPage] = useState(0);
  const merchant = useMerchantRulebook();
  const [ruleDraft, setRuleDraft] = useState<MerchantRule | null>(null);
  const save = useStatementSave(rows, bank, { from, to });
  function allowDiscard() {
    if (!save.allowDiscard()) return false;
    return (
      (!ruleDraft && !['saving', 'unconfirmed'].includes(merchant.stage)) ||
      window.confirm(
        'Discard this merchant rule review? Unsaved edits will be lost. A dispatched rule save may still complete.'
      )
    );
  }
  useEffect(() => {
    discardGuard.current = allowDiscard;
    return () => {
      discardGuard.current = null;
    };
  });

  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      session.current?.destroy();
    },
    []
  );

  useEffect(
    function cancelHiddenExtraction() {
      if (!hidden) return;
      generation.current++;
      if (busy) {
        controller.current?.abort();
        session.current?.destroy();
        session.current = null;
        setBusy(false);
      }
    },
    [hidden, busy]
  );

  function reset() {
    if (!allowDiscard()) return false;
    setRuleDraft(null);
    save.reset();
    generation.current++;
    controller.current?.abort();
    session.current?.destroy();
    session.current = null;
    setBusy(false);
    setRows([]);
    setError('');
    setPageCount(0);
    setSelected('');
    setRowPage(0);
    if (canvas.current) {
      canvas.current.width = 0;
      canvas.current.height = 0;
    }
    return true;
  }

  useEffect(() => {
    const pdf = session.current;
    const target = canvas.current;
    if (hidden || !canReveal() || !pdf || !target || !pageCount) return;
    const hideEpoch = getHideEpoch();
    let active = true;
    void pdf.render(page, target).catch(() => {
      if (active && canReveal() && getHideEpoch() === hideEpoch)
        setError(
          'This source page could not be rendered. Choose another file or clear the review.'
        );
    });
    return () => {
      active = false;
    };
  }, [page, pageCount, view, hidden, canReveal, getHideEpoch]);

  async function extract() {
    if (!canReveal()) return;
    const hideEpoch = getHideEpoch();
    if (!reset()) return;
    if (
      !file ||
      file.size > STATEMENT_LIMITS.bytes ||
      !validStatementPeriod({ from, to })
    ) {
      setError(
        'Choose a PDF up to 10 MiB and enter its actual statement period (at most 400 days).'
      );
      return;
    }
    const current = generation.current;
    const cancellation = new AbortController();
    controller.current = cancellation;
    setBusy(true);
    let opened: LocalStatementPdf | undefined;
    function isCurrentExtraction() {
      return (
        current === generation.current &&
        canReveal() &&
        getHideEpoch() === hideEpoch
      );
    }
    function discardOpenedPdf() {
      opened?.destroy();
      if (session.current === opened) session.current = null;
    }
    try {
      const bytes = await file.arrayBuffer();
      if (!isCurrentExtraction()) {
        discardOpenedPdf();
        return;
      }
      const { openLocalStatementPdf } = await import('../lib/local-pdf');
      if (!isCurrentExtraction()) return;
      opened = await openLocalStatementPdf(bytes, cancellation.signal);
      if (!isCurrentExtraction()) {
        discardOpenedPdf();
        return;
      }
      session.current = opened;
      const lines = await opened.extract();
      if (!isCurrentExtraction()) {
        discardOpenedPdf();
        return;
      }
      const candidates = parseStatementLines(lines, bank, { from, to });
      setRows(candidates);
      setPage(1);
      setPageCount(opened.pageCount);
      setView('extracted');
      setFile(null);
    } catch {
      discardOpenedPdf();
      if (isCurrentExtraction()) {
        session.current = null;
        setError(
          'This PDF or layout could not be extracted. Check the bank and period. Use an unprotected text PDF; image-only and unsupported layouts need manual entry.'
        );
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  function edit(
    rowId: string,
    field: 'date' | 'description' | 'amount' | 'category',
    value: string
  ) {
    if (!canReveal() || save.locked(rowId) || save.busy) return;
    save.invalidateReview();
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
              manualMerchant: {
                description:
                  row.manualMerchant.description || field === 'description',
                category: row.manualMerchant.category || field === 'category',
              },
            }
          : row
      )
    );
  }
  function applySuggestion(
    rowId: string,
    suggestion: MerchantSuggestion,
    replace: { description: boolean; category: boolean }
  ) {
    if (!canReveal() || save.locked(rowId) || save.busy) return;
    save.invalidateReview();
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const next = applyMerchantSuggestion(
          {
            description: row.description,
            category: row.category as ExpenseType,
            manual: row.manualMerchant,
          },
          suggestion,
          replace
        );
        return {
          ...row,
          description: next.description,
          category: next.category,
          manualMerchant: next.manual,
        };
      })
    );
  }
  function restoreMerchant(rowId: string) {
    if (!canReveal() || save.locked(rowId) || save.busy) return;
    if (
      !window.confirm(
        'Restore the original merchant and Other category? Your current merchant and category edits will be replaced.'
      )
    )
      return;
    save.invalidateReview();
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const next = restoreMerchantSource(
          {
            description: row.description,
            category: row.category as ExpenseType,
            manual: row.manualMerchant,
          },
          { description: row.originalDescription, category: 'other' },
          { description: true, category: true }
        );
        return {
          ...row,
          description: next.description,
          category: next.category,
          manualMerchant: next.manual,
        };
      })
    );
  }
  function classify(rowId: string, value: string) {
    if (!canReveal() || save.locked(rowId) || save.busy) return;
    const classification = STATEMENT_CLASSIFICATIONS.find(
      (entry) => entry.value === value
    )?.value;
    if (!classification) return;
    save.invalidateReview();
    setRows((current) =>
      current.map((row) =>
        row.id === rowId && !row.isSummary ? { ...row, classification } : row
      )
    );
  }
  const reviewedRows = rows.map((row) => ({
    ...row,
    review: getStatementReview(row, { from, to }),
  }));
  const visibleRows = reviewedRows.slice(rowPage * 20, (rowPage + 1) * 20);
  const chosen = rows.find((row) => row.id === selected);
  return (
    <div className="space-y-4">
      <AmountsHiddenNotice />
      <p className="text-muted-foreground text-sm">
        PDF processed on this device. Only explicitly selected expenses and
        their previewed source notes are sent for saving. Text PDFs only, up to
        10 MiB and 100 pages. Password-protected and image-only documents are
        unsupported. Bank layouts vary; only constructed
        date/description/SGD-billed variants have been tested. Review every
        suggestion against its source.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canReveal()) void extract();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`${id}-bank`}>Statement bank</Label>
          <select
            disabled={hidden}
            id={`${id}-bank`}
            value={bank}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            onChange={(event) => {
              if (!canReveal()) return;
              if (!reset()) return;
              setBank(event.target.value as StatementBank);
            }}
          >
            {STATEMENT_BANKS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-from`}>Period start</Label>
          <Input
            disabled={hidden}
            id={`${id}-from`}
            type="date"
            value={hidden ? '' : from}
            required
            onChange={(event) => {
              if (!canReveal()) return;
              if (!reset()) return;
              setFrom(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-to`}>Period end</Label>
          <Input
            disabled={hidden}
            id={`${id}-to`}
            type="date"
            value={hidden ? '' : to}
            required
            onChange={(event) => {
              if (!canReveal()) return;
              if (!reset()) return;
              setTo(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-file`}>Bank statement PDF</Label>
          <Input
            disabled={hidden}
            id={`${id}-file`}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              if (!canReveal()) return;
              if (!reset()) return;
              setFile(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={hidden || busy || !file}>
            {busy ? 'Extracting locally…' : 'Extract for review'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={hidden}
            onClick={() => {
              if (!canReveal()) return;
              if (!reset()) return;
              setFile(null);
            }}
          >
            Clear review
          </Button>
        </div>
      </form>
      <div role="status" aria-live="polite">
        {error && <p className="text-destructive text-sm">{error}</p>}
        {busy && (
          <p className="text-muted-foreground text-sm">
            Reading locally. You can clear this review to cancel.
          </p>
        )}
      </div>
      {rows.length > 0 && (
        <>
          <MerchantRuleManager
            rulebook={merchant}
            draft={ruleDraft}
            onDraft={setRuleDraft}
            examples={rows
              .filter((row) => !row.isSummary)
              .map((row) => ({ description: row.originalDescription, bank }))}
          />
          <p className="text-sm" role="status" aria-live="polite">
            {mask(rows.length)} source rows:{' '}
            {mask(
              reviewedRows.filter((row) => row.review.status === 'candidate')
                .length
            )}{' '}
            expense suggestions,{' '}
            {mask(
              reviewedRows.filter((row) => row.review.status === 'unresolved')
                .length
            )}{' '}
            unresolved,{' '}
            {mask(
              reviewedRows.filter((row) => row.review.status === 'excluded')
                .length
            )}{' '}
            excluded. Edits below are unsaved drafts; source issues remain
            visible.
          </p>
          <p className="text-muted-foreground text-sm">
            Classification is a suggestion. Refunds, transfers, card repayments
            and other credits are excluded from expenses. Unknown rows need
            review. Changing a label does not change the source amount or sign.
          </p>
          <div className="flex gap-2 lg:hidden">
            <Button
              type="button"
              variant={view === 'statement' ? 'default' : 'outline'}
              aria-pressed={view === 'statement'}
              disabled={hidden}
              onClick={() => canReveal() && setView('statement')}
            >
              Statement
            </Button>
            <Button
              type="button"
              variant={view === 'extracted' ? 'default' : 'outline'}
              aria-pressed={view === 'extracted'}
              disabled={hidden}
              onClick={() => canReveal() && setView('extracted')}
            >
              Extracted
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section
              aria-label="Original statement"
              className={`${view === 'statement' ? 'block' : 'hidden'} min-w-0 space-y-3 lg:block`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={hidden || page <= 1}
                  onClick={() => canReveal() && setPage(page - 1)}
                >
                  Previous page
                </Button>
                <span className="text-sm">
                  Page {page} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={hidden || page >= pageCount}
                  onClick={() => canReveal() && setPage(page + 1)}
                >
                  Next page
                </Button>
              </div>
              {!hidden && (
                <canvas
                  ref={canvas}
                  aria-label={`Original statement page ${page}`}
                  className="h-auto w-full rounded-md border"
                />
              )}
              {!hidden && chosen && (
                <p className="text-sm break-words">
                  Source page {chosen.source[0].page}, line{' '}
                  {chosen.source[0].line}:{' '}
                  {chosen.source.map((line) => line.text).join(' ')}
                </p>
              )}
            </section>
            <section
              aria-label="Extracted transaction drafts"
              className={`${view === 'extracted' ? 'block' : 'hidden'} min-w-0 space-y-3 lg:block`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={hidden || rowPage === 0}
                  onClick={() => canReveal() && setRowPage(rowPage - 1)}
                >
                  Previous rows
                </Button>
                <span className="text-sm">
                  Rows {rowPage * 20 + 1}–
                  {Math.min(rows.length, (rowPage + 1) * 20)} of {rows.length}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={hidden || (rowPage + 1) * 20 >= rows.length}
                  onClick={() => canReveal() && setRowPage(rowPage + 1)}
                >
                  Next rows
                </Button>
              </div>
              {visibleRows.map((row, index) => (
                <fieldset
                  key={row.id}
                  disabled={hidden || save.locked(row.id) || save.busy}
                  className="space-y-2 rounded-md border p-3"
                >
                  <legend className="px-1 text-sm">
                    Row {rowPage * 20 + index + 1}:{' '}
                    {STATEMENT_REVIEW_STATUS_LABELS[row.review.status]}
                  </legend>
                  {!hidden &&
                    !save.locked(row.id) &&
                    (() => {
                      const input = save.inputFor(row);
                      return (
                        <>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              disabled={!input || save.busy}
                              checked={save.selection.includes(row.id)}
                              onChange={() => save.toggle(row)}
                            />
                            Select expense from page {row.source[0].page}, line{' '}
                            {row.source[0].line}
                          </label>
                          {!input && row.review.status === 'candidate' && (
                            <p className="text-warning-strong text-sm">
                              This row exceeds supported saving fields or
                              source-note limits, or its source cannot establish
                              positive spending. Use manual entry after checking
                              the source. Source notes allow at most 32 lines,
                              4096 characters per line and 16 KiB total.
                            </p>
                          )}
                          {input && save.selection.includes(row.id) && (
                            <details>
                              <summary className="cursor-pointer text-sm">
                                Source note to save
                              </summary>
                              <p className="mt-2 text-sm break-words whitespace-pre-wrap">
                                {buildImportNote(input)}
                              </p>
                            </details>
                          )}
                        </>
                      );
                    })()}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      if (!canReveal()) return;
                      setSelected(row.id);
                      setPage(row.source[0].page);
                      setView('statement');
                    }}
                  >
                    View source page {row.source[0].page}, line{' '}
                    {row.source[0].line}
                  </Button>
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-${row.id}-classification`}>
                      Classification
                    </Label>
                    <select
                      id={`${id}-${row.id}-classification`}
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-50"
                      value={row.classification}
                      disabled={row.isSummary}
                      aria-describedby={`${id}-${row.id}-classification-reason`}
                      onChange={(event) => classify(row.id, event.target.value)}
                    >
                      {STATEMENT_CLASSIFICATIONS.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                    <p
                      id={`${id}-${row.id}-classification-reason`}
                      className="text-muted-foreground text-sm"
                    >
                      {row.isSummary
                        ? 'Not a transaction'
                        : `Suggested: ${STATEMENT_CLASSIFICATIONS.find((entry) => entry.value === row.suggestedClassification)?.label}`}
                      . {row.classificationReason}
                    </p>
                    {row.classification !== row.suggestedClassification && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span>
                          Your classification overrides the suggestion.
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() =>
                            classify(row.id, row.suggestedClassification)
                          }
                        >
                          Restore suggestion
                        </Button>
                      </div>
                    )}
                  </div>
                  {row.review.issues.map((issue) => (
                    <p key={issue} className="text-sm">
                      {issue}
                    </p>
                  ))}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-${row.id}-date`}>Date</Label>
                      <Input
                        id={`${id}-${row.id}-date`}
                        type="date"
                        value={hidden ? '' : row.date}
                        onChange={(event) =>
                          edit(row.id, 'date', event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-${row.id}-amount`}>
                        SGD billed amount
                      </Label>
                      <Input
                        id={`${id}-${row.id}-amount`}
                        inputMode="decimal"
                        value={hidden ? '' : row.amount}
                        onChange={(event) =>
                          edit(row.id, 'amount', event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-${row.id}-description`}>
                        Description
                      </Label>
                      <Input
                        id={`${id}-${row.id}-description`}
                        value={hidden ? '' : row.description}
                        maxLength={4096}
                        onChange={(event) =>
                          edit(row.id, 'description', event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-${row.id}-category`}>
                        Category
                      </Label>
                      <select
                        id={`${id}-${row.id}-category`}
                        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                        value={row.category}
                        onChange={(event) =>
                          edit(row.id, 'category', event.target.value)
                        }
                      >
                        {Object.entries(EXPENSE_TYPE_LABELS).map(
                          ([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                  {!hidden && !row.isSummary && (
                    <>
                      <MerchantSuggestionReview
                        originalDescription={row.originalDescription}
                        bank={bank}
                        rules={merchant.rules}
                        manual={row.manualMerchant}
                        onApply={(suggestion, replace) =>
                          applySuggestion(row.id, suggestion, replace)
                        }
                        onRestore={() => restoreMerchant(row.id)}
                      />
                      <Button
                        type="button"
                        variant="link"
                        disabled={
                          !merchant.canEdit ||
                          row.originalDescription.length > 256 ||
                          row.description.length > 256
                        }
                        onClick={() => {
                          if (
                            !canReveal() ||
                            save.locked(row.id) ||
                            save.busy ||
                            !merchant.canEdit
                          )
                            return;
                          if (
                            ruleDraft &&
                            !window.confirm('Discard the unsaved rule draft?')
                          )
                            return;
                          setRuleDraft({
                            id: crypto.randomUUID(),
                            label: row.description,
                            enabled: true,
                            matchMode: 'exact',
                            matchText: row.originalDescription,
                            bank,
                            displayName: row.description || null,
                            category: row.category as ExpenseType,
                          });
                        }}
                      >
                        Create rule from this row
                      </Button>
                    </>
                  )}
                </fieldset>
              ))}
            </section>
          </div>
          <StatementSaveReview save={save} />
        </>
      )}
    </div>
  );
}

export function StatementReview() {
  const { hidden, canReveal } = useAmountVisibility();
  const [open, setOpen] = useState(false);
  const discardGuard = useRef<(() => boolean) | null>(null);
  function changeOpen(next: boolean) {
    if (!next && discardGuard.current && !discardGuard.current()) return;
    if (!next || canReveal()) setOpen(next);
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={hidden}>
          Review bank PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Review a bank statement</DialogTitle>
          <DialogDescription>
            Classify drafts against the original PDF, check possible duplicates
            and explicitly save selected self expenses.
          </DialogDescription>
        </DialogHeader>
        <StatementReviewBody discardGuard={discardGuard} />
      </DialogContent>
    </Dialog>
  );
}
