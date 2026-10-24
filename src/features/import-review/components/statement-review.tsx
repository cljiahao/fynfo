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
import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { STATEMENT_CLASSIFICATIONS, STATEMENT_LIMITS } from '../constants';
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
import { RestoreMerchantDialog } from './restore-merchant-dialog';
import { StatementRowCard } from './statement-row-card';
import { StatementSaveReview } from './statement-save-review';
import { StatementSourceForm } from './statement-source-form';

function StatementReviewBody({
  onGuardChange,
}: {
  onGuardChange: (guard: (() => boolean) | null) => void;
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with the privacy or rulebook signal
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with the privacy or rulebook signal
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
        <StatementSourceForm
          controlId={id}
          hasRows={rows.length > 0}
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
              {eligibleCount > IMPORT_SAVE_LIMIT
                ? `Select next ${IMPORT_SAVE_LIMIT} expenses`
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
                expenses. Larger selections are saved in automatic groups.
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
                <StatementRowCard
                  key={row.id}
                  row={row}
                  number={rowPage * 20 + index + 1}
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
                />
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
      <DialogContent className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden p-4 sm:max-w-7xl sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Review a bank statement</DialogTitle>
          <DialogDescription>Your PDF stays on this device.</DialogDescription>
        </DialogHeader>
        <StatementReviewBody
          onGuardChange={(guard) => {
            discardGuard.current = guard;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
