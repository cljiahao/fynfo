// @vitest-environment jsdom
import { VaultLockProvider } from '@/features/auth/components/vault-lock-context';
import { VaultUnlockFlow } from '@/features/auth/components/vault-unlock-flow';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const autoScanDividends = vi.fn();

vi.mock(
  '@/features/equity/actions/dividend-actions',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/equity/actions/dividend-actions')
    >()),
    autoScanDividends: () => autoScanDividends(),
  })
);
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
  }),
}));
vi.mock('@/lib/client-crypto', () => ({
  deriveKeyClient: async () => 'test-derived-key',
  deriveKeyLegacy: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  autoScanDividends.mockReset();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ initialized: true }),
      })
      .mockResolvedValue({ ok: true })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function unlock() {
  const onUnlocked = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VaultLockProvider initiallyUnlocked={false}>
        <VaultUnlockFlow onUnlocked={onUnlocked} />
      </VaultLockProvider>
    </QueryClientProvider>
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Unlock Vault',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  fireEvent.change(screen.getByLabelText('6-digit vault PIN'), {
    target: { value: '123456' },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Unlock Vault' }).closest('form')!
  );
  return onUnlocked;
}

describe('unlock with dividend auto-scan', () => {
  it('reveals the vault while the scan is still pending', async () => {
    autoScanDividends.mockReturnValue(new Promise(() => undefined));
    const onUnlocked = await unlock();
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(autoScanDividends).toHaveBeenCalledOnce();
    expect(localStorage.getItem('fynfo:divscan:last:test-user')).toBeNull();
  });

  it('reveals the vault and shows no error when the scan rejects', async () => {
    autoScanDividends.mockRejectedValue(new Error('Dividend scan failed'));
    const onUnlocked = await unlock();
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    await waitFor(() => expect(autoScanDividends).toHaveBeenCalledOnce());
    expect(screen.queryByText(/scan failed/i)).toBeNull();
    expect(localStorage.getItem('fynfo:divscan:last:test-user')).toBeNull();
  });

  it('records the completion time and skips the scan within 24 hours', async () => {
    autoScanDividends.mockResolvedValue({ added: 0 });
    await unlock();
    await waitFor(() =>
      expect(
        localStorage.getItem('fynfo:divscan:last:test-user')
      ).not.toBeNull()
    );
    cleanup();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ initialized: true }),
    } as Response);
    const onUnlocked = await unlock();
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(autoScanDividends).toHaveBeenCalledOnce();
  });
});
