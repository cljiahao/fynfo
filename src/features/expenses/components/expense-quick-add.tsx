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
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUpsertExpense } from '../hooks/use-expenses';
import { parsePastedRow } from '../lib/paste-parser';
import { generateId } from '../lib/utils';
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

  const typeRef = useRef<HTMLInputElement>(null);
  const typeOpenRef = useRef(false);
  const itemRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setItem('');
    setInfo('');
    setAmount('');
    setPasted(false);
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

      const amountNum = parseFloat(nextAmount);
      if (nextDate && amountNum > 0) {
        upsert
          .mutateAsync({
            id: generateId(),
            date: nextDate,
            type: nextType,
            item: nextItem,
            info: nextInfo,
            amount: amountNum,
            splitType: 'self',
            splits: [],
          })
          .then(() => {
            toast.success('Expense added from paste');
            resetForm();
          })
          .catch(() => {
            toast.error('Failed to add expense');
            setPasted(true);
          });
      } else {
        setPasted(true);
        toast.info('Pasted — fill in the missing fields and press Enter');
      }
      return;
    }

    // Multiple rows — parse all, submit valid ones, report skipped
    const parsed = rows.map(parsePastedRow);
    const valid = parsed.filter(
      (p) => p.date && p.amount && parseFloat(p.amount) > 0
    );
    const skipped = parsed.length - valid.length;

    if (valid.length === 0) {
      toast.error('No rows had both a date and an amount — nothing added');
      return;
    }

    Promise.all(
      valid.map((p) =>
        upsert.mutateAsync({
          id: generateId(),
          date: p.date!,
          type: p.type ?? type,
          item: p.item ?? '',
          info: p.info ?? '',
          amount: parseFloat(p.amount!),
          splitType: 'self',
          splits: [],
        })
      )
    )
      .then(() => {
        const msg =
          skipped > 0
            ? `${valid.length} expense${valid.length > 1 ? 's' : ''} added, ${skipped} skipped (missing date or amount)`
            : `${valid.length} expense${valid.length > 1 ? 's' : ''} added`;
        toast.success(msg);
        resetForm();
      })
      .catch(() => {
        toast.error('Some expenses failed to save');
      });
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!date || !amountNum || amountNum <= 0) {
      toast.error('Date and amount are required');
      return;
    }

    try {
      await upsert.mutateAsync({
        id: generateId(),
        date,
        type,
        item,
        info,
        amount: amountNum,
        splitType: 'self',
        splits: [],
      });
      toast.success('Expense added');
      resetForm();
    } catch {
      toast.error('Failed to add expense');
    }
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
      {/* Header */}
      <div className="flex-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex-center bg-primary size-7 rounded-lg">
            <Zap className="text-primary-foreground size-3.5" />
          </div>
          <span className="text-sm font-semibold">Quick Add Expense</span>
          {pasted && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
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

      {/* Fields */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Date */}
        <div className="space-y-1">
          <label className="text-muted-foreground block text-xs font-medium">
            Date
          </label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
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
                selected={date ? new Date(date) : undefined}
                onSelect={(d) => {
                  if (d) {
                    setDate(format(d, 'yyyy-MM-dd'));
                    setDateOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Category combobox */}
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

        {/* Item */}
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

        {/* Info */}
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

        {/* Amount */}
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Amount (SGD)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            placeholder="0.00"
            className="bg-background h-9 w-[110px] text-right text-sm tabular-nums"
          />
        </div>

        {/* Submit */}
        <Button
          className="h-9 shrink-0"
          onClick={handleSubmit}
          disabled={upsert.isPending}
        >
          <Plus className="mr-1.5 size-4" />
          Add Expense
        </Button>
      </div>
    </div>
  );
}
