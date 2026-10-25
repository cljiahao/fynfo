'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { IMPORT_SAVE_LIMIT, type ExpenseType } from '@/features/expenses';
import {
  MerchantRuleManager,
  applyMerchantSuggestion,
  restoreMerchantSource,
  useMerchantRulebook,
  type MerchantRule,
  type MerchantSuggestion,
} from '@/features/merchant-rules';
import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';
import { cn } from '@/lib/utils';
import { BookMarked, Check, FileText, Info, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  IMPORT_ABOUT_TEXT,
  IMPORT_STEPS,
  STATEMENT_CLASSIFICATIONS,
  STATEMENT_LIMITS,
  STATEMENT_ROWS_PER_PAGE,
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
import { ImportActionBar } from './import-action-bar';
import { ImportComplete } from './import-complete';
import { ImportOutcome } from './import-outcome';
import { ImportProgressOverlay } from './import-progress-overlay';
import { RestoreMerchantDialog } from './restore-merchant-dialog';
import { StatementRowCard } from './statement-row-card';
import { StatementSourceForm } from './statement-source-form';
import { StatementViewer } from './statement-viewer';

type RowFilter =
  | 'expenses'
  | 'expenses-refunds'
  | 'refunds'
  | 'all'
  | 'duplicates';

function StatementReviewBody({
  onGuardChange,
}: {
  onGuardChange: (guard: (() => boolean) | null) => void;
}) {
  const { hidden, mask, canReveal, getHideEpoch } = useAmountVisibility();
  const id = useId();
  const session = useRef<LocalStatementPdf | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const list = useRef<HTMLElement>(null);
  const focusTarget = useRef<{ rowId: string; decision: boolean } | null>(null);
  const [pdf, setPdf] = useState<LocalStatementPdf | null>(null);
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
  const [filter, setFilter] = useState<RowFilter>('expenses');
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- audit 152 §Phase 3 lint suppressions: intentional sync with the privacy or rulebook signal
    if (next !== rows) setRows(next);
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
    onGuardChange(allowDiscard);
    return () => onGuardChange(null);
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- audit 152 §Phase 3 lint suppressions: intentional sync with the privacy or rulebook signal
        setBusy(false);
      }
    },
    [hidden, busy]
  );

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    const card = document.getElementById(`${id}-${target.rowId}-card`);
    const decision = target.decision
      ? document
          .getElementById(`${id}-${target.rowId}-resolution`)
          ?.querySelector('button')
      : null;
    card?.scrollIntoView?.({ block: 'center' });
    (decision ?? card)?.focus();
  });

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
    setPdf(null);
    setBusy(false);
    setRows([]);
    setError('');
    setDetectedBasis(null);
    setPageCount(0);
    setSelected('');
    setRowPage(0);
    return true;
  }

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
      setPdf(opened);
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
    setRows((current) =>
      current.map((row) =>
        row.id === rowId && !row.isSummary ? { ...row, classification } : row
      )
    );
  }
  function changeBank(next: StatementBank) {
    if (!reset()) return;
    setBank(next);
  }
  function changeFile(next: File | null) {
    if (!reset()) return;
    if (!manualPeriod) {
      setFrom('');
      setTo('');
    }
    setFile(next);
  }
  function changePeriod(edge: 'from' | 'to', value: string) {
    if (!reset()) return;
    setManualPeriod(true);
    if (edge === 'from') setFrom(value);
    else setTo(value);
  }
  function usePdfDates() {
    if (!reset()) return;
    setManualPeriod(false);
    setFrom('');
    setTo('');
  }
  function clearReview() {
    if (!reset()) return;
    setFile(null);
  }
  function focusRow(row: StatementCandidate) {
    setSelected(row.id);
    setPage(row.source[0].page);
  }
  function compareSource(row: StatementCandidate) {
    focusRow(row);
    setView('statement');
  }
  function requestRestore(rowId: string) {
    restoreOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setRestoreId(rowId);
  }
  function createRule(row: StatementCandidate, origin: HTMLElement) {
    ruleOrigin.current = origin;
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
  }
  const reviewedRows = rows.map((row) => ({
    ...row,
    review: getStatementReview(row, { from, to }),
  }));
  const rowNumbers = new Map(rows.map((row, index) => [row.id, index + 1]));
  function describeRow(rowId: string) {
    const row = rows.find((entry) => entry.id === rowId);
    return {
      number: rowNumbers.get(rowId) ?? 0,
      page: row?.source[0].page ?? 0,
      line: row?.source[0].line ?? 0,
    };
  }
  function rowsFor(view: RowFilter) {
    return reviewedRows.filter((row) => {
      if (view === 'all') return true;
      if (view === 'duplicates') return save.matchFor(row.id) !== null;
      if (row.isSummary) return false;
      if (view === 'refunds') return row.classification === 'refund';
      if (view === 'expenses-refunds' && row.classification === 'refund')
        return true;
      return (
        row.classification === 'expense' || row.classification === 'unknown'
      );
    });
  }
  const filteredRows = rowsFor(filter);
  const lastRowPage = Math.max(
    0,
    Math.ceil(filteredRows.length / STATEMENT_ROWS_PER_PAGE) - 1
  );
  const currentRowPage = Math.min(rowPage, lastRowPage);
  const visibleRows = filteredRows.slice(
    currentRowPage * STATEMENT_ROWS_PER_PAGE,
    (currentRowPage + 1) * STATEMENT_ROWS_PER_PAGE
  );
  const eligibleRows = filteredRows.filter(
    (row) =>
      !save.locked(row.id) &&
      save.resolutionFor(row.id) !== 'skip' &&
      save.inputFor(row)
  );
  const remaining = rows.filter(
    (row) => !save.locked(row.id) && save.inputFor(row)
  ).length;
  const restoreRow = rows.find((row) => row.id === restoreId);
  const chosen = rows.find((row) => row.id === selected);

  function goToRow(rowId: string, decision: boolean, preferred: RowFilter) {
    const row = rows.find((entry) => entry.id === rowId);
    if (!row) return;
    const nextFilter = rowsFor(preferred).some((entry) => entry.id === rowId)
      ? preferred
      : 'all';
    const index = rowsFor(nextFilter).findIndex((entry) => entry.id === rowId);
    setFilter(nextFilter);
    setRowPage(Math.floor(index / STATEMENT_ROWS_PER_PAGE));
    setView('extracted');
    focusRow(row);
    focusTarget.current = { rowId, decision };
  }
  function nextDuplicate() {
    const rowId = rows.find((row) => save.openDuplicates.includes(row.id))?.id;
    if (rowId && canReveal()) goToRow(rowId, true, 'duplicates');
  }
  function changeRowPage(next: number) {
    if (!canReveal()) return;
    setRowPage(next);
    if (list.current) list.current.scrollTop = 0;
    const first = filteredRows[next * STATEMENT_ROWS_PER_PAGE];
    if (first) focusTarget.current = { rowId: first.id, decision: false };
  }
  function importAnother() {
    if (!reset()) return;
    setFile(null);
  }

  const step = save.complete
    ? 'done'
    : rows.length === 0
      ? 'choose'
      : save.reviewed ||
          save.activity === 'save' ||
          Object.keys(save.attempts).length
        ? 'save'
        : save.selection.length
          ? 'check'
          : 'review';
  const stepIndex = IMPORT_STEPS.findIndex((entry) => entry.value === step);
  const counts = (status: string) =>
    mask(reviewedRows.filter((row) => row.review.status === status).length);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div inert={save.busy} className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <DialogHeader className="min-w-0 gap-1">
            <DialogTitle>Review a bank statement</DialogTitle>
            <DialogDescription>
              Your PDF stays on this device.
            </DialogDescription>
            <ol
              aria-label="Import steps"
              className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
            >
              {IMPORT_STEPS.map((entry, index) => (
                <li
                  key={entry.value}
                  aria-current={index === stepIndex ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-1.5',
                    index === stepIndex
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border tabular-nums',
                      index < stepIndex &&
                        'border-brand bg-brand text-brand-foreground',
                      index === stepIndex && 'border-brand text-brand'
                    )}
                  >
                    {index < stepIndex ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {entry.label}
                  {index < IMPORT_STEPS.length - 1 && (
                    <span aria-hidden="true" className="text-muted-foreground">
                      ›
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </DialogHeader>
          <div className="flex shrink-0 items-center gap-1">
            {rows.length > 0 && !save.complete && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Change statement"
                  disabled={hidden}
                  onClick={() => canReveal() && reset()}
                >
                  <FileText />
                  <span className="hidden sm:inline">Change statement</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Merchant rules"
                  disabled={hidden}
                  ref={ruleButton}
                  onClick={(event) => {
                    if (!canReveal()) return;
                    ruleOrigin.current = event.currentTarget;
                    setRulesOpen(true);
                  }}
                >
                  <BookMarked />
                  <span className="hidden sm:inline">Merchant rules</span>
                </Button>
              </>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="About statement import"
                >
                  <Info />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="text-sm">
                {IMPORT_ABOUT_TEXT}
              </PopoverContent>
            </Popover>
            <DialogClose asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Close"
                disabled={save.busy}
              >
                <X />
              </Button>
            </DialogClose>
          </div>
        </div>
        <AmountsHiddenNotice />
        {(error || busy) && (
          <div role="status" aria-live="polite" className="shrink-0">
            {error && <p className="text-destructive text-sm">{error}</p>}
            {busy && (
              <p className="text-muted-foreground text-sm">
                Reading locally. You can clear this review to cancel.
              </p>
            )}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <StatementSourceForm
              controlId={id}
              bank={bank}
              from={from}
              to={to}
              manualPeriod={manualPeriod}
              detectedBasis={detectedBasis}
              busy={busy}
              hasFile={!!file}
              onBankChange={changeBank}
              onFileChange={changeFile}
              onPeriodChange={changePeriod}
              onUsePdfDates={usePdfDates}
              onClear={clearReview}
              onExtract={() => void extract()}
            />
          </div>
        ) : save.complete ? (
          <ImportComplete
            save={save}
            bank={bank}
            period={{ from, to }}
            remaining={remaining}
            onAnother={importAnother}
          />
        ) : (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              {mask(rows.length)} source rows: {counts('candidate')} expense
              suggestions, {counts('unresolved')} unresolved,{' '}
              {counts('excluded')} excluded.
            </p>
            <div className="flex shrink-0 gap-2 lg:hidden">
              <Button
                type="button"
                size="sm"
                variant={view === 'statement' ? 'default' : 'outline'}
                aria-pressed={view === 'statement'}
                disabled={hidden}
                onClick={() => canReveal() && setView('statement')}
              >
                Statement
              </Button>
              <Button
                type="button"
                size="sm"
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
                <StatementViewer
                  pdf={pdf}
                  page={page}
                  pageCount={pageCount}
                  visible={view === 'statement'}
                  chosen={chosen}
                  onPageChange={setPage}
                  onError={setError}
                />
              </section>
              <section
                ref={list}
                aria-label="Extracted transaction drafts"
                className={`${view === 'extracted' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain lg:flex`}
              >
                <div className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b pb-2">
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
                      setFilter(event.target.value as RowFilter);
                      setRowPage(0);
                    }}
                  >
                    <option value="expenses">Expenses to review</option>
                    <option value="expenses-refunds">
                      Expenses and refunds
                    </option>
                    <option value="refunds">Refunds</option>
                    <option value="all">All statement rows</option>
                    {(save.duplicateCount > 0 || filter === 'duplicates') && (
                      <option value="duplicates">
                        Possible duplicates ({save.duplicateCount})
                      </option>
                    )}
                  </select>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {filteredRows.length} row
                    {filteredRows.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex-1">
                  {!hidden && filteredRows.length === 0 && (
                    <p className="text-muted-foreground p-3 text-sm">
                      No transactions in this view. Choose All statement rows to
                      inspect excluded items.
                    </p>
                  )}
                  {visibleRows.map((row) => (
                    <StatementRowCard
                      key={row.id}
                      row={row}
                      number={rowNumbers.get(row.id) ?? 0}
                      isSelected={selected === row.id}
                      controlId={id}
                      bank={bank}
                      hasRuleDraft={!!ruleDraft}
                      save={save}
                      merchant={merchant}
                      onFocus={focusRow}
                      onCompare={compareSource}
                      onRestore={requestRestore}
                      onCreateRule={createRule}
                      onEdit={edit}
                      onClassify={classify}
                      onApplySuggestion={applySuggestion}
                      describeRow={describeRow}
                      onJumpToRow={(rowId) => goToRow(rowId, false, filter)}
                    />
                  ))}
                </div>
                {filteredRows.length > STATEMENT_ROWS_PER_PAGE && (
                  <div className="bg-background sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={hidden || currentRowPage === 0}
                      onClick={() => changeRowPage(currentRowPage - 1)}
                    >
                      Previous rows
                    </Button>
                    <span className="text-sm tabular-nums" aria-live="polite">
                      Rows {currentRowPage * STATEMENT_ROWS_PER_PAGE + 1}–
                      {Math.min(
                        filteredRows.length,
                        (currentRowPage + 1) * STATEMENT_ROWS_PER_PAGE
                      )}{' '}
                      of {filteredRows.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={hidden || currentRowPage >= lastRowPage}
                      onClick={() => changeRowPage(currentRowPage + 1)}
                    >
                      Next rows
                    </Button>
                  </div>
                )}
              </section>
            </div>
            <ImportOutcome
              save={save}
              rowNumber={(key) => rowNumbers.get(key) ?? 0}
            />
            <ImportActionBar
              save={save}
              eligibleCount={Math.min(eligibleRows.length, IMPORT_SAVE_LIMIT)}
              onSelectAll={() => save.selectExpenses(eligibleRows)}
              onNextDuplicate={nextDuplicate}
            />
          </>
        )}
      </div>
      {save.busy && <ImportProgressOverlay save={save} />}
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
      <RestoreMerchantDialog
        restoreRow={restoreRow}
        origin={restoreOrigin}
        save={save}
        onClose={() => setRestoreId(null)}
        onRestore={restoreMerchant}
      />
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
      <DialogContent
        showCloseButton={false}
        className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden p-4 sm:max-w-7xl sm:p-6"
      >
        <StatementReviewBody
          onGuardChange={(guard) => {
            discardGuard.current = guard;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
