// @vitest-environment jsdom
import { DividendFormDialog } from '@/features/equity/components/dividend-form';
import { DividendIncomeChart } from '@/features/equity/components/dividend-income-chart';
import { DividendScanDialog } from '@/features/equity/components/dividend-scan-dialog';
import { DividendTable } from '@/features/equity/components/dividend-table';
import { TradeFormDialog } from '@/features/equity/components/trade-form';
import { TradeSummary } from '@/features/equity/components/trade-form-summary';
import { TradeTable } from '@/features/equity/components/trade-table';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveTrade = vi.hoisted(() => vi.fn());
const deleteRecord = vi.hoisted(() => vi.fn());
const saveDividend = vi.hoisted(() => vi.fn());
const importDividends = vi.hoisted(() => vi.fn());
vi.mock('@/features/equity/actions/price-actions', () => ({
  fetchDividends: vi.fn().mockResolvedValue([{ exDate: '2026-02-01', dpu: 2 }]),
}));
vi.mock('@/features/equity/hooks/use-equity', () => ({
  useDeleteTrade: () => ({ isPending: false, mutateAsync: deleteRecord }),
  useCreateTrade: () => ({ isPending: false, mutateAsync: saveTrade }),
  useUpdateTrade: () => ({ isPending: false, mutateAsync: saveTrade }),
}));
vi.mock('@/features/equity/hooks/use-dividends', () => ({
  useDeleteDividend: () => ({ isPending: false, mutateAsync: deleteRecord }),
  useCreateDividend: () => ({ isPending: false, mutateAsync: saveDividend }),
  useUpdateDividend: () => ({ isPending: false, mutateAsync: saveDividend }),
  useCreateDividends: () => ({
    isPending: false,
    mutateAsync: importDividends,
  }),
}));
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
function Control() {
  const { hideAmounts, showAmounts } = useAmountVisibility();
  return (
    <>
      <button onClick={hideAmounts}>Hide</button>
      <button onClick={showAmounts}>Show</button>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
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
describe('Equity amount visibility', () => {
  it('conceals trade quantity, prices, fees, gross value and user-entered broker; blocks editing', () => {
    const edit = vi.fn();
    const trade = {
      id: 'synthetic',
      date: '2026-01-01',
      broker: 'Account 98765',
      ticker: 'AAPL',
      action: 'buy' as const,
      shares: 12345,
      price: 654.32,
      fees: 98.76,
    };
    const { container } = render(
      <AmountVisibilityProvider>
        <Control />
        <TradeTable trades={[trade]} onEdit={edit} />
      </AmountVisibilityProvider>
    );
    expect(container.textContent).toContain('12345');
    fireEvent.click(screen.getByText('Hide'));
    for (const value of ['12345', '654.32', '98.76', '98765'])
      expect(container.textContent).not.toContain(value);
    expect(screen.getByText('Trade History')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit trade' }));
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Show'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit trade' }));
    expect(edit).toHaveBeenCalledWith(trade);
  });
  it('preserves an already-open trade draft without exposing inputs or initiating a save', () => {
    render(
      <AmountVisibilityProvider>
        <Control />
        <TradeFormDialog open onOpenChange={vi.fn()} />
      </AmountVisibilityProvider>
    );
    fireEvent.change(screen.getByLabelText('Shares'), {
      target: { value: '321' },
    });
    fireEvent.click(screen.getByText('Hide'));
    expect((screen.getByLabelText('Shares') as HTMLInputElement).value).toBe(
      ''
    );
    expect((screen.getByLabelText('Shares') as HTMLInputElement).disabled).toBe(
      true
    );
    fireEvent.change(screen.getByLabelText('Shares'), {
      target: { value: '999' },
    });
    expect(saveTrade).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect((screen.getByLabelText('Shares') as HTMLInputElement).value).toBe(
      '321'
    );
    expect(saveTrade).not.toHaveBeenCalled();
  });
  it('keeps distribution fields and assumptions mounted without losing the draft', () => {
    render(
      <AmountVisibilityProvider>
        <Control />
        <DividendFormDialog open onOpenChange={vi.fn()} trades={[]} />
      </AmountVisibilityProvider>
    );
    fireEvent.change(screen.getByLabelText('Amount received'), {
      target: { value: '765.43' },
    });
    fireEvent.click(screen.getByText('Hide'));
    const field = screen.getByLabelText('Amount received') as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.disabled).toBe(true);
    expect(screen.getByText(/from market data/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(
      (screen.getByLabelText('Amount received') as HTMLInputElement).value
    ).toBe('765.43');
    expect(saveDividend).not.toHaveBeenCalled();
  });
  it.each(['trade', 'distribution'])(
    'blocks already-open %s deletion and provides Show within the modal',
    (kind) => {
      const row =
        kind === 'trade' ? (
          <TradeTable
            trades={[
              {
                id: 'synthetic-trade',
                date: '2026-01-01',
                broker: 'Synthetic',
                ticker: 'AAPL',
                action: 'buy',
                shares: 12345,
                price: 1,
                fees: 0,
              },
            ]}
          />
        ) : (
          <DividendTable
            dividends={[
              {
                id: 'synthetic-dividend',
                date: '2026-01-01',
                ticker: 'AAPL',
                amount: 9876.54,
                currency: 'USD',
              },
            ]}
          />
        );
      render(
        <AmountVisibilityProvider>
          <Control />
          {row}
        </AmountVisibilityProvider>
      );
      fireEvent.click(screen.getByRole('button', { name: `Delete ${kind}` }));
      fireEvent.click(screen.getByText('Hide'));
      const confirmation = screen.getByRole('button', {
        name: /^Delete$/,
      }) as HTMLButtonElement;
      expect(confirmation.disabled).toBe(true);
      expect(screen.getByRole('dialog').textContent).not.toContain(
        kind === 'trade' ? '12345' : '9,876.54'
      );
      fireEvent.click(confirmation);
      expect(deleteRecord).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
      expect(confirmation.disabled).toBe(false);
    }
  );
  it('conceals the count when a submitted distribution import completes while hidden', async () => {
    let finish = () => {};
    importDividends.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const trades = [
      {
        id: 'synthetic',
        date: '2026-01-01',
        broker: 'Synthetic',
        ticker: 'AAPL',
        action: 'buy' as const,
        shares: 1,
        price: 1,
        fees: 0,
      },
    ];
    render(
      <AmountVisibilityProvider>
        <Control />
        <DividendScanDialog
          open
          onOpenChange={vi.fn()}
          trades={trades}
          existing={[]}
        />
      </AmountVisibilityProvider>
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add 1 selected' })
      ).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));
    expect(importDividends).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Hide'));
    await act(async () => {
      finish();
    });
    expect(toast.success).toHaveBeenCalledWith('Distributions imported');
    expect(toast.success).not.toHaveBeenCalledWith('Imported 1 distributions');
  });
  it('masks derived totals and removes financial chart plots', () => {
    const { container } = render(
      <AmountVisibilityProvider>
        <Control />
        <TradeSummary
          tradeValue={4321.25}
          fees={11.11}
          action="buy"
          currency="SGD"
        />
        <DividendIncomeChart dividends={[]} usdSgdRate={1} />
      </AmountVisibilityProvider>
    );
    fireEvent.click(screen.getByText('Hide'));
    expect(container.textContent).not.toContain('4,321.25');
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Distribution chart hidden')).toBeTruthy();
  });
});
