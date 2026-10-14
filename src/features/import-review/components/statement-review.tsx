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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/features/expenses';
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
import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  STATEMENT_BANKS,
  STATEMENT_CLASSIFICATIONS,
  STATEMENT_LIMITS,
  STATEMENT_REVIEW_STATUS_LABELS,
} from '../constants';
import { useStatementSave } from '../hooks/use-statement-save';
import type { LocalStatementPdf } from '../lib/local-pdf';
import { applyRulesToStatement } from '../lib/merchant-rules';
import {
  getStatementReview,
  parseStatementLines,
  validStatementPeriod,
} from '../lib/statement-parser';
import {
  detectStatementPeriod,
  type DetectedStatementPeriod,
} from '../lib/statement-period';
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
  const [manualPeriod, setManualPeriod] = useState(false);
  const [detectedBasis, setDetectedBasis] = useState<
    DetectedStatementPeriod['basis'] | null
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<StatementCandidate[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [view, setView] = useState<'statement' | 'extracted'>('extracted');
  const [selected, setSelected] = useState('');
  const [rowPage, setRowPage] = useState(0);
  const [filter, setFilter] = useState('expenses');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const restoreOrigin = useRef<HTMLElement | null>(null);
  const ruleOrigin = useRef<HTMLElement | null>(null);
  const ruleButton = useRef<HTMLButtonElement | null>(null);
  const merchant = useMerchantRulebook();
  const [ruleDraft, setRuleDraft] = useState<MerchantRule | null>(null);
  const save = useStatementSave(rows, bank, { from, to });
  useEffect(() => {
    if (hidden || !canReveal() || save.busy || merchant.stage !== 'ready')
      return;
    const next = applyRulesToStatement(rows, bank, merchant.rules, save.locked);
    if (next !== rows) {
      save.invalidateReview();
      setRows(next);
    }
  }, [rows, bank, merchant.rules, merchant.stage, hidden, canReveal, save]);

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
    setRulesOpen(false);
    setRestoreId(null);
    setFilter('expenses');
    save.reset();
    generation.current++;
    controller.current?.abort();
    session.current?.destroy();
    session.current = null;
    setBusy(false);
    setRows([]);
    setError('');
    setDetectedBasis(null);
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
      (manualPeriod && !validStatementPeriod({ from, to }))
    ) {
      setError(
        'Choose a PDF up to 10 MiB. If entering dates manually, use a valid range of at most 400 days.'
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
      const detected = manualPeriod ? null : detectStatementPeriod(lines);
      const period = manualPeriod ? { from, to } : detected?.period;
      if (!period) {
        discardOpenedPdf();
        setManualPeriod(true);
        setFrom('');
        setTo('');
        setError(
          'We could not read a clear statement date or period. Enter the dates, then extract again.'
        );
        return;
      }
      const candidates = parseStatementLines(lines, bank, period);
      setFrom(period.from);
      setTo(period.to);
      setDetectedBasis(detected?.basis ?? null);
      setRows(candidates);
      setSelected(candidates[0]?.id ?? '');
      setPage(candidates[0]?.source[0].page ?? 1);
      setPageCount(opened.pageCount);
      setView('extracted');
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
          manualMerchant: {
            description:
              next.manual.description || suggestion.displayName !== null,
            category: next.manual.category || suggestion.category !== null,
          },
        };
      })
    );
  }
  function restoreMerchant(rowId: string) {
    if (!canReveal() || save.locked(rowId) || save.busy) return;

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
  const filteredRows = reviewedRows.filter((row) => {
    if (filter === 'all') return true;
    if (row.isSummary) return false;
    if (filter === 'refunds') return row.classification === 'refund';
    if (filter === 'expenses-refunds' && row.classification === 'refund')
      return true;
    return row.classification === 'expense' || row.classification === 'unknown';
  });
  const currentRowPage = Math.min(
    rowPage,
    Math.max(0, Math.ceil(filteredRows.length / 20) - 1)
  );
  const visibleRows = filteredRows.slice(
    currentRowPage * 20,
    (currentRowPage + 1) * 20
  );
  const eligibleCount = filteredRows.filter(
    (row) => !save.locked(row.id) && save.inputFor(row)
  ).length;
  const restoreRow = rows.find((row) => row.id === restoreId);
  const chosen = rows.find((row) => row.id === selected);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AmountsHiddenNotice />
      <div className="max-h-[35dvh] shrink-0 overflow-y-auto">
        <details open={rows.length === 0} className="space-y-3 open:w-full">
          <summary className="cursor-pointer text-sm font-medium">
            {rows.length ? 'Change statement' : 'Choose a statement'}
          </summary>
          <form
            className="grid gap-3 sm:grid-cols-2"
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
              <Label htmlFor={`${id}-file`}>Bank statement PDF</Label>
              <Input
                disabled={hidden}
                id={`${id}-file`}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  if (!canReveal()) return;
                  if (!reset()) return;
                  if (!manualPeriod) {
                    setFrom('');
                    setTo('');
                  }
                  setFile(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = '';
                }}
              />
            </div>
            <details open={manualPeriod} className="space-y-3 sm:col-span-2">
              <summary className="text-muted-foreground cursor-pointer text-sm">
                Dates (optional)
              </summary>
              <p className="text-muted-foreground text-sm">
                {detectedBasis === 'printed-period'
                  ? 'Period read from your PDF.'
                  : detectedBasis
                    ? 'Date range inferred from the statement date or month. Correct it here if needed.'
                    : 'Dates are read from your PDF. Enter them only if needed.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-from`}>Period start</Label>
                  <Input
                    disabled={hidden}
                    id={`${id}-from`}
                    type="date"
                    value={hidden ? '' : from}
                    required={manualPeriod}
                    onChange={(event) => {
                      if (!canReveal()) return;
                      if (!reset()) return;
                      setManualPeriod(true);
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
                    required={manualPeriod}
                    onChange={(event) => {
                      if (!canReveal()) return;
                      if (!reset()) return;
                      setManualPeriod(true);
                      setTo(event.target.value);
                    }}
                  />
                </div>
              </div>
              {manualPeriod && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  disabled={hidden}
                  onClick={() => {
                    if (!canReveal() || !reset()) return;
                    setManualPeriod(false);
                    setFrom('');
                    setTo('');
                  }}
                >
                  Use dates from PDF
                </Button>
              )}
            </details>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
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
          <p className="text-muted-foreground text-sm">
            Text PDFs up to 10 MiB and 100 pages. Use an unprotected PDF. Scans
            and some bank layouts need manual entry.
          </p>
        </details>
        {rows.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={hidden}
            ref={ruleButton}
            onClick={(event) => {
              if (!canReveal()) return;
              ruleOrigin.current = event.currentTarget;
              setRulesOpen(true);
            }}
          >
            Saved merchant rules
          </Button>
        )}
      </div>
      {(error || busy) && (
        <div role="status" aria-live="polite">
          {error && <p className="text-destructive text-sm">{error}</p>}
          {busy && (
            <p className="text-muted-foreground text-sm">
              Reading locally. You can clear this review to cancel.
            </p>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <p className="sr-only" role="status" aria-live="polite">
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
            excluded.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${id}-filter`}>
              Show transactions
            </label>
            <select
              id={`${id}-filter`}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={filter}
              disabled={hidden || save.busy}
              onChange={(event) => {
                if (!canReveal()) return;
                setFilter(event.target.value);
                setRowPage(0);
              }}
            >
              <option value="expenses">Expenses to review</option>
              <option value="expenses-refunds">Expenses and refunds</option>
              <option value="refunds">Refunds</option>
              <option value="all">All statement rows</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={hidden || save.busy || eligibleCount === 0}
              onClick={() => save.selectExpenses(filteredRows)}
            >
              {eligibleCount > 20
                ? 'Select next 20 expenses'
                : 'Select all expenses'}
            </Button>
            {save.selection.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={hidden || save.busy}
                onClick={save.clearSelection}
              >
                Clear selection
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="About transaction selection"
                >
                  <Info className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="text-sm">
                Select purchases, check the details, then save. Repayments are
                hidden here. Refunds can be reviewed but are not added as
                expenses. Select up to 20 expenses per batch.
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex shrink-0 gap-2 lg:hidden">
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
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
            <section
              aria-label="Original statement"
              className={`${view === 'statement' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col gap-2 lg:flex`}
            >
              <div className="bg-background shrink-0 space-y-2">
                {pageCount > 1 && (
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
                )}
                {!hidden && chosen && chosen.source[0].page === page && (
                  <details className="text-muted-foreground text-xs">
                    <summary className="cursor-pointer">Source text</summary>
                    <p
                      className="max-h-20 overflow-y-auto py-2 break-words"
                      aria-live="polite"
                    >
                      Source page {chosen.source[0].page}, line{' '}
                      {chosen.source[0].line}:{' '}
                      {chosen.source.map((line) => line.text).join(' ')}
                    </p>
                  </details>
                )}
              </div>
              {!hidden && (
                <div className="bg-muted/30 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border">
                  <canvas
                    ref={canvas}
                    aria-label={`Original statement page ${page}`}
                    className="block h-full w-full object-contain"
                  />
                </div>
              )}
            </section>
            <section
              aria-label="Extracted transaction drafts"
              className={`${view === 'extracted' ? 'block' : 'hidden'} min-h-0 min-w-0 space-y-3 overflow-y-auto overscroll-contain pr-2 lg:block`}
            >
              {filteredRows.length > 20 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={hidden || currentRowPage === 0}
                    onClick={() =>
                      canReveal() && setRowPage(currentRowPage - 1)
                    }
                  >
                    Previous rows
                  </Button>
                  <span className="text-sm">
                    Rows {currentRowPage * 20 + 1}–
                    {Math.min(filteredRows.length, (currentRowPage + 1) * 20)}{' '}
                    of {filteredRows.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      hidden || (currentRowPage + 1) * 20 >= filteredRows.length
                    }
                    onClick={() =>
                      canReveal() && setRowPage(currentRowPage + 1)
                    }
                  >
                    Next rows
                  </Button>
                </div>
              )}
              {!hidden && filteredRows.length === 0 && (
                <p className="text-muted-foreground p-3 text-sm">
                  No transactions in this view. Choose All statement rows to
                  inspect excluded items.
                </p>
              )}
              {visibleRows.map((row, index) => (
                <fieldset
                  key={row.id}
                  disabled={hidden || save.locked(row.id) || save.busy}
                  className={`min-w-0 space-y-2 border-b px-3 py-3 ${selected === row.id ? 'bg-muted/50' : ''}`}
                  onFocusCapture={() => {
                    if (!canReveal()) return;
                    setSelected(row.id);
                    setPage(row.source[0].page);
                  }}
                >
                  <legend className="sr-only">
                    Row {rowPage * 20 + index + 1}:{' '}
                    {STATEMENT_REVIEW_STATUS_LABELS[row.review.status]}
                  </legend>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="link"
                      className="order-1 h-auto p-0 text-xs"
                      aria-label={`View source page ${row.source[0].page}, line ${row.source[0].line}`}
                      onClick={() => {
                        if (!canReveal()) return;
                        setSelected(row.id);
                        setPage(row.source[0].page);
                        setView('statement');
                      }}
                    >
                      Compare source · Page {row.source[0].page}
                    </Button>
                    {!hidden &&
                      !save.locked(row.id) &&
                      (() => {
                        const input = save.inputFor(row);
                        return (
                          <>
                            <label className="flex min-h-9 min-w-9 cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="accent-primary size-4"
                                aria-label={`Select expense from page ${row.source[0].page}, line ${row.source[0].line}`}
                                disabled={!input || save.busy}
                                checked={save.selection.includes(row.id)}
                                onChange={() => save.toggle(row)}
                              />
                              {row.review.status !== 'candidate' && (
                                <span className="text-muted-foreground text-sm">
                                  {row.review.status === 'excluded'
                                    ? 'Not a purchase'
                                    : 'Check details'}
                                </span>
                              )}
                              <span className="sr-only">Select purchase</span>
                            </label>
                            {!input && row.review.status === 'candidate' && (
                              <p className="text-warning-strong order-2 w-full text-sm">
                                This row exceeds supported saving fields or
                                source-note limits, or its source cannot
                                establish positive spending. Use manual entry
                                after checking the source. Source notes allow at
                                most 32 lines, 4096 characters per line and 16
                                KiB total.
                              </p>
                            )}
                          </>
                        );
                      })()}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="space-y-1 sm:col-span-8">
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
                    <div className="space-y-1 sm:col-span-4">
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
                    <div className="w-full max-w-40 min-w-0 space-y-1 sm:col-span-4">
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
                    <div className="space-y-1 sm:col-span-8">
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
                  {row.review.issues.map((issue) =>
                    issue.startsWith('A source credit') ? (
                      <Popover key={issue}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Why this credit is excluded"
                          >
                            <Info className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="text-sm">
                          {issue}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p key={issue} className="text-sm">
                        {issue}
                      </p>
                    )
                  )}
                  <details className="space-y-3">
                    <summary className="text-muted-foreground cursor-pointer text-sm">
                      Details
                    </summary>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-32 flex-1 space-y-1">
                        <Label htmlFor={`${id}-${row.id}-classification`}>
                          Classification
                        </Label>
                        <select
                          id={`${id}-${row.id}-classification`}
                          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-50"
                          value={row.classification}
                          disabled={row.isSummary}
                          aria-describedby={`${id}-${row.id}-classification-reason`}
                          onChange={(event) =>
                            classify(row.id, event.target.value)
                          }
                        >
                          {STATEMENT_CLASSIFICATIONS.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!hidden && !row.isSummary && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            aria-label="Review changes / restore"
                            variant="outline"
                            onClick={() => {
                              if (
                                !canReveal() ||
                                save.locked(row.id) ||
                                save.busy
                              )
                                return;
                              restoreOrigin.current =
                                document.activeElement instanceof HTMLElement
                                  ? document.activeElement
                                  : null;
                              setRestoreId(row.id);
                            }}
                          >
                            Review changes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              !merchant.canEdit ||
                              row.originalDescription.length > 256 ||
                              row.description.length > 256
                            }
                            onClick={(event) => {
                              if (
                                !canReveal() ||
                                save.locked(row.id) ||
                                save.busy ||
                                !merchant.canEdit
                              )
                                return;
                              if (
                                ruleDraft &&
                                !window.confirm(
                                  'Discard the unsaved rule draft?'
                                )
                              )
                                return;
                              ruleOrigin.current = event.currentTarget;
                              setRulesOpen(true);
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
                            Create rule
                          </Button>
                        </div>
                      )}
                    </div>
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
                    {!hidden && !row.isSummary && (
                      <MerchantSuggestionReview
                        originalDescription={row.originalDescription}
                        bank={bank}
                        rules={merchant.rules}
                        manual={row.manualMerchant}
                        onApply={(suggestion, replace) =>
                          applySuggestion(row.id, suggestion, replace)
                        }
                      />
                    )}
                  </details>
                </fieldset>
              ))}
            </section>
          </div>
          <div className="max-h-[28dvh] shrink-0 overflow-y-auto">
            <StatementSaveReview save={save} />
          </div>
        </>
      )}
      <Dialog open={rulesOpen && !hidden} onOpenChange={setRulesOpen}>
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (ruleOrigin.current?.isConnected
              ? ruleOrigin.current
              : ruleButton.current
            )?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {ruleDraft ? 'Review rule' : 'Saved merchant rules'}
            </DialogTitle>
            <DialogDescription>
              Saved rules fill matching draft rows automatically. Your manual
              edits are kept.
            </DialogDescription>
          </DialogHeader>
          {!hidden && (
            <MerchantRuleManager
              embedded
              rulebook={merchant}
              draft={ruleDraft}
              onDraft={setRuleDraft}
              examples={rows
                .filter((row) => !row.isSummary)
                .map((row) => ({ description: row.originalDescription, bank }))}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!restoreRow && !hidden}
        onOpenChange={(next) => {
          if (!next) setRestoreId(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreOrigin.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Restore description and category</DialogTitle>
            <DialogDescription>
              Compare your edits with the extracted values before restoring.
            </DialogDescription>
          </DialogHeader>
          {!hidden && restoreRow && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="min-w-0 space-y-2">
                  <h3 className="font-medium">Current</h3>
                  <p className="break-words">
                    Description: {restoreRow.description}
                  </p>
                  <p>
                    Category:{' '}
                    {EXPENSE_TYPE_LABELS[restoreRow.category as ExpenseType]}
                  </p>
                </div>
                <div className="min-w-0 space-y-2">
                  <h3 className="font-medium">Restore to</h3>
                  <p className="break-words">
                    Description: {restoreRow.originalDescription}
                  </p>
                  <p>Category: Other</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Other is the initial category; bank PDFs do not supply an
                expense category.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestoreId(null)}>
                  Keep edits
                </Button>
                <Button
                  disabled={save.busy || save.locked(restoreRow.id)}
                  onClick={() => {
                    restoreMerchant(restoreRow.id);
                    setRestoreId(null);
                  }}
                >
                  Restore values
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StatementReview({
  triggerLabel = 'Review bank PDF',
}: {
  triggerLabel?: string;
}) {
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
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden p-4 sm:max-w-7xl sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Review a bank statement</DialogTitle>
          <DialogDescription>Your PDF stays on this device.</DialogDescription>
        </DialogHeader>
        <StatementReviewBody discardGuard={discardGuard} />
      </DialogContent>
    </Dialog>
  );
}
