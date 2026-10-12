'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, ClipboardPaste, Plus, Zap } from 'lucide-react';
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { toast } from 'sonner';
import { useUpsertExpense } from '../hooks/use-expenses';
import { parsePastedRow, type PasteIssue } from '../lib/paste-parser';
import { createReuseDraft, sameExpenseValues } from '../lib/reuse-draft';
import { buildSelfExpense } from '../lib/utils';
import { expenseDataSchema } from '../schemas';
import type { ExpenseData, ExpenseType } from '../types';
import { ExpenseTypeSelect } from './expense-type-select';

export interface ExpenseQuickAddHandle {
  requestReuse: (source: ExpenseData, origin: HTMLButtonElement) => void;
}

type ReusePhase =
  | 'editing'
  | 'saving'
  | 'unconfirmed'
  | 'checking'
  | 'conflict';
type ReuseRequest = { source: ExpenseData; origin: HTMLButtonElement };

export function ExpenseQuickAdd({
  ref,
  readSavedExpenses,
  onReuseAvailabilityChange,
  onSavedExpensesRead,
}: {
  ref?: Ref<ExpenseQuickAddHandle>;
  readSavedExpenses?: () => Promise<ExpenseData[]>;
  onReuseAvailabilityChange?: (available: boolean) => void;
  onSavedExpensesRead?: (records: ExpenseData[]) => void;
} = {}) {
  const upsert = useUpsertExpense();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateOpen, setDateOpen] = useState(false);
  const [type, setType] = useState<ExpenseType>('food_drink');
  const [item, setItem] = useState('');
  const [info, setInfo] = useState('');
  const [amount, setAmount] = useState('');
  const [pasted, setPasted] = useState(false);
  const [issues, setIssues] = useState<PasteIssue[]>([]);
  const [reuse, setReuse] = useState<ExpenseData | null>(null);
  const [phase, setPhase] = useState<ReusePhase>('editing');
  const [reuseError, setReuseError] = useState('');
  const [reuseInvalid, setReuseInvalid] = useState({
    date: false,
    amount: false,
  });
  const [dialog, setDialog] = useState<ReuseRequest | 'cancel' | null>(null);
  const reuseGate = useRef(false);
  const submitted = useRef<ExpenseData | null>(null);
  const originRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLSpanElement>(null);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const frozen = reuse !== null && phase !== 'editing';
  const feedbackId = useId();
  const invalidDate =
    reuseInvalid.date || issues.some((issue) => issue.field === 'date');
  const invalidAmount =
    reuseInvalid.amount || issues.some((issue) => issue.field === 'amount');
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
    setReuse(null);
    setPhase('editing');
    setReuseError('');
    setReuseInvalid({ date: false, amount: false });
    submitted.current = null;
    reuseGate.current = false;
    onReuseAvailabilityChange?.(true);
    typeRef.current?.focus();
  };

  const activateReuse = ({ source, origin }: ReuseRequest) => {
    const draft = createReuseDraft(source, format(new Date(), 'yyyy-MM-dd'));
    originRef.current = origin;
    setReuse(draft);
    setDate(draft.date);
    setType(draft.type);
    setItem(draft.item);
    setInfo(draft.info);
    setAmount(String(draft.amount));
    setPasted(false);
    setIssues([]);
    setReuseError('');
    setReuseInvalid({ date: false, amount: false });
    setPhase('editing');
    submitted.current = null;
    setDialog(null);
    itemRef.current?.focus();
    dialogReturnFocus.current = itemRef.current;
    containerRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  };

  useImperativeHandle(ref, () => ({
    requestReuse(source, origin) {
      if (frozen || reuseGate.current || upsert.isPending || dialog) return;
      if (
        source.splitType !== 'self' ||
        !expenseDataSchema.safeParse(source).success
      )
        return;
      const request = { source: { ...source, splits: [] }, origin };
      dialogReturnFocus.current = itemRef.current;
      if (reuse || item || info || amount || pasted) setDialog(request);
      else activateReuse(request);
    },
  }));

  const cancelReuse = () => {
    resetForm();
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setType('food_drink');
    setDialog(null);
    if (originRef.current?.isConnected) originRef.current.focus();
    else headingRef.current?.focus();
    dialogReturnFocus.current = originRef.current?.isConnected
      ? originRef.current
      : headingRef.current;
    originRef.current = null;
  };

  const submitReuse = async (payload: ExpenseData) => {
    if (reuseGate.current) return;
    reuseGate.current = true;
    submitted.current = payload;
    setPhase('saving');
    onReuseAvailabilityChange?.(false);
    setReuseError('');
    setDateOpen(false);
    const instance = lifetime.current;
    try {
      await upsert.mutateAsync(payload);
      if (!instance.active) return;
      resetForm();
      toast.success('Expense added');
    } catch {
      if (!instance.active) return;
      setPhase('unconfirmed');
      setReuseError('Save unconfirmed. Check expenses before retrying.');
    } finally {
      if (instance.active) reuseGate.current = false;
    }
  };

  const checkReuseSave = async () => {
    const payload = submitted.current;
    if (!payload || !readSavedExpenses || reuseGate.current) return;
    reuseGate.current = true;
    setPhase('checking');
    const instance = lifetime.current;
    const previousPhase = phase;
    try {
      const records = await readSavedExpenses();
      if (!instance.active) return;
      onSavedExpensesRead?.(records);
      const saved = records.find((record) => record.id === payload.id);
      if (saved && sameExpenseValues(saved, payload)) {
        resetForm();
        toast.success('Expense save confirmed');
      } else if (saved) {
        setPhase('conflict');
        setReuseError(
          'This expense has different saved values. Review it in the list before leaving this draft. Retry is disabled to protect those values.'
        );
      } else {
        setPhase(previousPhase === 'conflict' ? 'conflict' : 'unconfirmed');
        setReuseError(
          previousPhase === 'conflict'
            ? 'The expense was not found. A previous conflict remains unresolved; retry stays disabled.'
            : 'The expense was not found. The original save may still finish; keep this draft unchanged and retry the same expense.'
        );
      }
    } catch {
      if (instance.active) {
        setPhase(previousPhase === 'conflict' ? 'conflict' : 'unconfirmed');
        setReuseError(
          'Could not check expenses. The save remains unconfirmed.'
        );
      }
    } finally {
      if (instance.active) reuseGate.current = false;
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t')) return;

    if (reuse) {
      e.preventDefault();
      setReuseError('Finish or cancel this draft before pasting expense rows.');
      return;
    }

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
    if (reuse) return;
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
    if (reuse) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !typeOpenRef.current && !dateOpen) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      ref={containerRef}
      className="border-primary/20 bg-primary/5 rounded-xl border-2 p-4"
      onPaste={handleContainerPaste}
    >
      <div className="flex-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex-center bg-primary size-7 rounded-lg">
            <Zap className="text-primary-foreground size-3.5" />
          </div>
          <span
            ref={headingRef}
            tabIndex={-1}
            className="text-sm font-semibold"
          >
            Quick Add Expense
          </span>
          {pasted && (
            <span className="bg-gain-subtle text-gain-strong flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
              <ClipboardPaste className="size-3" />
              Pasted from Excel
            </span>
          )}
        </div>
        {!reuse && (
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
        )}
      </div>

      {reuse && (
        <div className="mb-3 space-y-2">
          <p role="status" className="text-sm">
            Reused expense · Date set to today · Self expense
          </p>
          {reuseError && (
            <p
              id={feedbackId + '-reuse'}
              role="alert"
              className="text-loss-strong text-sm"
            >
              {reuseError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={frozen}
              onClick={() => {
                const current = {
                  ...reuse,
                  date,
                  type,
                  item,
                  info,
                  amount: Number(amount),
                };
                if (sameExpenseValues(current, reuse)) cancelReuse();
                else setDialog('cancel');
              }}
            >
              Cancel reuse
            </Button>
            {(phase === 'unconfirmed' ||
              phase === 'conflict' ||
              phase === 'checking') && (
              <Button
                variant="outline"
                size="sm"
                disabled={phase === 'checking' || !readSavedExpenses}
                onClick={() => void checkReuseSave()}
              >
                {phase === 'checking' ? 'Checking expenses…' : 'Check expenses'}
              </Button>
            )}
            {phase === 'unconfirmed' && (
              <Button
                size="sm"
                onClick={() => {
                  if (submitted.current) void submitReuse(submitted.current);
                }}
              >
                Retry same expense
              </Button>
            )}
          </div>
        </div>
      )}

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
                disabled={frozen}
                aria-invalid={invalidDate || undefined}
                aria-describedby={
                  invalidDate
                    ? reuse
                      ? feedbackId + '-reuse-date'
                      : feedbackId
                    : undefined
                }
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
                    setReuseInvalid((current) => ({ ...current, date: false }));
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
                    setReuseInvalid((current) => ({ ...current, date: false }));
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
          {reuseInvalid.date && (
            <p
              id={feedbackId + '-reuse-date'}
              className="text-loss-strong text-xs"
            >
              Choose a valid date.
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label
            htmlFor={feedbackId + '-category'}
            className="text-muted-foreground text-xs font-medium"
          >
            Category
          </label>
          <ExpenseTypeSelect
            disabled={frozen}
            inputId={feedbackId + '-category'}
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
          <label
            htmlFor={feedbackId + '-item'}
            className="text-muted-foreground text-xs font-medium"
          >
            Item / Brand
          </label>
          <Input
            disabled={frozen}
            ref={itemRef}
            id={feedbackId + '-item'}
            value={item}
            onChange={(e) => setItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Grab, NTUC"
            className="bg-background h-9 w-[140px] text-sm"
          />
        </div>
        <div className="min-w-[120px] flex-1 space-y-1">
          <label
            htmlFor={feedbackId + '-notes'}
            className="text-muted-foreground text-xs font-medium"
          >
            Notes
          </label>
          <Input
            disabled={frozen}
            value={info}
            id={feedbackId + '-notes'}
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
            disabled={frozen}
            id={feedbackId + '-amount'}
            aria-invalid={invalidAmount || undefined}
            aria-describedby={
              invalidAmount
                ? reuse
                  ? feedbackId + '-reuse-amount'
                  : feedbackId
                : undefined
            }
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              setAmount(value);
              if (Number.isFinite(Number(value)) && Number(value) > 0) {
                setReuseInvalid((current) => ({ ...current, amount: false }));
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
          {reuseInvalid.amount && (
            <p
              id={feedbackId + '-reuse-amount'}
              className="text-loss-strong text-xs"
            >
              Enter a positive finite amount.
            </p>
          )}
        </div>
        <Button
          className="h-9 shrink-0"
          onClick={() => {
            if (!reuse) {
              handleSubmit();
              return;
            }
            const payload = {
              ...reuse,
              date,
              type,
              item,
              info,
              amount: Number(amount),
            };
            const validation = expenseDataSchema.safeParse(payload);
            if (!validation.success) {
              setReuseInvalid({
                date: validation.error.issues.some(
                  (issue) => issue.path[0] === 'date'
                ),
                amount: validation.error.issues.some(
                  (issue) => issue.path[0] === 'amount'
                ),
              });
              setReuseError(
                'Choose a valid date and enter a positive finite amount.'
              );
              return;
            }
            setReuseInvalid({ date: false, amount: false });
            void submitReuse(payload);
          }}
          disabled={frozen || upsert.isPending || issues.length > 0}
        >
          <Plus className="mr-1.5 size-4" />
          {phase === 'saving' && reuse ? 'Saving expense…' : 'Add Expense'}
        </Button>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (dialogReturnFocus.current ?? itemRef.current)?.focus();
          }}
        >
          <DialogTitle>
            {dialog === 'cancel'
              ? 'Discard changes to this draft?'
              : 'Replace current draft?'}
          </DialogTitle>
          <DialogDescription>
            Your current unsaved inputs will be discarded. No expense will be
            saved.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                dialogReturnFocus.current = itemRef.current;
                setDialog(null);
              }}
            >
              Keep draft
            </Button>
            <Button
              onClick={() => {
                if (dialog === 'cancel') cancelReuse();
                else if (dialog) activateReuse(dialog);
              }}
            >
              {dialog === 'cancel' ? 'Discard draft' : 'Replace draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
