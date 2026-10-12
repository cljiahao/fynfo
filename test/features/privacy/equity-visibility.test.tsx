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

// Built-in React Hook Form validation is asynchronous even without a resolver.
// Keep both visibility transitions in one synchronous turn before its callback.
describe.each(['trade', 'distribution'] as const)(
  '%s submission visibility boundary',
  (kind) => {
    function mountEditor() {
      const editor =
        kind === 'trade' ? (
          <TradeFormDialog
            open
            onOpenChange={vi.fn()}
            editTrade={{
              id: 'synthetic-trade',
              date: '2026-01-01',
              ticker: 'AAPL',
              broker: 'Synthetic broker',
              action: 'buy',
              shares: 5,
              price: 10,
              fees: 1,
            }}
          />
        ) : (
          <DividendFormDialog
            open
            onOpenChange={vi.fn()}
            trades={[]}
            editDividend={{
              id: 'synthetic-dividend',
              date: '2026-01-01',
              ticker: 'AAPL',
              amount: 5,
              currency: 'USD',
            }}
          />
        );
      render(
        <AmountVisibilityProvider>
          <Control />
          {editor}
        </AmountVisibilityProvider>
      );
      const input = screen.getByLabelText(
        kind === 'trade' ? 'Shares' : 'Amount received'
      );
      const form = input.closest('form');
      if (!form) throw new Error('Expected equity editor form');
      return { form, save: kind === 'trade' ? saveTrade : saveDividend };
    }
    it('rejects hidden initiation even if immediately shown, then permits a fresh visible submit', async () => {
      const { form, save } = mountEditor();
      act(() => {
        fireEvent.click(screen.getByText('Hide'));
        fireEvent.submit(form);
        fireEvent.click(screen.getByText('Show'));
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(save).not.toHaveBeenCalled();
      fireEvent.submit(form);
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    });
    it('rejects visible initiation followed by Hide/Show during validation, then permits fresh submit', async () => {
      const { form, save } = mountEditor();
      act(() => {
        fireEvent.submit(form);
        fireEvent.click(screen.getByText('Hide'));
        fireEvent.click(screen.getByText('Show'));
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(save).not.toHaveBeenCalled();
      fireEvent.submit(form);
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    });
  }
);

// Exercise actual registered field onBlur after DOM masking, rather than only
// asserting presentation; a later save must retain the owner's typed draft.
describe.each([
  { kind: 'trade', label: 'Ticker', raw: 'MSFT', expected: { ticker: 'MSFT' } },
  {
    kind: 'trade',
    label: 'Date',
    raw: '2026-02-02',
    expected: { date: '2026-02-02T00:00:00.000Z' },
  },
  { kind: 'trade', label: 'Shares', raw: '7', expected: { shares: 7 } },
  {
    kind: 'trade',
    label: 'Price per Share',
    raw: '34.56',
    expected: { price: 34.56 },
  },
  { kind: 'trade', label: 'Fees', raw: '2.34', expected: { fees: 2.34 } },
  {
    kind: 'distribution',
    label: 'Ticker',
    raw: 'MSFT',
    expected: { ticker: 'MSFT' },
  },
  {
    kind: 'distribution',
    label: 'Payment date',
    raw: '2026-02-02',
    expected: { date: '2026-02-02' },
  },
  {
    kind: 'distribution',
    label: 'Amount received',
    raw: '987.65',
    expected: { amount: 987.65 },
  },
])(
  '$kind $label registered blur visibility',
  ({ kind, label, raw, expected }) => {
    it('retains the typed draft through Hide, native blur and Show, then saves its original payload', async () => {
      const editor =
        kind === 'trade' ? (
          <TradeFormDialog
            open
            onOpenChange={vi.fn()}
            editTrade={{
              id: 'synthetic-trade',
              date: '2026-01-01',
              ticker: 'AAPL',
              broker: 'Synthetic broker',
              action: 'buy',
              shares: 5,
              price: 10,
              fees: 1,
            }}
          />
        ) : (
          <DividendFormDialog
            open
            onOpenChange={vi.fn()}
            trades={[]}
            editDividend={{
              id: 'synthetic-dividend',
              date: '2026-01-01',
              ticker: 'AAPL',
              amount: 5,
              currency: 'USD',
            }}
          />
        );
      render(
        <AmountVisibilityProvider>
          <Control />
          {editor}
        </AmountVisibilityProvider>
      );
      const input = screen.getByLabelText(label) as HTMLInputElement;
      const form = input.closest('form');
      if (!form) throw new Error('Expected equity form');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: raw } });
      await waitFor(() => expect(input.value).toBe(raw));
      fireEvent.click(screen.getByText('Hide'));
      fireEvent.blur(input);
      await act(async () => {
        await Promise.resolve();
      });
      const save = kind === 'trade' ? saveTrade : saveDividend;
      expect(save).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Show'));
      expect(input.value).toBe(raw);
      if (kind === 'trade') {
        // Check untouched fields as well: a masked blur must not corrupt another
        // native input or the controlled broker while preserving only this one.
        for (const [fieldLabel, defaultValue] of [
          ['Ticker', 'AAPL'],
          ['Date', '2026-01-01'],
          ['Shares', '5'],
          ['Price per Share', '10'],
          ['Fees', '1'],
        ]) {
          expect(
            (screen.getByLabelText(fieldLabel) as HTMLInputElement).value
          ).toBe(fieldLabel === label ? raw : defaultValue);
        }
        expect(screen.getByLabelText('Broker').textContent).toContain(
          'Synthetic broker'
        );
      }
      // Ordinary visible blur still reaches React Hook Form for touched/validation.
      fireEvent.blur(input);
      fireEvent.submit(form);
      await act(async () => {
        await Promise.resolve();
      });
      expect(toast.error).not.toHaveBeenCalled();
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save).toHaveBeenCalledWith({
        id: kind === 'trade' ? 'synthetic-trade' : 'synthetic-dividend',
        data: expect.objectContaining(
          kind === 'trade'
            ? { ...expected, broker: 'Synthetic broker' }
            : expected
        ),
      });
    });
  }
);
