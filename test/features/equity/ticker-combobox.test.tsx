// @vitest-environment jsdom
import type { TickerSelection } from '@/features/equity/components/ticker-combobox';
import { TickerCombobox } from '@/features/equity/components/ticker-combobox';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OPTIONS = [
  { ticker: 'AAPL', market: 'US' as const },
  { ticker: 'DBS', market: 'SG' as const },
  { ticker: 'Z74', market: 'SG' as const },
];

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({ onChange }: { onChange?: (v: TickerSelection) => void }) {
  const [value, setValue] = useState<TickerSelection>({ ticker: '' });
  return (
    <>
      <label htmlFor="t">Ticker</label>
      <TickerCombobox
        id="t"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </>
  );
}

describe('TickerCombobox', () => {
  it('is labelled and lists only the given tickers plus Add new ticker', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Ticker' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('listbox', { name: 'Tickers' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['AAPLUS', 'DBSSG', 'Z74SG', 'Add new ticker']);
  });

  it('filters on typing and fills the market of an existing ticker', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Ticker' });
    await user.type(input, 'z7');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Z74SG',
      'Add new ticker',
    ]);
    await user.click(options[0]);
    expect(onChange).toHaveBeenLastCalledWith({ ticker: 'Z74', market: 'SG' });
    expect(input).toHaveValue('Z74');
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Ticker' });
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ ticker: 'DBS', market: 'SG' });
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-activedescendant');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Add new ticker needs an explicit market, none is assumed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Ticker' }));
    await user.click(screen.getByRole('option', { name: 'Add new ticker' }));
    await user.type(screen.getByLabelText('New ticker'), 'nvda');
    expect(onChange).toHaveBeenLastCalledWith({
      ticker: 'NVDA',
      market: undefined,
    });
    expect(screen.getByRole('combobox', { name: 'Market' })).toHaveTextContent(
      'Select market'
    );
  });
});
