'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAmountVisibility } from '@/features/privacy';
import { useRef, useState } from 'react';
import { STATEMENT_BANKS } from '../constants';
import type { DetectedStatementPeriod } from '../lib/statement-period';
import type { StatementBank } from '../types';

const PERIOD_ERROR = 'Enter both period dates, or use the dates from the PDF.';

interface StatementSourceFormProps {
  controlId: string;
  bank: StatementBank;
  from: string;
  to: string;
  manualPeriod: boolean;
  detectedBasis: DetectedStatementPeriod['basis'] | null;
  busy: boolean;
  fileName: string | null;
  onBankChange: (bank: StatementBank) => void;
  onFileChange: (file: File | null) => void;
  onPeriodChange: (edge: 'from' | 'to', value: string) => void;
  onUsePdfDates: () => void;
  onClear: () => void;
  onExtract: () => void;
}

export function StatementSourceForm({
  controlId,
  bank,
  from,
  to,
  manualPeriod,
  detectedBasis,
  busy,
  fileName,
  onBankChange,
  onFileChange,
  onPeriodChange,
  onUsePdfDates,
  onClear,
  onExtract,
}: StatementSourceFormProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const [open, setOpen] = useState(manualPeriod);
  const [prevManualPeriod, setPrevManualPeriod] = useState(manualPeriod);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const errorId = `${controlId}-period-error`;

  // Adjust state during render so a manual edit elsewhere still reveals the block.
  if (manualPeriod !== prevManualPeriod) {
    setPrevManualPeriod(manualPeriod);
    if (manualPeriod) setOpen(true);
    else setPeriodError(null);
  }

  function handleSubmit() {
    if (!canReveal()) return;
    if (manualPeriod && (!from || !to)) {
      setPeriodError(PERIOD_ERROR);
      setOpen(true);
      // A collapsed details cannot take focus, so wait for it to expand.
      requestAnimationFrame(() => (!from ? fromRef : toRef).current?.focus());
      return;
    }
    setPeriodError(null);
    onExtract();
  }
  return (
    <section
      aria-label="Choose a statement"
      className="mx-auto w-full max-w-2xl space-y-3"
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`${controlId}-bank`}>Statement bank</Label>
          <select
            disabled={hidden}
            id={`${controlId}-bank`}
            value={bank}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            onChange={(event) => {
              if (!canReveal()) return;
              onBankChange(event.target.value as StatementBank);
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
          <Label htmlFor={`${controlId}-file`}>Bank statement PDF</Label>
          <div className="flex min-w-0 items-center gap-2">
            <input
              disabled={hidden}
              id={`${controlId}-file`}
              type="file"
              accept=".pdf,application/pdf"
              className="peer sr-only"
              aria-describedby={`${controlId}-file-name`}
              onChange={(event) => {
                if (!canReveal()) return;
                onFileChange(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
            <label
              htmlFor={`${controlId}-file`}
              aria-hidden="true"
              className={buttonVariants({
                variant: 'outline',
                className:
                  'peer-focus-visible:ring-ring/50 shrink-0 cursor-pointer peer-focus-visible:ring-[3px] peer-disabled:pointer-events-none peer-disabled:opacity-50',
              })}
            >
              {fileName ? 'Change PDF' : 'Choose PDF'}
            </label>
            <span
              id={`${controlId}-file-name`}
              className={`min-w-0 truncate text-sm ${fileName ? '' : 'text-muted-foreground'}`}
            >
              {fileName ?? 'No file chosen'}
            </span>
          </div>
        </div>
        <details
          open={open}
          onToggle={(event) => setOpen(event.currentTarget.open)}
          className="space-y-3 sm:col-span-2"
        >
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
              <Label htmlFor={`${controlId}-from`}>Period start</Label>
              <Input
                disabled={hidden}
                id={`${controlId}-from`}
                type="date"
                ref={fromRef}
                value={hidden ? '' : from}
                aria-invalid={periodError && !from ? true : undefined}
                aria-describedby={periodError && !from ? errorId : undefined}
                onChange={(event) => {
                  if (!canReveal()) return;
                  setPeriodError(null);
                  onPeriodChange('from', event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${controlId}-to`}>Period end</Label>
              <Input
                disabled={hidden}
                id={`${controlId}-to`}
                type="date"
                ref={toRef}
                value={hidden ? '' : to}
                aria-invalid={periodError && !to ? true : undefined}
                aria-describedby={periodError && !to ? errorId : undefined}
                onChange={(event) => {
                  if (!canReveal()) return;
                  setPeriodError(null);
                  onPeriodChange('to', event.target.value);
                }}
              />
            </div>
          </div>
          {periodError && (
            <p id={errorId} role="alert" className="text-destructive text-sm">
              {periodError}
            </p>
          )}
          {manualPeriod && (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              disabled={hidden}
              onClick={() => {
                if (!canReveal()) return;
                setPeriodError(null);
                onUsePdfDates();
              }}
            >
              Use dates from PDF
            </Button>
          )}
        </details>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={hidden || busy || !fileName}>
            {busy ? 'Extracting locally…' : 'Extract for review'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={hidden}
            onClick={() => {
              if (canReveal()) onClear();
            }}
          >
            Clear review
          </Button>
        </div>
      </form>
      <p className="text-muted-foreground text-sm">
        Text PDFs up to 10 MiB and 100 pages. Use an unprotected PDF. Scans and
        some bank layouts need manual entry.
      </p>
    </section>
  );
}
