export type TradeAction = 'buy' | 'sell';

export interface EquityTradeData {
  id?: string;
  // ISO date string
  date: string;
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
  // native-currency amount received
  amount: number;
  currency: DividendCurrency;
  // ISO date (payment date)
  date: string;
}
