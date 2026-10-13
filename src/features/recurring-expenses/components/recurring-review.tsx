'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { useId, useState } from 'react';
import { RECURRING_LIMITS } from '../constants';
import {
  useRecurringExpenseLinks,
  useRecurringRulebook,
} from '../hooks/use-recurring-rulebook';
import {
  occurrenceState,
  previousRecurringMonth,
  recurringDate,
  singaporeToday,
} from '../lib/calendar';
import type {
  RecurringDefinition,
  RecurringExpense,
  RecurringReceipt,
} from '../types';
import { RecurringOccurrenceEditor } from './recurring-occurrence-editor';
import { RecurringTemplateEditor } from './recurring-template-editor';

type Draft =
  | { kind: 'create' | 'edit'; definition: RecurringDefinition }
  | {
      kind: 'confirm';
      templateId: string;
      month: string;
      name: string;
      expense: RecurringExpense;
    };

export function RecurringReview() {
  const { hidden, canReveal } = useAmountVisibility();
  const [opened, setOpened] = useState(false);
  const id = useId();
  return (
    <section
      aria-label="Recurring expenses"
      className="space-y-3 border-t pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Recurring expenses</h2>
          <p className="text-muted-foreground text-sm">
            Review monthly bills and subscriptions before recording each
            payment.
          </p>
        </div>
        {!opened && (
          <Button
            type="button"
            variant="outline"
            disabled={hidden}
            aria-controls={id}
            aria-expanded={false}
            onClick={() => {
              if (canReveal()) setOpened(true);
            }}
          >
            Review monthly templates
          </Button>
        )}
      </div>
      {opened && (
        <div id={id}>
          <RecurringReviewBody onClose={() => setOpened(false)} />
        </div>
      )}
    </section>
  );
}

