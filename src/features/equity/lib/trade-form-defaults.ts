import { format } from 'date-fns';
import type { EquityTradeData } from '../types';

export interface TradeFormValues {
  date: string;
  broker: string;
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  fees: number;
  isCdp: boolean;
  isPO: boolean;
}

/**
 * Builds the trade dialog's form values for both the new-trade and edit cases.
 * Single source for `defaultValues` and both `form.reset(...)` calls so the
 * three objects cannot drift — the drift is how `isPO` got dropped from the
 * reset paths, leaving it `undefined` after an edit/reopen. `isCdp` and `isPO`
 * are always reset to `false`.
 */
export function buildTradeFormDefaults(
  editTrade?: EquityTradeData,
  todayIso: string = format(new Date(), 'yyyy-MM-dd')
): TradeFormValues {
  if (editTrade) {
    return {
      date: format(new Date(editTrade.date), 'yyyy-MM-dd'),
      broker: editTrade.broker,
      ticker: editTrade.ticker,
      action: editTrade.action,
      shares: editTrade.shares,
      price: editTrade.price,
      fees: editTrade.fees,
      isCdp: false,
      isPO: false,
    };
  }

  return {
    date: todayIso,
    broker: '',
    ticker: '',
    action: 'buy',
    shares: '' as unknown as number,
    price: '' as unknown as number,
    fees: '' as unknown as number,
    isCdp: false,
    isPO: false,
  };
}
