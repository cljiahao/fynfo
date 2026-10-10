'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, ClipboardPaste, Plus, Zap } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUpsertExpense } from '../hooks/use-expenses';
import { parsePastedRow, type PasteIssue } from '../lib/paste-parser';
import { buildSelfExpense } from '../lib/utils';
import type { ExpenseType } from '../types';
import { ExpenseTypeSelect } from './expense-type-select';

export function ExpenseQuickAdd() {
  const upsert = useUpsertExpense();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateOpen, setDateOpen] = useState(false);
  const [type, setType] = useState<ExpenseType>('food_drink');
  const [item, setItem] = useState('');
  const [info, setInfo] = useState('');
  const [amount, setAmount] = useState('');
  const [pasted, setPasted] = useState(false);
  const [issues, setIssues] = useState<PasteIssue[]>([]);
  const feedbackId = useId();
  const invalidDate = issues.some((issue) => issue.field === 'date');
  const invalidAmount = issues.some((issue) => issue.field === 'amount');
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const instance = { active: true };
    lifetime.current = instance;
    return () => {
      instance.active = false;
    };
  }, []);

  const typeRef = useRef<HTMLInputElement>(null);
  const typeOpenRef = useRef(false);
  const itemRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setItem('');
    setInfo('');
    setAmount('');
    setPasted(false);
    setIssues([]);
    typeRef.current?.focus();
  };

  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t')) return;

    e.preventDefault();

    const rows = text
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0 && r.includes('\t'));

    if (rows.length === 0) {
      toast.error('Could not parse pasted content');
      return;
    }

    // Single row — fill form and auto-submit if complete
    if (rows.length === 1) {
      const parsed = parsePastedRow(rows[0]);
      if (Object.keys(parsed).length === 0) {
        toast.error('Could not parse pasted row');
        return;
      }

      setIssues(parsed.issues ?? []);
      const nextDate = parsed.date ?? date;
      const nextType = parsed.type ?? type;
      const nextItem = parsed.item ?? item;
      const nextInfo = parsed.info ?? info;
      const nextAmount = parsed.amount ?? amount;

      if (parsed.date) setDate(nextDate);
      if (parsed.type) setType(nextType);
      if (parsed.item !== undefined) setItem(nextItem);
      if (parsed.info !== undefined) setInfo(nextInfo);
      if (parsed.amount !== undefined) setAmount(nextAmount);

      const amountNum = Number(nextAmount);
      if (parsed.issues?.length) {
        setPasted(true);
        return;
      }
      const instance = lifetime.current;
      if (nextDate && Number.isFinite(amountNum) && amountNum > 0) {
        void upsert
          .mutateAsync(
            buildSelfExpense({
              date: nextDate,
              type: nextType,
              item: nextItem,
              info: nextInfo,
              amount: amountNum,
            })
          )
          .then(() => {
            if (instance.active) toast.success('Expense added from paste');
          })
          .catch(() => {
            if (instance.active)
              toast.error(
                'Expense save unconfirmed — check the list before retrying'
              );
          });
        resetForm();
      } else {
        setPasted(true);
        toast.info('Pasted — fill in the missing fields and press Enter');
      }
      return;
    }

    const parsed = rows.map(parsePastedRow);
    const valid = parsed.filter((p) => !p.issues?.length && p.date && p.amount);
    const skipped = parsed.length - valid.length;
    if (valid.length === 0) {
      toast.error('No valid rows with a date and amount — nothing submitted');
      return;
    }
    const instance = lifetime.current;
    const saves = valid.map((p) =>
      upsert.mutateAsync(
        buildSelfExpense({
          date: p.date!,
          type: p.type ?? type,
          item: p.item ?? '',
          info: p.info ?? '',
          amount: Number(p.amount!),
        })
      )
    );
    // Each paste owns its settled results; optimistic rows are not confirmed saves.
    void Promise.allSettled(saves).then((results) => {
      if (!instance.active) return;
      const confirmed = results.filter(
        (result) => result.status === 'fulfilled'
      ).length;
      const unconfirmed = results.length - confirmed;
      const message = `${confirmed} confirmed, ${unconfirmed} unconfirmed, ${skipped} skipped`;
      if (unconfirmed > 0 || confirmed === 0)
        toast.error(message + '. Check the list before retrying.');
      else toast.success(message);
    });
    resetForm();
  };
  const handleSubmit = () => {
    if (issues.length > 0) return;
    const amountNum = Number(amount);
    if (!date || !Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Date and amount are required');
      return;
    }

    // Fire-and-forget: the hook's `onMutate` inserts the row optimistically and
    // `onError` rolls it back, so we clear the form immediately for the next row
    // instead of waiting on the server round-trip.
    const instance = lifetime.current;
    void upsert
      .mutateAsync(
        buildSelfExpense({ date, type, item, info, amount: amountNum })
      )
      .then(() => {
        if (instance.active) toast.success('Expense added');
      })
      .catch(() => {
        if (instance.active)
          toast.error(
            'Expense save unconfirmed — check the list before retrying'
          );
      });
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !typeOpenRef.current && !dateOpen) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="border-primary/20 bg-primary/5 rounded-xl border-2 p-4"
      onPaste={handleContainerPaste}
    >
      <div className="flex-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex-center bg-primary size-7 rounded-lg">
            <Zap className="text-primary-foreground size-3.5" />
          </div>
          <span className="text-sm font-semibold">Quick Add Expense</span>
          {pasted && (
            <span className="bg-gain-subtle text-gain-strong flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
              <ClipboardPaste className="size-3" />
              Pasted from Excel
            </span>
          )}
        </div>
        <span className="text-muted-foreground hidden text-xs sm:block">
          <kbd className="bg-background rounded border px-1.5 py-0.5 font-mono text-[11px]">
            ↵ Enter
          </kbd>{' '}
          to add &middot;{' '}
          <kbd className="bg-background rounded border px-1.5 py-0.5 font-mono text-[11px]">
            Tab
          </kbd>{' '}
          to advance &middot;{' '}
          <kbd className="bg-background rounded border px-1.5 py-0.5 font-mono text-[11px]">
            ⌘V
          </kbd>{' '}
          to paste row
        </span>
      </div>

      {issues.length > 0 && (
        <p
          id={feedbackId}
          role="alert"
          className="text-loss-strong mb-3 text-sm"
        >
          {invalidDate && 'Choose a valid date. '}
          {invalidAmount &&
            (issues.some((issue) => issue.code === 'UNSUPPORTED_CREDIT')
              ? 'Credits cannot be added as expenses. Enter a positive expense amount to continue.'
              : 'Enter a valid positive amount.')}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            htmlFor={feedbackId + '-date'}
            className="text-muted-foreground block text-xs font-medium"
          >
            Date
          </label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id={feedbackId + '-date'}
                aria-invalid={invalidDate || undefined}
                aria-describedby={invalidDate ? feedbackId : undefined}
                variant="outline"
                className={cn(
                  'bg-background h-9 w-[140px] justify-start gap-2 text-sm font-normal',
                  !date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="size-3.5" />
                {date ? format(new Date(date), 'dd MMM yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                defaultMonth={date ? new Date(date) : undefined}
                selected={date ? new Date(date) : undefined}
                onSelect={(d) => {
                  if (d) {
                    setDate(format(d, 'yyyy-MM-dd'));
                    setIssues((current) =>
                      current.filter((issue) => issue.field !== 'date')
                    );
                    setDateOpen(false);
                  }
                }}
                initialFocus
              />
              <div className="border-border border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDate(format(new Date(), 'yyyy-MM-dd'));
                    setIssues((current) =>
                      current.filter((issue) => issue.field !== 'date')
                    );
                    setDateOpen(false);
                  }}
                >
                  Today
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Category
          </label>
          <ExpenseTypeSelect
            value={type}
            onChange={setType}
            onSubmit={handleSubmit}
            onAfterSelect={() => itemRef.current?.focus()}
            onOpenChange={(open) => {
              typeOpenRef.current = open;
            }}
            className="w-[155px]"
            inputClassName="bg-background text-sm"
            inputRef={typeRef}
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Item / Brand
          </label>
          <Input
            ref={itemRef}
            value={item}
            onChange={(e) => setItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Grab, NTUC"
            className="bg-background h-9 w-[140px] text-sm"
          />
        </div>
        <div className="min-w-[120px] flex-1 space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Notes
          </label>
          <Input
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Optional description"
            className="bg-background h-9 w-full text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={feedbackId + '-amount'}
            className="text-muted-foreground text-xs font-medium"
          >
            Amount (SGD)
          </label>
          <Input
            id={feedbackId + '-amount'}
            aria-invalid={invalidAmount || undefined}
            aria-describedby={invalidAmount ? feedbackId : undefined}
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              setAmount(value);
              if (Number.isFinite(Number(value)) && Number(value) > 0) {
                setIssues((current) =>
                  current.filter((issue) => issue.field !== 'amount')
                );
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            placeholder="0.00"
            className="bg-background h-9 w-[110px] text-right text-sm tabular-nums"
          />
        </div>
        <Button
          className="h-9 shrink-0"
          onClick={handleSubmit}
          disabled={upsert.isPending || issues.length > 0}
        >
          <Plus className="mr-1.5 size-4" />
          Add Expense
        </Button>
      </div>
    </div>
  );
}
