export type ExpenseType =
  | 'bills'
  | 'charity'
  | 'electronics'
  | 'entertainment'
  | 'food_drink'
  | 'gift'
  | 'groceries'
  | 'health'
  | 'insurance'
  | 'other'
  | 'shopping'
  | 'subscriptions'
  | 'transport'
  | 'travel';

export interface ExpenseSplitData {
  person: string;
  amount: number;
  settled: boolean;
}

export interface ExpenseData {
  id: string;
  // ISO string
  date: string;
  type: ExpenseType;
  item: string;
  info: string;
  amount: number;
  splitType: 'self' | 'shared';
  splits: ExpenseSplitData[];
}
