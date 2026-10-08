// @vitest-environment jsdom
import { InvestmentAllocation } from '@/features/assets/components/investment-allocation';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/equity/hooks/use-equity', () => ({
  useTrades: () => ({ data: [] }),
}));
vi.mock('@/features/equity/hooks/use-prices', () => ({
  useStockPrices: () => ({ data: {}, isLoading: false }),
  useExchangeRate: () => ({ data: 1.3 }),
}));
vi.mock('@/features/equity/lib/holdings', () => ({
  computeHoldings: () => [{ ticker: 'TEST', market: 'SG', shares: 1 }],
}));
vi.mock('@/features/assets/components/market-allocation-table', () => ({
  MarketAllocationTable: ({
    allocations,
    onAllocationChange,
  }: {
    allocations: Record<string, number>;
    onAllocationChange: (ticker: string, pct: number) => void;
  }) => (
    <button onClick={() => onAllocationChange('TEST', 25)}>
      Allocation {allocations.TEST ?? 0}
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('InvestmentAllocation privacy', () => {
  it('discards legacy plaintext tickers and keeps new targets only in memory', () => {
    localStorage.setItem('fynfo-allocations', JSON.stringify({ TEST: 50 }));
    const { unmount } = render(<InvestmentAllocation />);
    expect(localStorage.getItem('fynfo-allocations')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Allocation 0' }));
    expect(screen.getByRole('button', { name: 'Allocation 25' })).toBeTruthy();
    expect(localStorage.getItem('fynfo-allocations')).toBeNull();
    unmount();
    render(<InvestmentAllocation />);
    expect(screen.getByRole('button', { name: 'Allocation 0' })).toBeTruthy();
  });
});
