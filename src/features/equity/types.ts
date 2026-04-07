export type TradeAction = 'buy' | 'sell';

export interface EquityTradeData {
  id?: string;
  date: string; // ISO date string
  broker: string;
  ticker: string;
  action: TradeAction;
  shares: number;
  price: number;
  fees: number;
}
