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
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
  }),
}));
vi.mock('@/lib/client-crypto', () => ({
  deriveKeyClient: async () => 'test-derived-key',
  deriveKeyLegacy: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('VaultUnlockFlow', () => {
  function mount(onUnlocked = vi.fn()) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <VaultLockProvider initiallyUnlocked={false}>
          <VaultUnlockFlow onUnlocked={onUnlocked} />
        </VaultLockProvider>
      </QueryClientProvider>
    );
    return onUnlocked;
  }

  it('requires matching confirmation before creating a first vault', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ initialized: false }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ initialized: true }),
      });
    vi.stubGlobal('fetch', fetch);
    const unlocked = mount();
    await screen.findByRole('heading', { name: 'Create your vault' });
    fireEvent.change(screen.getByLabelText('6-digit vault PIN'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('Confirm vault PIN'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create vault' }));
    expect(await screen.findByText('PINs do not match.')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Confirm vault PIN'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create vault' }));
    await waitFor(() => expect(unlocked).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      '/api/vault',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ derivedKey: 'test-derived-key' }),
      })
    );
  });

  it('blocks failed lifecycle reads and retries without initializing a vault', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('private error'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ initialized: true }),
      });
    vi.stubGlobal('fetch', fetch);
    mount();
    await screen.findByText("Couldn't check your vault. Retry to continue.");
    expect(
      (
        screen.getByRole('button', {
          name: 'Unlock Vault',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.queryByLabelText('Confirm vault PIN')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Unlock Vault',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('private error')).toBeNull();
  });

  it('names the PIN field and reveals the dashboard without any mounted queries', async () => {
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
    const onUnlocked = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <VaultLockProvider initiallyUnlocked={false}>
          <VaultUnlockFlow onUnlocked={onUnlocked} />
        </VaultLockProvider>
      </QueryClientProvider>
    );
    expect(screen.getByRole('dialog', { name: 'Vault Locked' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
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
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  });
});
