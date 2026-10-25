'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import {
  MerchantSuggestionReview,
  type MerchantSuggestion,
  type useMerchantRulebook,
} from '@/features/merchant-rules';
import { useAmountVisibility } from '@/features/privacy';
import { Info } from 'lucide-react';
import {
  DUPLICATE_RESOLUTIONS,
  STATEMENT_CLASSIFICATIONS,
  STATEMENT_REVIEW_STATUS_LABELS,
} from '../constants';
import type { useStatementSave } from '../hooks/use-statement-save';
import type { getStatementReview } from '../lib/statement-parser';
import type { StatementBank, StatementCandidate } from '../types';

export type ReviewedRow = StatementCandidate & {
  review: ReturnType<typeof getStatementReview>;
};

interface StatementRowCardProps {
  row: ReviewedRow;
  number: number;
  isSelected: boolean;
  controlId: string;
  bank: StatementBank;
  hasRuleDraft: boolean;
  save: ReturnType<typeof useStatementSave>;
  merchant: ReturnType<typeof useMerchantRulebook>;
  onFocus: (row: ReviewedRow) => void;
  onCompare: (row: ReviewedRow) => void;
  onRestore: (rowId: string) => void;
  onCreateRule: (row: ReviewedRow, origin: HTMLElement) => void;
  onEdit: (
    rowId: string,
    field: 'date' | 'description' | 'amount' | 'category',
    value: string
  ) => void;
  onClassify: (rowId: string, value: string) => void;
  onApplySuggestion: (
    rowId: string,
    suggestion: MerchantSuggestion,
    replace: { description: boolean; category: boolean }
  ) => void;
  describeRow: (rowId: string) => {
    number: number;
    page: number;
    line: number;
  };
  onJumpToRow: (rowId: string) => void;
}

