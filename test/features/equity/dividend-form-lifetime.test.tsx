// @vitest-environment jsdom
import { DividendFormDialog } from '@/features/equity/components/dividend-form';
import type { DividendData, EquityTradeData } from '@/features/equity/types';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  provider: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/equity/actions/price-actions', () => ({
  fetchDividends: api.provider,
}));
vi.mock('@/features/equity/hooks/use-dividends', () => ({
  useCreateDividend: () => ({ isPending: false, mutateAsync: api.save }),
  useUpdateDividend: () => ({ isPending: false, mutateAsync: api.save }),
}));
vi.mock('sonner', () => ({
  toast: { success: api.success, error: api.error },
}));
const trades: EquityTradeData[] = [
  {
    id: 'synthetic-trade',
    ticker: 'DBS',
    date: '2026-01-01',
    action: 'buy',
    broker: 'Synthetic broker',
    shares: 100,
    price: 10,
    fees: 0,
  },
];
const points = [{ exDate: '2026-02-01', dpu: 0.2 }];
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fill() {
  fireEvent.change(screen.getByLabelText('Ticker'), {
    target: { value: 'DBS' },
  });
  fireEvent.change(screen.getByLabelText('Payment date'), {
    target: { value: '2026-02-01' },
  });
}
function amount() {
  return (screen.getByLabelText('Amount received') as HTMLInputElement).value;
}
function suggest() {
  fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
}
beforeEach(() => {
  vi.resetAllMocks();
  api.save.mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
});
afterEach(cleanup);
it.each(['success', 'failure'])(
  'suppresses suggestion %s output after editor unmount',
  async (outcome) => {
    const request = deferred<typeof points>();
    api.provider.mockReturnValue(request.promise);
    const view = render(
      <DividendFormDialog open onOpenChange={vi.fn()} trades={trades} />
    );
    fill();
    suggest();
    view.unmount();
    await act(async () => {
      if (outcome === 'success') request.resolve(points);
      else request.reject(new Error('Synthetic provider failure'));
    });
    expect(api.success).not.toHaveBeenCalled();
    expect(api.error).not.toHaveBeenCalled();
  }
);
it('does not overwrite or toast into a closed and reopened editor', async () => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  const close = vi.fn();
  const view = render(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  suggest();
  view.rerender(
    <DividendFormDialog open={false} onOpenChange={close} trades={trades} />
  );
  view.rerender(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  fireEvent.change(screen.getByLabelText('Amount received'), {
    target: { value: '55' },
  });
  await act(async () => {
    request.resolve(points);
  });
  expect(amount()).toBe('55');
  expect(api.success).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Suggest' })).not.toBeDisabled();
});
it.each([
  ['Ticker', 'AAPL'],
  ['Payment date', '2026-03-01'],
  ['Amount received', '55'],
])('rejects a reply after %s changes', async (label, value) => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  render(<DividendFormDialog open onOpenChange={vi.fn()} trades={trades} />);
  fill();
  suggest();
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await act(async () => {
    request.resolve(points);
  });
  expect(amount()).toBe(label === 'Amount received' ? '55' : '0');
  expect(api.success).not.toHaveBeenCalled();
});
it('rejects a reply after currency changes', async () => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  render(<DividendFormDialog open onOpenChange={vi.fn()} trades={trades} />);
  fill();
  suggest();
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Currency' }), {
    key: 'ArrowDown',
  });
  fireEvent.click(await screen.findByRole('option', { name: 'USD' }));
  await act(async () => {
    request.resolve(points);
  });
  expect(amount()).toBe('0');
  expect(api.success).not.toHaveBeenCalled();
});
it('does not apply captured holdings after trade history changes', async () => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  const close = vi.fn();
  const view = render(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  suggest();
  view.rerender(
    <DividendFormDialog
      open
      onOpenChange={close}
      trades={[{ ...trades[0], shares: 50 }]}
    />
  );
  await act(async () => {
    request.resolve(points);
  });
  expect(amount()).toBe('0');
  expect(api.success).not.toHaveBeenCalled();
});
it('does not apply a reply to another distribution record', async () => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  const close = vi.fn();
  const first: DividendData = {
    id: 'synthetic-a',
    ticker: 'DBS',
    date: '2026-02-01',
    amount: 10,
    currency: 'SGD',
  };
  const view = render(
    <DividendFormDialog
      open
      onOpenChange={close}
      trades={trades}
      editDividend={first}
    />
  );
  suggest();
  view.rerender(
    <DividendFormDialog
      open
      onOpenChange={close}
      trades={trades}
      editDividend={{ ...first, id: 'synthetic-b', amount: 75 }}
    />
  );
  await act(async () => {
    request.resolve(points);
  });
  expect(amount()).toBe('75');
  expect(api.success).not.toHaveBeenCalled();
});
it('suppresses an old error after relevant inputs change', async () => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  render(<DividendFormDialog open onOpenChange={vi.fn()} trades={trades} />);
  fill();
  suggest();
  fireEvent.change(screen.getByLabelText('Ticker'), {
    target: { value: 'AAPL' },
  });
  await act(async () => {
    request.reject(new Error('Synthetic provider failure'));
  });
  expect(api.error).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Suggest' })).not.toBeDisabled();
});
it('does not toast or close a newer editor after an old save completes', async () => {
  const request = deferred<void>();
  api.save.mockReturnValue(request.promise);
  const close = vi.fn();
  const view = render(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  fireEvent.change(screen.getByLabelText('Amount received'), {
    target: { value: '20' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add distribution' }));
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {
    request.resolve();
  });
  expect(api.success).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it('keeps a new editor suggestion pending when an older lifetime completes', async () => {
  const oldRequest = deferred<typeof points>();
  const newRequest = deferred<typeof points>();
  api.provider
    .mockReturnValueOnce(oldRequest.promise)
    .mockReturnValueOnce(newRequest.promise);
  const close = vi.fn();
  const view = render(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  suggest();
  view.rerender(
    <DividendFormDialog open={false} onOpenChange={close} trades={trades} />
  );
  view.rerender(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  suggest();
  await act(async () => {
    oldRequest.resolve(points);
  });
  expect(amount()).toBe('0');
  expect(screen.getByRole('button', { name: 'Suggest' })).toBeDisabled();
  expect(api.success).not.toHaveBeenCalled();
  await act(async () => {
    newRequest.resolve(points);
  });
  expect(amount()).toBe('20');
  expect(screen.getByRole('button', { name: 'Suggest' })).not.toBeDisabled();
  expect(api.success).toHaveBeenCalledExactlyOnceWith(
    'Amount suggested. Review before saving.'
  );
});
it('does not close or report a late saved record after close/reopen', async () => {
  const request = deferred<void>();
  api.save.mockReturnValue(request.promise);
  const close = vi.fn();
  const view = render(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  fireEvent.change(screen.getByLabelText('Amount received'), {
    target: { value: '20' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add distribution' }));
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
  view.rerender(
    <DividendFormDialog open={false} onOpenChange={close} trades={trades} />
  );
  view.rerender(
    <DividendFormDialog open onOpenChange={close} trades={trades} />
  );
  fill();
  fireEvent.change(screen.getByLabelText('Amount received'), {
    target: { value: '75' },
  });
  await act(async () => {
    request.resolve();
  });
  expect(amount()).toBe('75');
  expect(api.success).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it('rejects a reply when the same record receives updated values', async () => {
  const request = deferred<typeof points>();
  api.provider.mockReturnValue(request.promise);
  const close = vi.fn();
  const first: DividendData = {
    id: 'synthetic-a',
    ticker: 'DBS',
    date: '2026-02-01',
    amount: 10,
    currency: 'SGD',
  };
  const view = render(
    <DividendFormDialog
      open
      onOpenChange={close}
      trades={trades}
      editDividend={first}
    />
  );
  suggest();
  view.rerender(
    <DividendFormDialog
      open
      onOpenChange={close}
      trades={trades}
      editDividend={{ ...first, amount: 75 }}
    />
  );
  await act(async () => {
    request.resolve(points);
  });
  expect(amount()).toBe('75');
  expect(api.success).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Suggest' })).not.toBeDisabled();
});
it('suppresses stale save failure after editor removal', async () => {
  const request = deferred<void>();
  api.save.mockReturnValue(request.promise);
  const view = render(
    <DividendFormDialog open onOpenChange={vi.fn()} trades={trades} />
  );
  fill();
  fireEvent.change(screen.getByLabelText('Amount received'), {
    target: { value: '20' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add distribution' }));
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {
    request.reject(new Error('Synthetic save failure'));
  });
  expect(api.error).not.toHaveBeenCalled();
});
