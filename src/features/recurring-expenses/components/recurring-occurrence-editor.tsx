'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_TYPE_LABELS, getExpenses } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { useEffect, useId, useRef, useState } from 'react';
import { recurringExpenseSchema } from '../schemas';
import type { RecurringExpense } from '../types';

export function RecurringOccurrenceEditor({
  initial,
  intendedMonth,
  templateName,
  disabled,
  onConfirm,
  onCancel,
}: {
  initial: RecurringExpense;
  intendedMonth: string;
  templateName: string;
  disabled: boolean;
  onConfirm: (expense: RecurringExpense) => Promise<boolean>;
  onCancel: () => void;
}) {
  const privacy = useAmountVisibility();
  const id = useId();
  const alive = useRef(false);
  const operation = useRef(0);
  const [expense, setExpense] = useState(initial);
  const [amount, setAmount] = useState((initial.cents / 100).toFixed(2));
  const [checked, setChecked] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  useEffect(() => {
    const currentOperation = operation;
    alive.current = true;
    return () => {
      alive.current = false;
      currentOperation.current++;
    };
  }, []);
  useEffect(() => {
    if (privacy.hidden) {
      operation.current++;
      running.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- audit 152 §Phase 3 lint suppressions: intentional sync with the privacy or rulebook signal
      setReading(false);
      setChecked('');
      setAcknowledged(false);
    }
  }, [privacy.hidden]);
  const parsed = recurringExpenseSchema.safeParse({
    ...expense,
    cents: Math.round(Number(amount) * 100),
  });
  const signature = JSON.stringify({ expense, amount });
  function invalidate() {
    setChecked('');
    setAcknowledged(false);
  }
  function change(value: Partial<RecurringExpense>) {
    if (privacy.canReveal() && !disabled && !running.current) {
      setExpense((current) => ({ ...current, ...value }));
      invalidate();
      setMessage('');
    }
  }
  async function compare() {
    if (
      !privacy.canReveal() ||
      disabled ||
      running.current ||
      !parsed.success ||
      !/^\d+\.\d{2}$/.test(amount)
    )
      return;
    running.current = true;
    setReading(true);
    setMessage('');
    const epoch = privacy.getHideEpoch();
    const op = ++operation.current;
    try {
      const rows = await getExpenses();
      if (
        !alive.current ||
        operation.current !== op ||
        !privacy.canReveal() ||
        privacy.getHideEpoch() !== epoch
      )
        return;
      const normalize = (value: string) =>
        value.trim().replace(/\s+/g, ' ').toLowerCase();
      const possible = rows.some(
        (row) =>
          row.date.slice(0, 10) === expense.date &&
          Math.round(row.amount * 100) === parsed.data.cents &&
          normalize(row.item) === normalize(expense.item)
      );
      setDuplicate(possible);
      setChecked(signature);
      setAcknowledged(false);
      setMessage(
        possible
          ? 'Possible existing expense. Compare the saved record before acknowledging.'
          : 'No possible match found in this read. Other templates or manual entries can still duplicate a payment.'
      );
    } catch {
      if (
        alive.current &&
        operation.current === op &&
        privacy.canReveal() &&
        privacy.getHideEpoch() === epoch
      ) {
        invalidate();
        setMessage(
          'Expenses could not be checked. Check again before confirming.'
        );
      }
    } finally {
      if (operation.current === op) {
        running.current = false;
        if (alive.current) {
          setReading(false);
          if (privacy.getHideEpoch() !== epoch) invalidate();
        }
      }
    }
  }
  if (privacy.hidden) return null;
  return (
    <fieldset
      disabled={disabled || reading}
      className="space-y-3 rounded-md border p-3"
    >
      <legend className="px-1 text-sm">Review actual payment</legend>
      <p className="text-sm break-words">
        {templateName} · Intended occurrence: {intendedMonth} · Self expense in
        SGD
      </p>
      <p className="text-muted-foreground text-sm">
        Confirm only an actual expense. Editing the payment date keeps this
        intended month; it does not record another month.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Actual expense date</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={expense.date}
            onChange={(e) => change({ date: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-amount`}>Actual SGD amount</Label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              if (privacy.canReveal() && !disabled && !running.current) {
                setAmount(e.target.value);
                invalidate();
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-item`}>Actual merchant</Label>
          <Input
            id={`${id}-item`}
            maxLength={256}
            value={expense.item}
            onChange={(e) => change({ item: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-category`}>Actual category</Label>
          <select
            id={`${id}-category`}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={expense.category}
            onChange={(e) =>
              change({
                category: e.target.value as RecurringExpense['category'],
              })
            }
          >
            {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-notes`}>Actual notes</Label>
          <Input
            id={`${id}-notes`}
            maxLength={4096}
            value={expense.info}
            onChange={(e) => change({ info: e.target.value })}
          />
        </div>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {duplicate && checked === signature && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              if (privacy.canReveal()) setAcknowledged(e.target.checked);
            }}
          />
          I compared the possible existing expense and want to record this
          occurrence.
        </label>
      )}
      {(!parsed.success || !/^\d+\.\d{2}$/.test(amount)) && (
        <p className="text-destructive text-sm">
          Enter a valid date, merchant and positive SGD amount with exactly two
          decimals.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!parsed.success || !/^\d+\.\d{2}$/.test(amount)}
          onClick={() => void compare()}
        >
          Check possible duplicates
        </Button>
        <Button
          type="button"
          disabled={
            !parsed.success ||
            checked !== signature ||
            (duplicate && !acknowledged)
          }
          onClick={() => {
            if (privacy.canReveal() && parsed.success)
              void onConfirm(parsed.data);
          }}
        >
          Confirm and save occurrence
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (
              privacy.canReveal() &&
              window.confirm('Discard this unsaved actual-payment draft?')
            )
              onCancel();
          }}
        >
          Cancel occurrence review
        </Button>
      </div>
    </fieldset>
  );
}
