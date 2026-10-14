'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { useId, useState } from 'react';
import { MERCHANT_BANKS, MERCHANT_RULE_LIMITS } from '../constants';
import type { useMerchantRulebook } from '../hooks/use-merchant-rulebook';
import { matchMerchantRules } from '../lib/matching';
import { merchantRuleSchema } from '../schemas';
import type { MerchantBank, MerchantRule } from '../types';

type Props = {
  embedded?: boolean;
  rulebook: ReturnType<typeof useMerchantRulebook>;
  draft: MerchantRule | null;
  onDraft: (rule: MerchantRule | null) => void;
  examples: Array<{ description: string; bank: MerchantBank }>;
};

export function MerchantRuleManager({
  rulebook,
  draft,
  onDraft,
  examples,
  embedded = false,
}: Props) {
  const { hidden, canReveal } = useAmountVisibility();
  const id = useId();
  const [expanded, setExpanded] = useState(embedded);
  const [error, setError] = useState('');
  const rules = rulebook.book?.payload.rules ?? [];
  function change(value: Partial<MerchantRule>) {
    if (draft && rulebook.canEdit && canReveal()) {
      onDraft({ ...draft, ...value });
      setError('');
    }
  }
  function discardDraft() {
    return !draft || window.confirm('Discard the unsaved rule draft?');
  }
  async function saveDraft() {
    if (!canReveal() || !rulebook.canEdit || !draft) return;
    const parsed = merchantRuleSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the rule fields.');
      return;
    }
    const next = rules.some((rule) => rule.id === draft.id)
      ? rules.map((rule) => (rule.id === draft.id ? parsed.data : rule))
      : [...rules, parsed.data];
    if (await rulebook.save(next)) onDraft(null);
  }
  const matches = draft
    ? examples.filter(
        (example) =>
          matchMerchantRules(example.description, example.bank, [
            { ...draft, enabled: true },
          ]).status !== 'none'
      )
    : [];
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Merchant rules">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Merchant rules</h3>
          <Button
            type="button"
            variant="outline"
            disabled={hidden}
            aria-expanded={expanded || !!draft}
            aria-controls={`${id}-manager`}
            onClick={() => canReveal() && setExpanded(!expanded)}
          >
            {expanded ? 'Collapse rules' : 'Manage rules'}
          </Button>
        </div>
      )}
      {!embedded && (
        <p className="text-muted-foreground text-sm">
          Saved rules fill matching statement drafts automatically, preserving
          your manual edits.
        </p>
      )}
      {!hidden && (
        <p role="status" className="text-sm">
          {rulebook.stage === 'loading'
            ? 'Loading saved rules…'
            : rulebook.message}
        </p>
      )}
      {!hidden && rulebook.stage === 'error' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void rulebook.load()}
        >
          Load rules again
        </Button>
      )}
      {!hidden && rulebook.stage === 'unconfirmed' && (
        <Button
          type="button"
          variant="outline"
          disabled={rulebook.busy}
          onClick={async () => {
            if (await rulebook.check()) onDraft(null);
          }}
        >
          Check saved rules
        </Button>
      )}
      {!hidden && rulebook.stage === 'conflict' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (canReveal() && discardDraft()) {
              onDraft(null);
              void rulebook.load();
            }
          }}
        >
          Reload latest rules
        </Button>
      )}
      {!hidden && (expanded || draft !== null) && (
        <div id={`${id}-manager`} className="space-y-4">
          <details className="text-muted-foreground text-sm">
            <summary className="cursor-pointer">
              Rule matching and limits
            </summary>
            <p className="mt-2">
              Up to {MERCHANT_RULE_LIMITS.rules} rules; text fields allow 256
              characters and the rulebook allows 128 KiB. Exact matches take
              precedence. Conflicting suggestions require your choice.
            </p>
          </details>
          {(!embedded || !draft) && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !rulebook.canEdit ||
                  rules.length >= MERCHANT_RULE_LIMITS.rules
                }
                onClick={() => {
                  if (!canReveal() || !discardDraft()) return;
                  setError('');
                  onDraft({
                    id: crypto.randomUUID(),
                    label: '',
                    enabled: true,
                    matchMode: 'exact',
                    matchText: '',
                    bank: null,
                    displayName: null,
                    category: 'other',
                  });
                }}
              >
                New rule
              </Button>
              {rules.length === 0 && rulebook.stage === 'ready' && (
                <p className="text-sm">
                  No saved rules yet. Create one from a reviewed row or enter a
                  merchant below.
                </p>
              )}
              <ul className="divide-y">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium break-words">{rule.label}</p>
                      <p className="text-muted-foreground text-sm break-words">
                        {rule.matchMode === 'exact' ? 'Exact' : 'Phrase'}:{' '}
                        {rule.matchText} ·{' '}
                        {rule.bank?.toUpperCase() ?? 'All banks'} ·{' '}
                        {rule.enabled ? 'Active' : 'Paused'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!rulebook.canEdit}
                        aria-label={`Edit rule ${rule.label}`}
                        onClick={() => {
                          if (canReveal() && discardDraft()) {
                            onDraft({ ...rule });
                            setError('');
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!rulebook.canEdit || draft !== null}
                        aria-label={`Delete rule ${rule.label}`}
                        onClick={() => {
                          if (
                            canReveal() &&
                            window.confirm(
                              'Delete this merchant rule? Existing expenses will stay unchanged.'
                            )
                          )
                            void rulebook.save(
                              rules.filter((entry) => entry.id !== rule.id)
                            );
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {draft && (
            <fieldset
              disabled={!rulebook.canEdit}
              className={
                embedded ? 'space-y-3' : 'space-y-3 rounded-md border p-3'
              }
            >
              <legend className={embedded ? 'sr-only' : 'px-1 text-sm'}>
                {rules.some((rule) => rule.id === draft.id)
                  ? 'Edit rule'
                  : 'New rule'}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${id}-label`}>Rule name</Label>
                  <Input
                    id={`${id}-label`}
                    maxLength={256}
                    value={draft.label}
                    onChange={(e) => change({ label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-bank`}>Bank scope</Label>
                  <select
                    id={`${id}-bank`}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={draft.bank ?? ''}
                    onChange={(e) =>
                      change({
                        bank:
                          MERCHANT_BANKS.find(
                            (bank) => bank === e.target.value
                          ) ?? null,
                      })
                    }
                  >
                    <option value="">All banks</option>
                    {MERCHANT_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-match`}>Matching words</Label>
                  <Input
                    id={`${id}-match`}
                    maxLength={256}
                    value={draft.matchText}
                    onChange={(e) => change({ matchText: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-mode`}>Match type</Label>
                  <select
                    id={`${id}-mode`}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={draft.matchMode}
                    onChange={(e) =>
                      change({
                        matchMode:
                          e.target.value === 'exact' ? 'exact' : 'phrase',
                      })
                    }
                  >
                    <option value="exact">Exact text</option>
                    <option value="phrase">Contains these words</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-display`}>Merchant name</Label>
                  <Input
                    id={`${id}-display`}
                    maxLength={256}
                    value={draft.displayName ?? ''}
                    onChange={(e) =>
                      change({ displayName: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-category`}>Suggested category</Label>
                  <select
                    id={`${id}-category`}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={draft.category ?? ''}
                    onChange={(e) => {
                      const category = Object.keys(EXPENSE_TYPE_LABELS).find(
                        (key) => key === e.target.value
                      ) as MerchantRule['category'] | undefined;
                      change({ category: category ?? null });
                    }}
                  >
                    <option value="">Keep current category</option>
                    {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {rules.some((rule) => rule.id === draft.id) && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => change({ enabled: e.target.checked })}
                  />
                  Apply this rule automatically
                </label>
              )}
              <p className="text-muted-foreground text-sm">
                Rule name identifies this rule. Merchant name becomes the
                expense item; leave it blank to keep the description. Matching
                ignores case and repeated spaces.
              </p>
              <div className="space-y-1 text-sm">
                <p>{matches.length} matching source rows in this statement:</p>
                <ul className="list-inside list-disc">
                  {matches.slice(0, 5).map((match, index) => (
                    <li key={index} className="break-words">
                      {match.description}
                    </li>
                  ))}
                </ul>
                {matches.length > 5 && (
                  <p>
                    More matches are present. Review the source rows before
                    saving a broad rule.
                  </p>
                )}
              </div>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveDraft()}>
                  Save rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (canReveal() && discardDraft()) onDraft(null);
                  }}
                >
                  Cancel rule edit
                </Button>
              </div>
            </fieldset>
          )}
        </div>
      )}
    </section>
  );
}
