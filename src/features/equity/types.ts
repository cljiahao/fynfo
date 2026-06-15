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
  isCdp?: boolean;
  isPO?: boolean;
}

export type DividendCurrency = 'SGD' | 'USD';

export interface DividendData {
  id?: string;
  ticker: string;
  amount: number; // native-currency amount received
  currency: DividendCurrency;
  date: string; // ISO date (payment date)
}
