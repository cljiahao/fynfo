'use client';

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
import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { fetchDividends } from '../actions/price-actions';
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
    date: d?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
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
  const create = useCreateDividend();
  const update = useUpdateDividend();
  const isPending = create.isPending || update.isPending;
  const [suggesting, setSuggesting] = useState(false);

  const form = useForm<DividendFormValues>({ defaultValues: defaults() });
  const { register, handleSubmit, reset, setValue, getValues, watch } = form;
  const currency = watch('currency');

  useEffect(() => {
    if (open) reset(defaults(editDividend));
  }, [open, editDividend, reset]);

  async function handleSuggest() {
    const ticker = getValues('ticker').trim().toUpperCase();
    const date = getValues('date');
    if (!ticker || !date) {
      toast.error('Enter ticker and date first');
      return;
    }
    setSuggesting(true);
    try {
      const points = await fetchDividends(ticker);
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
      toast.success(`Suggested ${shares} shares × ${dpu} DPU`);
    } catch {
      toast.error('Could not fetch dividend data');
    } finally {
      setSuggesting(false);
    }
  }

  async function onSubmit(values: DividendFormValues) {
    const payload = {
      ticker: values.ticker,
      date: values.date,
      amount: Number(values.amount),
      currency: values.currency,
    };
    try {
      if (editDividend?.id) {
        await update.mutateAsync({ id: editDividend.id, data: payload });
        toast.success('Distribution updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('Distribution added');
      }
      onOpenChange(false);
    } catch {
      toast.error('Failed to save distribution');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editDividend ? 'Edit Distribution' : 'Add Distribution'}
          </DialogTitle>
          <DialogDescription>
            Record a dividend / distribution you received. Use Suggest to
            pre-fill from market data × shares held.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="div-ticker">Ticker</Label>
            <Input
              id="div-ticker"
              placeholder="MLT"
              {...register('ticker', { required: true })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="div-date">Payment date</Label>
            <Input
              id="div-date"
              type="date"
              {...register('date', { required: true })}
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
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggest}
              disabled={suggesting}
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
              value={currency}
              onValueChange={(v) =>
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

          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {editDividend ? 'Save changes' : 'Add distribution'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
