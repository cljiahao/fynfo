// @vitest-environment jsdom
import { SnapshotForm } from '@/features/assets/components/snapshot-form';
import type { SnapshotRecord } from '@/features/assets/types';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  getSnapshots: vi.fn(),
  upsertSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  push: vi.fn(),
}));
const validation = vi.hoisted(() => ({
  gate: undefined as Promise<void> | undefined,
  started: vi.fn(),
}));
vi.mock(
  '@hookform/resolvers/zod',
  async function delayedResolverModule(importOriginal) {
    const actual =
      await importOriginal<typeof import('@hookform/resolvers/zod')>();
    return {
      ...actual,
      zodResolver: function delayedZodResolver(
        ...args: Parameters<typeof actual.zodResolver>
      ) {
        const resolver = actual.zodResolver(...args);
        return async function resolveAfterGate(
          ...values: Parameters<typeof resolver>
        ) {
          validation.started();
          await validation.gate;
          return resolver(...values);
        };
      },
    };
  }
);
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
const original: SnapshotRecord = {
  id: '2026-01',
  snapshotId: 'synthetic-parent',
  revision: '1',
  entries: [
    { category: 'savings', account: 'Synthetic account', amount: 123.45 },
  ],
};
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  validation.gate = undefined;
  api.getSnapshot.mockResolvedValue(original);
  api.getSnapshots.mockResolvedValue([original]);
  api.upsertSnapshot.mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  client?.clear();
});
function mountSnapshot(editId?: string) {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <SnapshotForm editId={editId} />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}
describe('actual snapshot editor draft visibility', () => {
  it('preserves focused registered account and amount drafts when masked inputs receive blur', async () => {
    mountSnapshot('2026-01');
    await screen.findByRole('button', { name: 'Update Snapshot' });
    const account = screen.getByLabelText('Savings account 1');
    const amount = screen.getByLabelText('Savings amount 1');
    fireEvent.focus(account);
    fireEvent.change(account, {
      target: { value: 'Synthetic focused 765.43' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(account).toHaveValue('');
    fireEvent.blur(account);
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(account).toHaveValue('Synthetic focused 765.43');
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '765.43' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(amount).toHaveValue(null);
    fireEvent.blur(amount);
    expect(api.upsertSnapshot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(account).toHaveValue('Synthetic focused 765.43');
    expect(amount).toHaveValue(765.43);
    // Visible blur still flows through the established RHF handler.
    fireEvent.blur(amount);
    const form = amount.closest('form');
    if (!form) throw new Error('Expected snapshot form');
    fireEvent.submit(form);
    await waitFor(() => expect(api.upsertSnapshot).toHaveBeenCalledTimes(1));
    expect(api.upsertSnapshot).toHaveBeenCalledWith(
      {
        id: '2026-01',
        entries: [
          {
            category: 'savings',
            account: 'Synthetic focused 765.43',
            amount: 765.43,
          },
        ],
      },
      '2026-01',
      { snapshotId: 'synthetic-parent', revision: '1' }
    );
  });
  it.each([
    { editId: '2026-01', saveLabel: 'Update Snapshot' },
    { editId: undefined, saveLabel: 'Save Snapshot' },
  ])(
    'retains the $saveLabel draft through Hide/Show and submits its original values',
    async ({ editId, saveLabel }) => {
      const view = mountSnapshot(editId);
      await screen.findByRole('button', { name: saveLabel });
      const account = screen.getByLabelText('Savings account 1');
      const amount = screen.getByLabelText('Savings amount 1');
      if (!editId)
        fireEvent.change(screen.getByLabelText('Select Month'), {
          target: { value: '2026-03' },
        });
      fireEvent.change(account, {
        target: { value: 'Synthetic draft 987.65' },
      });
      fireEvent.change(amount, { target: { value: '987.65' } });
      await waitFor(() => expect(amount).toHaveValue(987.65));
      fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
      expect(account).toHaveValue('');
      expect(amount).toHaveValue(null);
      expect(account).toBeDisabled();
      expect(amount).toBeDisabled();
      expect(view.container.textContent).not.toContain('987.65');
      expect(api.upsertSnapshot).not.toHaveBeenCalled();
      const form = amount.closest('form');
      if (!form) throw new Error('Expected snapshot form');
      fireEvent.submit(form);
      await act(async () => {
        await Promise.resolve();
      });
      expect(api.upsertSnapshot).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
      expect(account).toHaveValue('Synthetic draft 987.65');
      expect(amount).toHaveValue(987.65);
      fireEvent.submit(form);
      await waitFor(() => expect(api.upsertSnapshot).toHaveBeenCalledTimes(1));
      expect(api.upsertSnapshot).toHaveBeenCalledWith(
        {
          id: editId ?? '2026-03',
          entries: [
            {
              category: 'savings',
              account: 'Synthetic draft 987.65',
              amount: 987.65,
            },
          ],
        },
        editId,
        editId ? { snapshotId: 'synthetic-parent', revision: '1' } : undefined
      );
    }
  );
});

describe('snapshot submission visibility boundaries', () => {
  it('rejects hidden initiation before validation even if amounts are immediately shown', async () => {
    mountSnapshot('2026-01');
    await screen.findByRole('button', { name: 'Update Snapshot' });
    const form = screen.getByLabelText('Savings amount 1').closest('form');
    if (!form) throw new Error('Expected snapshot form');
    const callsBefore = validation.started.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    fireEvent.submit(form);
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    await act(async function flushHiddenSubmission() {
      await Promise.resolve();
    });
    expect(validation.started).toHaveBeenCalledTimes(callsBefore);
    expect(api.upsertSnapshot).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(api.upsertSnapshot).toHaveBeenCalledTimes(1));
  });

  it('rejects a visible submission when Hide/Show occurs during asynchronous validation', async () => {
    mountSnapshot('2026-01');
    await screen.findByRole('button', { name: 'Update Snapshot' });
    const form = screen.getByLabelText('Savings amount 1').closest('form');
    if (!form) throw new Error('Expected snapshot form');
    let releaseValidation!: () => void;
    validation.gate = new Promise<void>(function holdValidation(resolve) {
      releaseValidation = resolve;
    });
    const callsBefore = validation.started.mock.calls.length;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(validation.started.mock.calls.length).toBeGreaterThan(callsBefore)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    await act(async function finishStaleValidation() {
      releaseValidation();
      await validation.gate;
    });
    expect(api.upsertSnapshot).not.toHaveBeenCalled();
    validation.gate = undefined;
    fireEvent.submit(form);
    await waitFor(() => expect(api.upsertSnapshot).toHaveBeenCalledTimes(1));
  });
});
