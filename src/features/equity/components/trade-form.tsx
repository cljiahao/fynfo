'use client';

import { useAmountVisibility } from '@/features/privacy';

import { NumericInput } from '@/components/numeric-input';
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
import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateTrade, useTrades, useUpdateTrade } from '../hooks/use-equity';
import { BROKERS, resolveTradeFees } from '../lib/broker-fees';
import { resolveMarket } from '../lib/ticker-map';
import type { Market } from '../lib/ticker-market';
import {
  buildTradeFormDefaults,
  type TradeFormValues,
} from '../lib/trade-form-defaults';
import type { EquityTradeData } from '../types';
import { TickerCombobox, type TickerOption } from './ticker-combobox';
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
  const { hidden, canReveal, getHideEpoch, showAmounts } =
    useAmountVisibility();
  const fieldId = useId();
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

  const { data: trades } = useTrades();
  const tickerOptions = useMemo<TickerOption[]>(() => {
    const byTicker = new Map<string, TickerOption>();
    for (const t of trades ?? []) {
      const ticker = t.ticker.toUpperCase();
      // An explicit market outranks one inferred from the legacy map.
      if (t.market || !byTicker.has(ticker)) {
        byTicker.set(ticker, { ticker, market: resolveMarket(t) });
      }
    }
    return [...byTicker.values()].sort((a, b) =>
      a.ticker.localeCompare(b.ticker)
    );
  }, [trades]);

  const {
    broker,
    ticker,
    market,
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

  const isSg = market === 'SG';
  const cdpEnabled = isSg;
  const currency = market === 'US' ? 'USD' : 'SGD';

  const tradeValue = shares * price;
  const calculatedFees = resolveTradeFees({
    ticker,
    market,
    action,
    broker,
    tradeValue,
    isCdp: isCdp ?? false,
    isPO,
  });

  // Auto-populate fees when calculation inputs change (via event handlers below)
  const autoFillFees = () => {
    if (!canReveal()) return;
    const fees = resolveTradeFees({
      ticker: form.getValues('ticker'),
      market: form.getValues('market'),
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
    // Radix's native select mirror can emit its empty masking sentinel after Show.
    // Empty is not a broker option; preserve the registered draft on that event.
    if (!canReveal() || v === '') return;
    form.setValue('broker', v);
    if (
      form.getValues('market') === 'SG' &&
      (v === 'DBS Vickers' || v === 'FSMOne')
    ) {
      if (!canReveal()) return;
      form.setValue('isCdp', true);
    }
    autoFillFees();
  };

  const handleTickerChange = (next: { ticker: string; market?: Market }) => {
    if (!canReveal()) return;
    form.setValue('ticker', next.ticker, { shouldDirty: true });
    form.setValue('market', next.market, { shouldDirty: true });
    form.clearErrors('market');
    const brokerVal = form.getValues('broker');
    if (
      next.market === 'SG' &&
      (brokerVal === 'DBS Vickers' || brokerVal === 'FSMOne')
    ) {
      form.setValue('isCdp', true);
    }
    autoFillFees();
  };

  async function onSubmit(values: TradeFormValues) {
    if (!canReveal()) return;
    const date = new Date(values.date);
    if (!Number.isFinite(date.getTime())) {
      toast.error('Please fill in all required fields');
      return;
    }
    const data = {
      date: date.toISOString(),
      broker: values.broker.trim(),
      ticker: values.ticker.trim().toUpperCase(),
      market: values.market,
      action: values.action,
      shares: values.shares ?? 0,
      price: values.price ?? 0,
      fees: values.fees ?? 0,
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
    if (!data.market) {
      form.setError('market', { message: 'Select a market for this ticker' });
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
              toast.info('Show amounts before saving a trade');
              return;
            }
            const submitEpoch = getHideEpoch();
            void form.handleSubmit(
              (values) => {
                if (!canReveal() || getHideEpoch() !== submitEpoch) return;
                return onSubmit(values);
              },
              () => {
                if (canReveal())
                  toast.error('Please fill in all required fields');
              }
            )(event);
          }}
          className="space-y-4"
        >
          <fieldset disabled={hidden} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2" data-testid="trade-ticker-row">
                <Label htmlFor={`${fieldId}-ticker`}>Ticker</Label>
                <TickerCombobox
                  id={`${fieldId}-ticker`}
                  options={tickerOptions}
                  value={{ ticker: ticker ?? '', market }}
                  onChange={handleTickerChange}
                  disabled={hidden}
                  error={form.formState.errors.market?.message}
                />
              </div>
              <div className="space-y-2" data-testid="trade-action-row">
                <Label>Action</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={action === 'buy' ? 'default' : 'outline'}
                    className={
                      action === 'buy'
                        ? 'bg-gain hover:bg-gain/90 flex-1'
                        : 'flex-1'
                    }
                    onClick={() => {
                      if (!canReveal()) return;
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
                        ? 'bg-loss hover:bg-loss/90 flex-1'
                        : 'flex-1'
                    }
                    onClick={() => {
                      if (!canReveal()) return;
                      form.setValue('action', 'sell');
                      autoFillFees();
                    }}
                  >
                    Sell
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-date`}>Date</Label>
                <Input
                  id={`${fieldId}-date`}
                  type="date"
                  {...form.register('date')}
                  disabled={hidden}
                  onBlur={(event) => {
                    if (canReveal()) void form.register('date').onBlur(event);
                  }}
                  onChange={(event) => {
                    if (canReveal()) void form.register('date').onChange(event);
                  }}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor={`${fieldId}-broker`}>Broker</Label>
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
                          value={hidden ? '' : field.value || ''}
                          disabled={hidden || isPO}
                          onValueChange={handleBrokerChange}
                        >
                          <SelectTrigger
                            id={`${fieldId}-broker`}
                            className="flex-1"
                          >
                            <SelectValue placeholder="Select broker" />
                          </SelectTrigger>
                          <SelectContent>
                            {!hidden &&
                              options.map((b) => (
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
                        id={`${fieldId}-cdp`}
                        checked={isCdp}
                        disabled={hidden || !cdpEnabled || isPO}
                        onCheckedChange={(checked) => {
                          if (!canReveal()) return;
                          form.setValue('isCdp', checked === true);
                          autoFillFees();
                        }}
                      />
                      <Label
                        htmlFor={`${fieldId}-cdp`}
                        className={`text-sm font-normal whitespace-nowrap ${!cdpEnabled || isPO ? 'text-muted-foreground' : ''}`}
                      >
                        CDP
                      </Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`${fieldId}-po`}
                        checked={isPO}
                        disabled={hidden || !cdpEnabled}
                        onCheckedChange={(checked) => {
                          if (!canReveal()) return;
                          form.setValue('isPO', checked === true);
                          autoFillFees();
                        }}
                      />
                      <Label
                        htmlFor={`${fieldId}-po`}
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
                <Label htmlFor={`${fieldId}-shares`}>Shares</Label>
                <Controller
                  name="shares"
                  control={form.control}
                  rules={{
                    validate: (v) =>
                      (v !== null && v > 0) || 'Shares must be greater than 0',
                  }}
                  render={({ field, fieldState }) => (
                    <>
                      <NumericInput
                        id={`${fieldId}-shares`}
                        placeholder="0"
                        aria-invalid={fieldState.invalid}
                        disabled={hidden}
                        value={hidden ? null : field.value}
                        onValueChange={(next) => {
                          if (!canReveal()) return;
                          field.onChange(next);
                          setTimeout(autoFillFees, 0);
                        }}
                        onBlur={() => {
                          if (canReveal()) field.onBlur();
                        }}
                      />
                      {fieldState.error && (
                        <p role="alert" className="text-destructive text-sm">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-price`}>Price per Share</Label>
                <Controller
                  name="price"
                  control={form.control}
                  rules={{
                    validate: (v) =>
                      (v !== null && v > 0) || 'Price must be greater than 0',
                  }}
                  render={({ field, fieldState }) => (
                    <>
                      <NumericInput
                        id={`${fieldId}-price`}
                        placeholder="0.00"
                        aria-invalid={fieldState.invalid}
                        disabled={hidden}
                        value={hidden ? null : field.value}
                        onValueChange={(next) => {
                          if (!canReveal()) return;
                          field.onChange(next);
                          setTimeout(autoFillFees, 0);
                        }}
                        onBlur={() => {
                          if (canReveal()) field.onBlur();
                        }}
                      />
                      {fieldState.error && (
                        <p role="alert" className="text-destructive text-sm">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-fees`}>Fees</Label>
                <Controller
                  name="fees"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <NumericInput
                        id={`${fieldId}-fees`}
                        placeholder="0.00"
                        aria-invalid={fieldState.invalid}
                        disabled={hidden}
                        value={hidden ? null : field.value}
                        onValueChange={(next) => {
                          if (!canReveal()) return;
                          field.onChange(next);
                        }}
                        onBlur={() => {
                          if (canReveal()) field.onBlur();
                        }}
                      />
                      {fieldState.error && (
                        <p role="alert" className="text-destructive text-sm">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>
            </div>
            {calculatedFees && tradeValue > 0 && (
              <TradeFeeBreakdown fees={calculatedFees} currency={currency} />
            )}
            {shares > 0 && price > 0 && (
              <TradeSummary
                tradeValue={tradeValue}
                fees={fees}
                action={action}
                currency={currency}
              />
            )}
          </fieldset>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={hidden || isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editTrade ? 'Update' : 'Add'} Trade
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
