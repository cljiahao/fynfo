import { format } from 'date-fns/format';
import type { EquityTradeData } from '../types';
import { resolveMarket } from './ticker-map';
import type { Market } from './ticker-market';

export interface TradeFormValues {
  date: string;
  broker: string;
  ticker: string;
  market: Market | undefined;
  action: 'buy' | 'sell';
  shares: number | null;
  price: number | null;
  fees: number | null;
  isCdp: boolean;
  isPO: boolean;
}

/**
 * Builds the trade dialog's form values for both the new-trade and edit cases.
 * Single source for `defaultValues` and both `form.reset(...)` calls so the
 * three objects cannot drift — the drift is how `isPO` got dropped from the
 * reset paths, leaving it `undefined` after an edit/reopen. On edit, `isCdp` /
 * `isPO` are restored from the saved trade; new trades default false.
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
      // Legacy trades get their inferred market stamped on the next save.
      market: resolveMarket(editTrade),
      action: editTrade.action,
      shares: editTrade.shares,
      price: editTrade.price,
      fees: editTrade.fees,
      isCdp: editTrade.isCdp ?? false,
      isPO: editTrade.isPO ?? false,
    };
  }

  return {
    date: todayIso,
    broker: '',
    ticker: '',
    market: undefined,
    action: 'buy',
    shares: null,
    price: null,
    fees: null,
    isCdp: false,
    isPO: false,
  };
}
