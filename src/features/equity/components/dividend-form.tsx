'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { fetchDividends } from '../actions/price-actions';
import { DIVIDEND_SUGGESTED_MESSAGE } from '../constants';
import { useCreateDividend, useUpdateDividend } from '../hooks/use-dividends';
import {
  nearestDpu,
  sharesHeldAsOf,
  suggestAmount,
} from '../lib/dividend-suggest';
import type { DividendCurrency, DividendData, EquityTradeData } from '../types';

interface DividendFormValues {
  ticker: string;
  date: string;
  amount: number;
  currency: DividendCurrency;
}

interface DividendFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trades: EquityTradeData[];
  editDividend?: DividendData;
}

function defaults(d?: DividendData): DividendFormValues {
  return {
    ticker: d?.ticker ?? '',
    date: d?.date?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'),
    amount: d?.amount ?? 0,
    currency: d?.currency ?? 'SGD',
  };
}

export function DividendFormDialog({
  open,
  onOpenChange,
  trades,
  editDividend,
}: DividendFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DividendFormEditor
          key={editDividend?.id ?? 'new'}
          onOpenChange={onOpenChange}
          trades={trades}
          editDividend={editDividend}
        />
      )}
    </Dialog>
  );
}

function DividendFormEditor({
  onOpenChange,
  trades,
  editDividend,
}: Omit<DividendFormDialogProps, 'open'>) {
  const { hidden, canReveal, getHideEpoch, showAmounts } =
    useAmountVisibility();
  const create = useCreateDividend();
  const update = useUpdateDividend();
  const isPending = create.isPending || update.isPending;
  const [suggesting, setSuggesting] = useState(false);
  const work = useRef({ mounted: false, revision: 0, request: 0 });

  const form = useForm<DividendFormValues>({
    defaultValues: defaults(editDividend),
  });
  const { register, handleSubmit, reset, setValue, getValues, control } = form;
  const [currency, tickerValue, amountValue] = useWatch({
    control,
    name: ['currency', 'ticker', 'amount'],
  });

  useLayoutEffect(() => {
    const state = work.current;
    state.mounted = true;
    state.revision += 1;
    return () => {
      state.mounted = false;
    };
  }, [trades, editDividend]);

  useEffect(() => {
    reset(defaults(editDividend));
  }, [editDividend, reset]);

  function isCurrent(revision: number, inputs: DividendFormValues): boolean {
    const current = getValues();
    return (
      work.current.mounted &&
      work.current.revision === revision &&
      current.ticker === inputs.ticker &&
      current.date === inputs.date &&
      current.currency === inputs.currency &&
      Object.is(current.amount, inputs.amount)
    );
  }

  async function handleSuggest() {
    if (!canReveal()) return;
    const hideEpoch = getHideEpoch();
    const inputs = { ...getValues() };
    const ticker = inputs.ticker.trim().toUpperCase();
    const date = inputs.date;
    if (!ticker || !date) {
      toast.error('Enter ticker and date first');
      return;
    }
    const revision = work.current.revision;
    const request = ++work.current.request;
    setSuggesting(true);
    try {
      const points = await fetchDividends(ticker);
      if (
        !canReveal() ||
        hideEpoch !== getHideEpoch() ||
        request !== work.current.request ||
        !isCurrent(revision, inputs)
      )
        return;
      const dpu = nearestDpu(points, date);
      if (dpu == null) {
        toast.error('No dividend data found for this ticker');
        return;
      }
      const shares = sharesHeldAsOf(trades, ticker, date);
      if (shares <= 0) {
        toast.error('No shares held on that date');
        return;
      }
      const amount = Number(suggestAmount(dpu, shares).toFixed(2));
      setValue('amount', amount, { shouldDirty: true });
      toast.success(DIVIDEND_SUGGESTED_MESSAGE);
    } catch {
      if (request === work.current.request && isCurrent(revision, inputs)) {
        toast.error('Could not fetch dividend data');
      }
    } finally {
      if (work.current.mounted && request === work.current.request) {
        setSuggesting(false);
      }
    }
  }

  async function onSubmit(values: DividendFormValues) {
    if (!canReveal()) return;
    const revision = work.current.revision;
    const inputs = { ...values };
    const payload = {
      ticker: values.ticker,
      date: values.date,
      amount: Number(values.amount),
      currency: values.currency,
    };
    try {
      if (editDividend?.id) {
        await update.mutateAsync({ id: editDividend.id, data: payload });
      } else {
        await create.mutateAsync(payload);
      }
      if (!isCurrent(revision, inputs)) return;
      toast.success(
        editDividend?.id ? 'Distribution updated' : 'Distribution added'
      );
      onOpenChange(false);
    } catch {
      if (isCurrent(revision, inputs))
        toast.error('Failed to save distribution');
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {editDividend ? 'Edit Distribution' : 'Add Distribution'}
        </DialogTitle>
        <DialogDescription>
          Record a dividend / distribution you received. Use Suggest to pre-fill
          from market data × shares held.
        </DialogDescription>
      </DialogHeader>

      {hidden && (
        <div role="status" className="space-y-2">
          <p>Show amounts before editing. Your draft is preserved.</p>
          <Button type="button" onClick={showAmounts}>
            Show amounts
          </Button>
        </div>
      )}
      <form
        onSubmit={(event) => {
          if (!canReveal()) {
            event.preventDefault();
            toast.info('Show amounts before saving a distribution');
            return;
          }
          const submitEpoch = getHideEpoch();
          void handleSubmit((values) => {
            if (!canReveal() || getHideEpoch() !== submitEpoch) return;
            return onSubmit(values);
          })(event);
        }}
        className="flex flex-col gap-4"
      >
        <fieldset disabled={hidden} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="div-ticker">Ticker</Label>
            <Input
              id="div-ticker"
              placeholder="MLT"
              {...register('ticker', { required: true })}
              disabled={hidden}
              value={hidden ? '' : tickerValue}
              onBlur={(event) => {
                if (canReveal()) void register('ticker').onBlur(event);
              }}
              onChange={(event) => {
                if (canReveal()) void register('ticker').onChange(event);
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="div-date">Payment date</Label>
            <Input
              id="div-date"
              type="date"
              {...register('date', { required: true })}
              disabled={hidden}
              onBlur={(event) => {
                if (canReveal()) void register('date').onBlur(event);
              }}
              onChange={(event) => {
                if (canReveal()) void register('date').onChange(event);
              }}
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="div-amount">Amount received</Label>
              <Input
                id="div-amount"
                type="number"
                step="0.01"
                min="0"
                {...register('amount', { valueAsNumber: true, required: true })}
                disabled={hidden}
                value={hidden ? '' : amountValue}
                onBlur={(event) => {
                  if (canReveal()) void register('amount').onBlur(event);
                }}
                onChange={(event) => {
                  if (canReveal()) void register('amount').onChange(event);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggest}
              disabled={hidden || suggesting}
            >
              {suggesting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Suggest
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="div-currency">Currency</Label>
            <Select
              disabled={hidden}
              value={currency}
              onValueChange={(v) =>
                canReveal() &&
                setValue('currency', v as DividendCurrency, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="div-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SGD">SGD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>
        <Button type="submit" disabled={hidden || isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {editDividend ? 'Save changes' : 'Add distribution'}
        </Button>
      </form>
    </DialogContent>
  );
}
