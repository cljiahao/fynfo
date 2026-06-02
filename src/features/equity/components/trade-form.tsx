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
import { formatCurrency } from '@/lib/utils/currency';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateTrade, useUpdateTrade } from '../hooks/use-equity';
import { BROKERS, calculateFees, type Broker } from '../lib/broker-fees';
import { getMarket } from '../lib/ticker-map';
import {
  buildTradeFormDefaults,
  type TradeFormValues,
} from '../lib/trade-form-defaults';
import type { EquityTradeData } from '../types';

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
  const calculatedFees = (() => {
    if (!ticker || !action || tradeValue <= 0) return null;
    if (!isPO && (!broker || !BROKERS.includes(broker as Broker))) return null;
    return calculateFees(
      broker as Broker,
      ticker,
      action,
      tradeValue,
      isCdp ?? false,
      isPO
    );
  })();

  // Auto-populate fees when calculation inputs change (via event handlers below)
  const autoFillFees = () => {
    const fees = (() => {
      const tv =
        (Number(form.getValues('shares')) || 0) *
        (Number(form.getValues('price')) || 0);
      const t = form.getValues('ticker');
      const b = form.getValues('broker') as Broker;
      const a = form.getValues('action');
      const cdp = form.getValues('isCdp');
      const po = form.getValues('isPO');
      if (!t || tv <= 0) return null;
      if (!po && (!b || !BROKERS.includes(b))) return null;
      return calculateFees(b, t, a, tv, cdp, po);
    })();
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
                <Select
                  value={broker}
                  disabled={isPO}
                  onValueChange={handleBrokerChange}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select broker" />
                  </SelectTrigger>
                  <SelectContent>
                    {BROKERS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <div className="bg-muted space-y-1 rounded-md p-3 text-xs">
              <p className="text-muted-foreground font-medium">
                Estimated fee breakdown ({currency})
              </p>
              {calculatedFees.commission > 0 && (
                <div className="flex-between">
                  <span className="text-muted-foreground">Commission</span>
                  <span>
                    {formatCurrency(calculatedFees.commission, currency)}
                  </span>
                </div>
              )}
              {calculatedFees.platformFee > 0 && (
                <div className="flex-between">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <span>
                    {formatCurrency(calculatedFees.platformFee, currency)}
                  </span>
                </div>
              )}
              {calculatedFees.clearingFee > 0 && (
                <div className="flex-between">
                  <span className="text-muted-foreground">
                    Clearing / SGX Fees
                  </span>
                  <span>
                    {formatCurrency(calculatedFees.clearingFee, currency)}
                  </span>
                </div>
              )}
              <div className="flex-between border-t pt-1 font-medium">
                <span>Total Fees</span>
                <span>{formatCurrency(calculatedFees.total, currency)}</span>
              </div>
            </div>
          )}

          {/* Trade summary */}
          {shares > 0 && price > 0 && (
            <div className="bg-muted rounded-md p-3 text-sm">
              <div className="flex-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-semibold">
                  {formatCurrency(tradeValue, currency)}
                </span>
              </div>
              {fees > 0 && (
                <div className="flex-between mt-1">
                  <span className="text-muted-foreground">
                    Total incl. Fees
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(
                      tradeValue + (action === 'buy' ? 1 : -1) * fees,
                      currency
                    )}
                  </span>
                </div>
              )}
            </div>
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