function RecurringReviewBody({ onClose }: { onClose: () => void }) {
  const privacy = useAmountVisibility();
  const rulebook = useRecurringRulebook();
  const links = useRecurringExpenseLinks();
  const id = useId();
  const today = singaporeToday();
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [draft, setDraft] = useState<Draft | null>(null);
  const templates = rulebook.book?.payload.templates ?? [];
  const earliest = templates.reduce(
    (value, entry) =>
      [
        ...entry.occurrences.map((receipt) => receipt.month),
        entry.definition.startMonth,
      ].reduce(
        (first, candidate) => (candidate < first ? candidate : first),
        value
      ),
    currentMonth
  );
  const receiptCount = templates.reduce(
    (total, entry) => total + entry.occurrences.length,
    0
  );
  const canEdit = rulebook.canEdit && !draft;
  function discard() {
    return (
      !draft ||
      window.confirm(
        'Discard this unsaved recurring draft? An unconfirmed submission may still complete.'
      )
    );
  }
  function newTemplate(initial?: RecurringDefinition) {
    if (!privacy.canReveal() || !canEdit) return;
    setDraft({
      kind: 'create',
      definition: initial
        ? {
            ...initial,
            id: crypto.randomUUID(),
            name: initial.name.slice(0, 73) + ' (copy)',
          }
        : {
            id: crypto.randomUUID(),
            name: '',
            enabled: true,
            preferredDay: Number(today.slice(8)),
            startMonth: currentMonth,
            endMonth: null,
            cents: 100,
            category: 'bills',
            item: '',
            info: '',
          },
    });
  }
  function linkStatus(receipt: RecurringReceipt) {
    if (!receipt.expense) return '';
    if (!links.rows) return 'Linked expense has not been checked.';
    const expected = receipt.expense;
    const actual = links.rows.find((entry) => entry.id === expected.id);
    if (!actual)
      return 'Linked expense is missing. This occurrence remains confirmed.';
    const matches =
      actual.date.slice(0, 10) === expected.date &&
      actual.type === expected.category &&
      actual.item === expected.item &&
      actual.info === expected.info &&
      Math.round(actual.amount * 100) === expected.cents &&
      actual.splitType === 'self' &&
      actual.splits.length === 0;
    return matches
      ? 'Linked expense matches this receipt.'
      : 'Linked expense has changed. This receipt keeps the original confirmed values.';
  }
  return (
    <div className="space-y-4">
      {privacy.hidden ? (
        <p className="text-muted-foreground text-sm">
          Show amounts to review recurring expenses. Any draft is retained.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-month`}>Occurrence month</Label>
              <Input
                id={`${id}-month`}
                type="month"
                value={month}
                min={earliest}
                max={currentMonth}
                disabled={!canEdit}
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    privacy.canReveal() &&
                    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
                    value >= earliest &&
                    value <= currentMonth
                  )
                    setMonth(value);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || month <= earliest}
              onClick={() => {
                if (privacy.canReveal())
                  setMonth(previousRecurringMonth(month));
              }}
            >
              Earlier month
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || month === currentMonth}
              onClick={() => {
                if (privacy.canReveal()) setMonth(currentMonth);
              }}
            >
              Current month
            </Button>
            <Button
              type="button"
              disabled={
                !canEdit || templates.length >= RECURRING_LIMITS.templates
              }
              onClick={() => newTemplate()}
            >
              New monthly template
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Singapore dates · Only due payments can be confirmed or skipped.
            Earlier months require individual review.
          </p>
          <p role="status" className="text-sm">
            {rulebook.stage === 'loading'
              ? 'Loading monthly templates…'
              : rulebook.message}
          </p>
          {rulebook.stage === 'error' && (
            <Button
              type="button"
              variant="outline"
              disabled={rulebook.busy}
              onClick={() => void rulebook.load()}
            >
              Reload templates
            </Button>
          )}
          {rulebook.stage === 'unconfirmed' && (
            <Button
              type="button"
              variant="outline"
              disabled={rulebook.busy}
              onClick={async () => {
                if (await rulebook.check()) setDraft(null);
              }}
            >
              Check saved occurrence
            </Button>
          )}
          {rulebook.stage === 'conflict' && (
            <Button
              type="button"
              variant="outline"
              disabled={rulebook.busy}
              onClick={() => {
                if (privacy.canReveal() && discard()) {
                  setDraft(null);
                  void rulebook.load();
                }
              }}
            >
              Reload latest templates
            </Button>
          )}
          {rulebook.stage === 'ready' && templates.length === 0 && (
            <p className="text-sm">
              No monthly templates yet. Add a bill or subscription, then confirm
              each actual payment when it is due.
            </p>
          )}
          <ul className="divide-y">
            {templates.map((template) => {
              const definition = template.definition;
              const state = occurrenceState(template, month, today);
              const date = recurringDate(month, definition.preferredDay);
              const receipt = template.occurrences.find(
                (entry) => entry.month === month
              );
              return (
                <li key={definition.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium break-words">
                        {definition.name}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {template.archived
                          ? 'Archived'
                          : !definition.enabled
                            ? 'Disabled'
                            : state === 'due'
                              ? date < today
                                ? 'Overdue for review'
                                : 'Due for review'
                              : state === 'planned'
                                ? 'Planned'
                                : state === 'inactive'
                                  ? 'Outside schedule'
                                  : state === 'confirmed'
                                    ? 'Confirmed'
                                    : 'Skipped'}{' '}
                        · {date}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">
                      Expected SGD {(definition.cents / 100).toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm break-words">
                    {definition.item} ·{' '}
                    {EXPENSE_TYPE_LABELS[definition.category]}
                  </p>
                  {receipt && (
                    <div className="space-y-1 text-sm">
                      <p>
                        {receipt.outcome === 'skipped'
                          ? `Skipped ${month}; no expense recorded.`
                          : `Confirmed ${month} as SGD ${(receipt.expense.cents / 100).toFixed(2)} on ${receipt.expense.date}.`}
                      </p>
                      {receipt.expense && (
                        <>
                          <p className="break-words">
                            Recorded merchant: {receipt.expense.item}
                          </p>
                          <p>{linkStatus(receipt)}</p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {state === 'due' && (
                      <>
                        <Button
                          aria-label={`Review payment for ${definition.name}`}
                          type="button"
                          disabled={
                            !canEdit ||
                            receiptCount >= RECURRING_LIMITS.receipts
                          }
                          onClick={() => {
                            if (privacy.canReveal())
                              setDraft({
                                kind: 'confirm',
                                templateId: definition.id,
                                month,
                                name: definition.name,
                                expense: {
                                  id: crypto.randomUUID(),
                                  date,
                                  category: definition.category,
                                  item: definition.item,
                                  info: definition.info,
                                  cents: definition.cents,
                                },
                              });
                          }}
                        >
                          Review payment
                        </Button>
                        <Button
                          aria-label={`Skip ${definition.name} this month`}
                          type="button"
                          variant="outline"
                          disabled={
                            !canEdit ||
                            receiptCount >= RECURRING_LIMITS.receipts
                          }
                          onClick={() => {
                            if (
                              privacy.canReveal() &&
                              window.confirm(
                                `Skip ${definition.name} for ${month}? This month will stay skipped and no expense will be recorded.`
                              )
                            )
                              void rulebook.execute({
                                kind: 'skip',
                                templateId: definition.id,
                                month,
                              });
                          }}
                        >
                          Skip this month
                        </Button>
                      </>
                    )}
                    {!template.archived && (
                      <>
                        <Button
                          aria-label={`Edit ${definition.name}`}
                          type="button"
                          variant="outline"
                          disabled={!canEdit}
                          onClick={() => {
                            if (privacy.canReveal())
                              setDraft({
                                kind: 'edit',
                                definition: { ...definition },
                              });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          aria-label={`Archive ${definition.name}`}
                          type="button"
                          variant="outline"
                          disabled={!canEdit}
                          onClick={() => {
                            if (
                              privacy.canReveal() &&
                              window.confirm(
                                `Archive ${definition.name}? All confirmed and skipped history will be retained.`
                              )
                            )
                              void rulebook.execute({
                                kind: 'archive',
                                templateId: definition.id,
                              });
                          }}
                        >
                          Archive
                        </Button>
                      </>
                    )}
                    <Button
                      aria-label={`Clone ${definition.name}`}
                      type="button"
                      variant="outline"
                      disabled={
                        !canEdit ||
                        templates.length >= RECURRING_LIMITS.templates
                      }
                      onClick={() => {
                        if (
                          privacy.canReveal() &&
                          window.confirm(
                            'Create a separate monthly series? It can overlap this template and duplicate payments; compare each actual payment before confirming.'
                          )
                        )
                          newTemplate(definition);
                      }}
                    >
                      Clone
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {receiptCount > 0 && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={links.busy || !rulebook.canEdit}
                onClick={() => void links.check()}
              >
                Check linked expenses
              </Button>
              <p role="status" className="text-sm">
                {links.message}
              </p>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            {templates.length}/{RECURRING_LIMITS.templates} templates ·{' '}
            {receiptCount}/{RECURRING_LIMITS.receipts} retained occurrences ·
            512 KiB total capacity. Archiving preserves history and does not
            free capacity. Export includes all retained history.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!privacy.canReveal()) return;
              if (
                (draft ||
                  rulebook.stage === 'saving' ||
                  rulebook.stage === 'unconfirmed' ||
                  rulebook.stage === 'conflict') &&
                !window.confirm(
                  'Close recurring review? Unsaved drafts and this submission identity will be lost. A dispatched save may still complete; reload the saved history before starting another payment.'
                )
              )
                return;
              onClose();
            }}
          >
            Close recurring review
          </Button>
        </>
      )}
      {draft?.kind === 'confirm' && (
        <RecurringOccurrenceEditor
          key={draft.expense.id}
          initial={draft.expense}
          intendedMonth={draft.month}
          templateName={draft.name}
          disabled={!rulebook.canEdit}
          onCancel={() => setDraft(null)}
          onConfirm={async (expense) => {
            const saved = await rulebook.execute({
              kind: 'confirm',
              templateId: draft.templateId,
              month: draft.month,
              expense,
            });
            if (saved) setDraft(null);
            return saved;
          }}
        />
      )}
      {draft && draft.kind !== 'confirm' && (
        <RecurringTemplateEditor
          key={draft.definition.id}
          initial={draft.definition}
          disabled={!rulebook.canEdit}
          onCancel={() => setDraft(null)}
          onSave={async (definition) => {
            const saved = await rulebook.execute({
              kind: draft.kind,
              definition,
            });
            if (saved) setDraft(null);
            return saved;
          }}
        />
      )}
    </div>
  );
}
