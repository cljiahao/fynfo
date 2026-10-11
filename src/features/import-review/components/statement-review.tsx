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
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import { useEffect, useId, useRef, useState } from 'react';
import { STATEMENT_BANKS, STATEMENT_LIMITS } from '../constants';
import type { LocalStatementPdf } from '../lib/local-pdf';
import {
  parseStatementLines,
  validStatementPeriod,
} from '../lib/statement-parser';
import type { StatementBank, StatementCandidate } from '../types';

function StatementReviewBody() {
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

  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      session.current?.destroy();
    },
    []
  );

  function reset() {
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
  }

  useEffect(() => {
    const pdf = session.current;
    const target = canvas.current;
    if (!pdf || !target || !pageCount) return;
    let active = true;
    void pdf.render(page, target).catch(() => {
      if (active)
        setError(
          'This source page could not be rendered. Choose another file or clear the review.'
        );
    });
    return () => {
      active = false;
    };
  }, [page, pageCount, view]);

  async function extract() {
    reset();
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
    try {
      const bytes = await file.arrayBuffer();
      if (current !== generation.current) return;
      const { openLocalStatementPdf } = await import('../lib/local-pdf');
      opened = await openLocalStatementPdf(bytes, cancellation.signal);
      if (current !== generation.current) {
        opened.destroy();
        return;
      }
      session.current = opened;
      const lines = await opened.extract();
      if (current !== generation.current) return;
      const candidates = parseStatementLines(lines, bank, { from, to });
      setRows(candidates);
      setPage(1);
      setPageCount(opened.pageCount);
      setView('extracted');
      setFile(null);
    } catch {
      opened?.destroy();
      if (current === generation.current) {
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
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  }
  const visibleRows = rows.slice(rowPage * 20, (rowPage + 1) * 20);
  const chosen = rows.find((row) => row.id === selected);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Processed on this device. No file upload or record saving. Text PDFs
        only, up to 10 MiB and 100 pages. Password-protected and image-only
        documents are unsupported. Bank layouts vary; only constructed
        date/description/SGD-billed variants have been tested. Review every
        suggestion against its source.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void extract();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`${id}-bank`}>Statement bank</Label>
          <select
            id={`${id}-bank`}
            value={bank}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            onChange={(event) => {
              reset();
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
            id={`${id}-from`}
            type="date"
            value={from}
            required
            onChange={(event) => {
              reset();
              setFrom(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-to`}>Period end</Label>
          <Input
            id={`${id}-to`}
            type="date"
            value={to}
            required
            onChange={(event) => {
              reset();
              setTo(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-file`}>Bank statement PDF</Label>
          <Input
            id={`${id}-file`}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              reset();
              setFile(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={busy || !file}>
            {busy ? 'Extracting locally…' : 'Extract for review'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
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
          <p className="text-sm">
            {rows.length} source rows:{' '}
            {rows.filter((row) => row.status === 'candidate').length} expense
            suggestions,{' '}
            {rows.filter((row) => row.status === 'unresolved').length}{' '}
            unresolved, {rows.filter((row) => row.status === 'excluded').length}{' '}
            excluded. Edits below are unsaved drafts; source issues remain
            visible.
          </p>
          <div className="flex gap-2 lg:hidden">
            <Button
              type="button"
              variant={view === 'statement' ? 'default' : 'outline'}
              aria-pressed={view === 'statement'}
              onClick={() => setView('statement')}
            >
              Statement
            </Button>
            <Button
              type="button"
              variant={view === 'extracted' ? 'default' : 'outline'}
              aria-pressed={view === 'extracted'}
              onClick={() => setView('extracted')}
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
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous page
                </Button>
                <span className="text-sm">
                  Page {page} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= pageCount}
                  onClick={() => setPage(page + 1)}
                >
                  Next page
                </Button>
              </div>
              <canvas
                ref={canvas}
                aria-label={`Original statement page ${page}`}
                className="h-auto w-full rounded-md border"
              />
              {chosen && (
                <p className="text-sm break-words">
                  Source page {chosen.source[0].page}, line{' '}
                  {chosen.source[0].line}:{' '}
                  {chosen.source.map((line) => line.text).join(' ')}
                </p>
              )}
            </section>
            <section
              aria-label="Extracted expense drafts"
              className={`${view === 'extracted' ? 'block' : 'hidden'} min-w-0 space-y-3 lg:block`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={rowPage === 0}
                  onClick={() => setRowPage(rowPage - 1)}
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
                  disabled={(rowPage + 1) * 20 >= rows.length}
                  onClick={() => setRowPage(rowPage + 1)}
                >
                  Next rows
                </Button>
              </div>
              {visibleRows.map((row, index) => (
                <fieldset
                  key={row.id}
                  className="space-y-2 rounded-md border p-3"
                >
                  <legend className="px-1 text-sm">
                    Row {rowPage * 20 + index + 1}: {row.status}
                  </legend>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setSelected(row.id);
                      setPage(row.source[0].page);
                      setView('statement');
                    }}
                  >
                    View source page {row.source[0].page}, line{' '}
                    {row.source[0].line}
                  </Button>
                  {row.issues.map((issue) => (
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
                        value={row.date}
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
                        value={row.amount}
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
                        value={row.description}
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
                </fieldset>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export function StatementReview() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Review bank PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Review a bank statement</DialogTitle>
          <DialogDescription>
            Compare local expense suggestions with the original PDF. Nothing is
            saved.
          </DialogDescription>
        </DialogHeader>
        <StatementReviewBody />
      </DialogContent>
    </Dialog>
  );
}
