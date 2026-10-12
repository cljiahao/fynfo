'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AmountsHiddenNotice,
  FinancialValue,
  useAmountVisibility,
} from '@/features/privacy';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';
import { useId, useState } from 'react';
import {
  calculateReserve,
  compareBudget,
  parseContributionCount,
  parsePlanningAmount,
  type BudgetSpending,
} from '../lib/budget-reserve';

export interface BudgetReserveWorksheetProps {
  month: string;
  spending: BudgetSpending | null;
  availability: 'ready' | 'loading' | 'error' | 'invalid-month';
}

function formatCents(cents: number) {
  const value = BigInt(cents);
  const whole = Number(value / BigInt(100)).toLocaleString('en-SG');
  return `SGD ${whole}.${String(value % BigInt(100)).padStart(2, '0')}`;
}

export function BudgetReserveWorksheet({
  month,
  spending,
  availability,
}: BudgetReserveWorksheetProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const id = useId();
  const [limit, setLimit] = useState({ month, raw: '' });
  const [target, setTarget] = useState('');
  const [reserved, setReserved] = useState('');
  const [count, setCount] = useState('');
  // A new review period cannot inherit another month's private limit.
  if (limit.month !== month) setLimit({ month, raw: '' });
  const limitInput = parsePlanningAmount(
    limit.month === month ? limit.raw : ''
  );
  const targetInput = parsePlanningAmount(target);
  const reservedInput = parsePlanningAmount(reserved);
  const countInput = parseContributionCount(count);
  const comparison =
    limitInput.status === 'valid' && spending && availability === 'ready'
      ? compareBudget(limitInput.value, spending)
      : null;
  const reserve =
    targetInput.status === 'valid' &&
    reservedInput.status === 'valid' &&
    countInput.status === 'valid'
      ? calculateReserve(
          targetInput.value,
          reservedInput.value,
          countInput.value
        )
      : null;

  function amountField(
    label: string,
    name: string,
    raw: string,
    update: (value: string) => void
  ) {
    const parsed = parsePlanningAmount(raw);
    return (
      <div className="space-y-2">
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        <Input
          id={`${id}-${name}`}
          type="text"
          inputMode="decimal"
          value={hidden ? '' : raw}
          disabled={hidden}
          placeholder={hidden ? 'Hidden' : 'Enter amount'}
          aria-invalid={parsed.status === 'invalid'}
          aria-describedby={
            parsed.status === 'invalid' ? `${id}-${name}-error` : undefined
          }
          onChange={(event) => {
            if (canReveal()) update(event.target.value);
          }}
        />
        {parsed.status === 'invalid' && (
          <p
            id={`${id}-${name}-error`}
            role="alert"
            className="text-destructive text-sm"
          >
            Enter a nonnegative SGD amount with at most two decimal places and
            within the supported range.
          </p>
        )}
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="budget-reserve">
        <AccordionTrigger>Budget and annual reserve plan</AccordionTrigger>
        <AccordionContent className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Session only — inputs clear when you leave this page, lock your
            vault, switch accounts or reload.
          </p>
          <AmountsHiddenNotice />
          <div className="space-y-4">
            <h3 className="font-medium">Monthly budget · {month}</h3>
            {amountField(
              'Monthly spending limit (SGD)',
              'limit',
              limit.month === month ? limit.raw : '',
              (raw) => setLimit({ month, raw })
            )}
            <div className="space-y-2" aria-live="polite">
              {availability === 'loading' ? (
                <p role="status">Loading recorded spending…</p>
              ) : availability === 'error' ? (
                <p role="alert">
                  Recorded spending is unavailable. Retry monthly review before
                  comparing your limit.
                </p>
              ) : availability === 'invalid-month' ? (
                <p role="alert">
                  Choose a valid month before comparing your limit.
                </p>
              ) : spending?.status === 'invalid' ? (
                <div role="alert">
                  <p>
                    Check expense amounts and shared splits before comparing
                    totals.
                  </p>
                  {spending.message && <p>{spending.message}</p>}
                  <Link
                    className="underline underline-offset-4"
                    href={PAGE_ROUTES.EXPENSES}
                  >
                    Review expenses
                  </Link>
                </div>
              ) : spending?.status === 'not-recorded' ? (
                <p>Recorded spending · your share: Not recorded</p>
              ) : spending?.status === 'recorded' ? (
                <p>
                  Recorded spending · your share:{' '}
                  <FinancialValue>{formatCents(spending.cents)}</FinancialValue>
                </p>
              ) : null}
              {limitInput.status === 'unset' && (
                <p className="text-muted-foreground">
                  Enter your own monthly limit to compare recorded spending.
                </p>
              )}
              {comparison &&
                (comparison.status === 'within-limit' ||
                  comparison.status === 'over-limit') && (
                  <p className="font-medium">
                    {hidden
                      ? 'Budget comparison'
                      : comparison.status === 'over-limit'
                        ? 'Recorded spending above your limit'
                        : 'Remaining against recorded spending'}
                    :{' '}
                    <FinancialValue>
                      {formatCents(Math.abs(comparison.remainingCents))}
                    </FinancialValue>
                  </p>
                )}
            </div>
            <p className="text-muted-foreground text-xs">
              Includes all recorded expense categories for this month and
              excludes other people’s shares, whether settled or not. Missing
              records do not mean zero spending. This comparison is not
              spendable cash or a completed, reconciled month. Changing month
              clears only the monthly limit.
            </p>
          </div>
          <div className="space-y-4 border-t pt-5">
            <h3 className="font-medium">Annual reserve calculation</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {amountField(
                'Annual cost target (SGD)',
                'target',
                target,
                setTarget
              )}
              {amountField(
                'Amount already reserved (SGD)',
                'reserved',
                reserved,
                setReserved
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-count`}>
                Remaining planned contributions
              </Label>
              <Input
                id={`${id}-count`}
                type="text"
                inputMode="numeric"
                value={hidden ? '' : count}
                disabled={hidden}
                placeholder={hidden ? 'Hidden' : 'Enter a count from 1 to 12'}
                aria-invalid={countInput.status === 'invalid'}
                aria-describedby={
                  countInput.status === 'invalid'
                    ? `${id}-count-error`
                    : undefined
                }
                onChange={(event) => {
                  if (canReveal()) setCount(event.target.value);
                }}
              />
              {countInput.status === 'invalid' && (
                <p
                  id={`${id}-count-error`}
                  role="alert"
                  className="text-destructive text-sm"
                >
                  Enter a whole contribution count from 1 to 12.
                </p>
              )}
            </div>
            {!reserve && (
              <p className="text-muted-foreground text-sm">
                Enter the target, amount already reserved and contribution count
                to calculate your plan. Enter zero explicitly if nothing is
                reserved.
              </p>
            )}
            {reserve && reserve.status !== 'invalid' && (
              <div className="space-y-2" aria-live="polite">
                <p className="font-medium">
                  {hidden
                    ? 'Reserve calculation'
                    : reserve.status === 'covered'
                      ? 'Target covered by the amount entered'
                      : 'Still to reserve'}
                  :{' '}
                  <FinancialValue>
                    {formatCents(reserve.remainingCents)}
                  </FinancialValue>
                </p>
                <p>
                  Planned amount per contribution:{' '}
                  <FinancialValue>
                    {formatCents(reserve.regularContributionCents)}
                  </FinancialValue>
                </p>
                <p>
                  Chosen contributions:{' '}
                  <FinancialValue>
                    {countInput.status === 'valid' ? countInput.value : ''}
                  </FinancialValue>
                </p>
                <p>
                  Final contribution:{' '}
                  <FinancialValue>
                    {formatCents(reserve.finalContributionCents)}
                  </FinancialValue>
                </p>
                <p>
                  Contribution schedule:{' '}
                  <FinancialValue>
                    {reserve.contributionsCents.map(formatCents).join(' · ')}
                  </FinancialValue>
                </p>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              This is arithmetic for your chosen target, not advice or a
              forecast. No payment dates or future income are assumed.
              Contributions are rounded up to cents, capped at the remaining
              target; the final contribution is adjusted, and later slots may be
              zero if the target is already covered. No money is moved or
              reserved. Your entered reserve may already be included in recorded
              assets and does not change spending, salary or investment
              allocation.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