export function StatementRowCard({
  row,
  number,
  isSelected,
  controlId,
  bank,
  hasRuleDraft,
  save,
  merchant,
  onFocus,
  onCompare,
  onRestore,
  onCreateRule,
  onEdit,
  onClassify,
  onApplySuggestion,
  describeRow,
  onJumpToRow,
}: StatementRowCardProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const match = save.matchFor(row.id);
  const resolution = save.resolutionFor(row.id);
  const partner =
    match?.kind === 'statement' ? describeRow(match.rowId) : undefined;
  return (
    <fieldset
      id={`${controlId}-${row.id}-card`}
      tabIndex={-1}
      disabled={hidden || save.locked(row.id) || save.busy}
      className={`min-w-0 scroll-mt-14 space-y-2 border-b px-3 py-3 outline-none ${isSelected ? 'bg-muted/50' : ''}`}
      onFocusCapture={() => {
        if (canReveal()) onFocus(row);
      }}
    >
      <legend className="sr-only">
        Row {number}: {STATEMENT_REVIEW_STATUS_LABELS[row.review.status]}
      </legend>
      {!hidden && match && (
        <div className="border-warning bg-warning-subtle space-y-2 rounded-md border p-3 text-sm">
          <p className="text-warning-strong font-medium">
            {match.kind === 'saved' ? (
              `Possible duplicate of a saved expense: ${match.date} · ${match.item} · SGD ${match.amount.toFixed(2)}`
            ) : (
              <>
                Possible duplicate of{' '}
                <Button
                  type="button"
                  variant="link"
                  className="text-warning-strong h-auto p-0 font-medium underline"
                  onClick={() => canReveal() && onJumpToRow(match.rowId)}
                >
                  #{partner?.number} (page {partner?.page} · line{' '}
                  {partner?.line})
                </Button>{' '}
                in this statement
              </>
            )}
          </p>
          <div
            id={`${controlId}-${row.id}-resolution`}
            role="group"
            aria-label={`Duplicate decision for row ${number}`}
            className="flex flex-wrap gap-1"
          >
            {DUPLICATE_RESOLUTIONS.map((choice) => (
              <Button
                key={choice.value}
                type="button"
                size="sm"
                variant={resolution === choice.value ? 'default' : 'outline'}
                aria-pressed={resolution === choice.value}
                onClick={() => {
                  if (!canReveal()) return;
                  save.resolve(row.id, choice.value);
                  if (choice.value === 'amend')
                    document
                      .getElementById(`${controlId}-${row.id}-description`)
                      ?.focus();
                }}
              >
                {choice.label}
              </Button>
            ))}
          </div>
          {resolution === 'amend' && (
            <p className="text-muted-foreground">
              Correct the fields below, then recheck this row.
            </p>
          )}
          {resolution === 'skip' && (
            <p className="text-muted-foreground">
              Skipped. Select the row again to bring it back.
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="order-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium tabular-nums">
            #{number}
          </span>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            aria-label={`View source page ${row.source[0].page}, line ${row.source[0].line}`}
            onClick={() => {
              if (canReveal()) onCompare(row);
            }}
          >
            Compare source · Page {row.source[0].page} · line{' '}
            {row.source[0].line}
          </Button>
          {!hidden && save.isStale(row.id) && (
            <span className="text-warning-strong">Changed · recheck</span>
          )}
        </div>
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
                    This row exceeds supported saving fields or source-note
                    limits, or its source cannot establish positive spending.
                    Use manual entry after checking the source. Source notes
                    allow at most 32 lines, 4096 characters per line and 16 KiB
                    total.
                  </p>
                )}
              </>
            );
          })()}
      </div>
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="space-y-1 sm:col-span-8">
          <Label htmlFor={`${controlId}-${row.id}-description`}>
            Item / Brand
          </Label>
          <Input
            id={`${controlId}-${row.id}-description`}
            value={hidden ? '' : row.description}
            maxLength={4096}
            onChange={(event) =>
              onEdit(row.id, 'description', event.target.value)
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-4">
          <Label htmlFor={`${controlId}-${row.id}-amount`}>
            SGD billed amount
          </Label>
          <Input
            id={`${controlId}-${row.id}-amount`}
            inputMode="decimal"
            value={hidden ? '' : row.amount}
            onChange={(event) => onEdit(row.id, 'amount', event.target.value)}
          />
        </div>
        <div className="w-full max-w-40 min-w-0 space-y-1 sm:col-span-4">
          <Label htmlFor={`${controlId}-${row.id}-date`}>Date</Label>
          <Input
            id={`${controlId}-${row.id}-date`}
            type="date"
            value={hidden ? '' : row.date}
            onChange={(event) => onEdit(row.id, 'date', event.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-8">
          <Label htmlFor={`${controlId}-${row.id}-category`}>Category</Label>
          <select
            id={`${controlId}-${row.id}-category`}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={row.category}
            onChange={(event) => onEdit(row.id, 'category', event.target.value)}
          >
            {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
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
            <PopoverContent className="text-sm">{issue}</PopoverContent>
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
            <Label htmlFor={`${controlId}-${row.id}-classification`}>
              Classification
            </Label>
            <select
              id={`${controlId}-${row.id}-classification`}
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-50"
              value={row.classification}
              disabled={row.isSummary}
              aria-describedby={`${controlId}-${row.id}-classification-reason`}
              onChange={(event) => onClassify(row.id, event.target.value)}
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
                  if (!canReveal() || save.locked(row.id) || save.busy) return;
                  onRestore(row.id);
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
                    hasRuleDraft &&
                    !window.confirm('Discard the unsaved rule draft?')
                  )
                    return;
                  onCreateRule(row, event.currentTarget);
                }}
              >
                Create rule
              </Button>
            </div>
          )}
        </div>
        <p
          id={`${controlId}-${row.id}-classification-reason`}
          className="text-muted-foreground text-sm"
        >
          {row.isSummary
            ? 'Not a transaction'
            : `Suggested: ${STATEMENT_CLASSIFICATIONS.find((entry) => entry.value === row.suggestedClassification)?.label}`}
          . {row.classificationReason}
        </p>
        {row.classification !== row.suggestedClassification && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>Your classification overrides the suggestion.</span>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => onClassify(row.id, row.suggestedClassification)}
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
              onApplySuggestion(row.id, suggestion, replace)
            }
          />
        )}
      </details>
    </fieldset>
  );
}
