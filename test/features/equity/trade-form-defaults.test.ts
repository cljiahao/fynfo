import { buildTradeFormDefaults } from '@/features/equity/lib/trade-form-defaults';
import type { EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

describe('buildTradeFormDefaults', () => {
  it('new-trade defaults: empty fields, isPO and isCdp false', () => {
    const v = buildTradeFormDefaults(undefined, '2026-06-02');

    expect(v.date).toBe('2026-06-02');
    expect(v.broker).toBe('');
    expect(v.ticker).toBe('');
    expect(v.action).toBe('buy');
    expect(v.isCdp).toBe(false);
    expect(v.isPO).toBe(false);
  });

  it('edit defaults: maps the trade and forces isPO / isCdp false (regression: isPO left undefined on reset)', () => {
    const trade: EquityTradeData = {
      id: 't1',
      date: '2026-05-20',
      broker: 'IBKR',
      ticker: 'AAPL',
      action: 'sell',
      shares: 10,
      price: 200,
      fees: 1.5,
    };

    const v = buildTradeFormDefaults(trade);

    expect(v.date).toBe('2026-05-20');
    expect(v.broker).toBe('IBKR');
    expect(v.ticker).toBe('AAPL');
    expect(v.action).toBe('sell');
    expect(v.shares).toBe(10);
    expect(v.price).toBe(200);
    expect(v.fees).toBe(1.5);
    expect(v.isCdp).toBe(false);
    expect(v.isPO).toBe(false);
  });
});
