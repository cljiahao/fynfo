'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAmountVisibility } from '@/features/privacy';
import { STATEMENT_BANKS } from '../constants';
import type { DetectedStatementPeriod } from '../lib/statement-period';
import type { StatementBank } from '../types';

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
  return (
    <section
      aria-label="Choose a statement"
      className="mx-auto w-full max-w-2xl space-y-3"
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canReveal()) onExtract();
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
              <Label htmlFor={`${controlId}-from`}>Period start</Label>
              <Input
                disabled={hidden}
                id={`${controlId}-from`}
                type="date"
                value={hidden ? '' : from}
                required={manualPeriod}
                onChange={(event) => {
                  if (canReveal()) onPeriodChange('from', event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${controlId}-to`}>Period end</Label>
              <Input
                disabled={hidden}
                id={`${controlId}-to`}
                type="date"
                value={hidden ? '' : to}
                required={manualPeriod}
                onChange={(event) => {
                  if (canReveal()) onPeriodChange('to', event.target.value);
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
                if (canReveal()) onUsePdfDates();
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
