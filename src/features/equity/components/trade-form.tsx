'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateTrade, useUpdateTrade } from '../hooks/use-equity';
import { BROKERS, resolveTradeFees } from '../lib/broker-fees';
import { getMarket } from '../lib/ticker-map';
import {
  buildTradeFormDefaults,
  type TradeFormValues,
} from '../lib/trade-form-defaults';
import type { EquityTradeData } from '../types';
import { TradeFeeBreakdown, TradeSummary } from './trade-form-summary';

interface TradeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTrade?: EquityTradeData;
}

export function TradeFormDialog({
  open,
  onOpenChange,
  editTrade,
}: TradeFormDialogProps) {
  const create = useCreateTrade();
  const update = useUpdateTrade();
  const isPending = create.isPending || update.isPending;

  const form = useForm<TradeFormValues>({
    defaultValues: buildTradeFormDefaults(),
  });

  useEffect(() => {
    if (editTrade) {
      form.reset(buildTradeFormDefaults(editTrade));
    }
  }, [editTrade, form]);

  useEffect(() => {
    if (open && !editTrade) {
      form.reset(buildTradeFormDefaults());
    }
  }, [open, editTrade, form]);

  const {
    broker,
    ticker,
    action,
    shares: sharesRaw,
    price: priceRaw,
    fees: feesRaw,
    isCdp,
    isPO,
  } = useWatch({ control: form.control });
  const shares = Number(sharesRaw) || 0;
  const price = Number(priceRaw) || 0;
  const fees = Number(feesRaw) || 0;

  const market = ticker ? getMarket(ticker.toUpperCase()) : null;
  const isSg = market === 'SG';
  const cdpEnabled = isSg;
  const currency = market === 'US' ? 'USD' : 'SGD';

  const tradeValue = shares * price;

  // Compute fees as derived state (no useMemo needed per templateCentral standards)
  const calculatedFees = resolveTradeFees({
    ticker,
    action,
    broker,
    tradeValue,
    isCdp: isCdp ?? false,
    isPO,
  });

  // Auto-populate fees when calculation inputs change (via event handlers below)
  const autoFillFees = () => {
    const fees = resolveTradeFees({
      ticker: form.getValues('ticker'),
      action: form.getValues('action'),
      broker: form.getValues('broker'),
      tradeValue:
        (Number(form.getValues('shares')) || 0) *
        (Number(form.getValues('price')) || 0),
      isCdp: form.getValues('isCdp'),
      isPO: form.getValues('isPO'),
    });
    if (fees && !editTrade) {
      form.setValue('fees', Math.round(fees.total * 100) / 100);
    }
  };

  // DBS SG is always CDP — auto-tick on broker change
  const handleBrokerChange = (v: string) => {
    form.setValue('broker', v);
    const tickerVal = form.getValues('ticker');
    const mkt = tickerVal ? getMarket(tickerVal.toUpperCase()) : null;
    if (mkt === 'SG' && v === 'DBS Vickers') {
      form.setValue('isCdp', true);
    }
    autoFillFees();
  };

  async function onSubmit(values: TradeFormValues) {
    const data = {
      date: new Date(values.date).toISOString(),
      broker: values.broker.trim(),
      ticker: values.ticker.trim().toUpperCase(),
      action: values.action,
      shares: Number(values.shares) || 0,
      price: Number(values.price) || 0,
      fees: Number(values.fees) || 0,
      isCdp: values.isCdp,
      isPO: values.isPO,
    };

    if (
      (!data.broker && !isPO) ||
      !data.ticker ||
      data.shares <= 0 ||
      data.price <= 0
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editTrade?.id) {
        await update.mutateAsync({ id: editTrade.id, data });
        toast.success('Trade updated');
      } else {
        await create.mutateAsync(data);
        toast.success('Trade added');
      }
      onOpenChange(false);
    } catch {
      toast.error('Failed to save trade');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editTrade ? 'Edit' : 'New'} Trade</DialogTitle>
          <DialogDescription>Record a stock trade</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Row 1: Ticker | Buy/Sell */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ticker</Label>
              <Input
                placeholder="e.g. AAPL, DBS"
                {...form.register('ticker', {
                  onChange: () => setTimeout(autoFillFees, 0),
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={action === 'buy' ? 'default' : 'outline'}
                  className={
                    action === 'buy'
                      ? 'flex-1 bg-emerald-600 hover:bg-emerald-700'
                      : 'flex-1'
                  }
                  onClick={() => {
                    form.setValue('action', 'buy');
                    autoFillFees();
                  }}
                >
                  Buy
                </Button>
                <Button
                  type="button"
                  variant={action === 'sell' ? 'default' : 'outline'}
                  className={
                    action === 'sell'
                      ? 'flex-1 bg-red-600 hover:bg-red-700'
                      : 'flex-1'
                  }
                  onClick={() => {
                    form.setValue('action', 'sell');
                    autoFillFees();
                  }}
                >
                  Sell
                </Button>
              </div>
            </div>
          </div>

          {/* Row 2: Date | Broker + CDP */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...form.register('date')} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Broker</Label>
              <div className="flex items-center gap-3">
                <Controller
                  name="broker"
                  control={form.control}
                  render={({ field }) => {
                    // Show the saved broker even if it isn't one of the canonical
                    // BROKERS (the trade schema allows any string), so edit never
                    // renders blank and the value round-trips.
                    const options =
                      field.value &&
                      !(BROKERS as readonly string[]).includes(field.value)
                        ? [field.value, ...BROKERS]
                        : [...BROKERS];
                    return (
                      <Select
                        value={field.value || ''}
                        disabled={isPO}
                        onValueChange={handleBrokerChange}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select broker" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="cdp"
                      checked={isCdp}
                      disabled={!cdpEnabled || isPO}
                      onCheckedChange={(checked) => {
                        form.setValue('isCdp', checked === true);
                        autoFillFees();
                      }}
                    />
                    <Label
                      htmlFor="cdp"
                      className={`text-sm font-normal whitespace-nowrap ${!cdpEnabled || isPO ? 'text-muted-foreground' : ''}`}
                    >
                      CDP
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="po"
                      checked={isPO}
                      disabled={!cdpEnabled}
                      onCheckedChange={(checked) => {
                        form.setValue('isPO', checked === true);
                        autoFillFees();
                      }}
                    />
                    <Label
                      htmlFor="po"
                      className={`text-sm font-normal whitespace-nowrap ${!cdpEnabled ? 'text-muted-foreground' : ''}`}
                    >
                      P/O
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Shares</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                {...form.register('shares', {
                  setValueAs: (v: string) => (v === '' ? 0 : parseFloat(v)),
                  onChange: () => setTimeout(autoFillFees, 0),
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Price per Share</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register('price', {
                  setValueAs: (v: string) => (v === '' ? 0 : parseFloat(v)),
                  onChange: () => setTimeout(autoFillFees, 0),
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fees</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register('fees', {
                  setValueAs: (v: string) => (v === '' ? 0 : parseFloat(v)),
                })}
              />
            </div>
          </div>

          {/* Fee breakdown */}
          {calculatedFees && tradeValue > 0 && (
            <TradeFeeBreakdown fees={calculatedFees} currency={currency} />
          )}

          {/* Trade summary */}
          {shares > 0 && price > 0 && (
            <TradeSummary
              tradeValue={tradeValue}
              fees={fees}
              action={action}
              currency={currency}
            />
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editTrade ? 'Update' : 'Add'} Trade
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
