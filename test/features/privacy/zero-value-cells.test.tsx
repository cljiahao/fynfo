// @vitest-environment jsdom
import { MarketAllocationTable } from '@/features/assets/components/market-allocation-table';
import { SnapshotTable } from '@/features/assets/components/snapshot-table';
import { TradeTable } from '@/features/equity/components/trade-table';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/assets/hooks/use-snapshots', () => ({
  useDeleteSnapshot: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReviewSnapshots: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('@/features/equity/hooks/use-equity', () => ({
  useDeleteTrade: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
// Use the real pure valuation contract without loading unrelated action/hooks.
vi.mock('@/features/equity', () => import('@/features/equity/lib/valuation'));
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function hide() {
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
}
function show() {
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
}
describe('uniform hidden finite financial cells', () => {
  it('conceals positive and zero categories identically in both snapshot layouts', () => {
    const { container } = render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <SnapshotTable
          snapshots={[
            {
              id: '2026-01',
              snapshotId: 'synthetic-parent',
              revision: '1',
              entries: [
                { category: 'savings', account: 'Synthetic', amount: 1256 },
              ],
            },
          ]}
        />
      </AmountVisibilityProvider>
    );
    const tables = Array.from(container.querySelectorAll('table'));
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      const cells = Array.from(table.querySelectorAll('tbody tr td')).slice(
        1,
        -1
      );
      expect(cells.some((cell) => cell.textContent === '-')).toBe(true);
      expect(cells.some((cell) => cell.textContent?.includes('1,256'))).toBe(
        true
      );
    }
    hide();
    for (const table of tables)
      for (const cell of Array.from(
        table.querySelectorAll('tbody tr td')
      ).slice(1, -1))
        expect(cell.textContent).toBe('Hidden');
    expect(screen.getAllByText('2026-01')).toHaveLength(2);
    show();
    for (const table of tables)
      expect(
        Array.from(table.querySelectorAll('tbody tr td')).some(
          (cell) => cell.textContent === '-'
        )
      ).toBe(true);
  });
  it('conceals zero and positive trade fees with the same replacement', () => {
    const trades = [0, 12.34].map((fees, index) => ({
      id: `synthetic-${index}`,
      date: '2026-01-01',
      broker: 'Synthetic',
      ticker: 'AAPL',
      action: 'buy' as const,
      shares: 1,
      price: 10,
      fees,
    }));
    const { container } = render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <TradeTable trades={trades} />
      </AmountVisibilityProvider>
    );
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0].querySelectorAll('td')[6].textContent).toBe('-');
    expect(rows[1].querySelectorAll('td')[6].textContent).toContain('12.34');
    hide();
    for (const row of rows)
      expect(row.querySelectorAll('td')[6].textContent).toBe('Hidden');
    show();
    expect(rows[0].querySelectorAll('td')[6].textContent).toBe('-');
  });
  it('conceals zero allocation and zero shares-to-buy alongside positive financial targets', () => {
    const holdings = ['DBS', 'UOB', 'OCBC'].map((ticker) => ({
      ticker,
      market: 'SG' as const,
      shares: ticker === 'OCBC' ? 20 : 1,
      totalBuyCost: 10,
      totalBuyShares: 1,
      avgBuyPrice: 10,
      costBasis: 10,
    }));
    const prices = Object.fromEntries(
      holdings.map(({ ticker }) => [ticker, { price: 10, currency: 'SGD' }])
    );
    const { container } = render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <MarketAllocationTable
          title="Synthetic allocation"
          holdings={holdings}
          prices={prices}
          pricesLoading={false}
          allocations={{ DBS: 50, UOB: 0, OCBC: 50 }}
          onAllocationChange={vi.fn()}
          currency="SGD"
          target={200}
          usdToSgd={1}
        />
      </AmountVisibilityProvider>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Synthetic allocation' })
    );
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(3);
    expect(
      rows.some((row) => row.querySelectorAll('td')[3].textContent === '-')
    ).toBe(true);
    expect(
      rows.some((row) => row.querySelectorAll('td')[5].textContent === '-')
    ).toBe(true);
    hide();
    for (const row of rows)
      for (const index of [3, 4, 5])
        expect(row.querySelectorAll('td')[index].textContent).toBe('Hidden');
    show();
    expect(
      rows.some((row) => row.querySelectorAll('td')[3].textContent === '-')
    ).toBe(true);
  });
});
