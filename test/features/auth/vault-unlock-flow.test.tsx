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
  it('names the PIN field and reveals the dashboard without any mounted queries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
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
    fireEvent.change(screen.getByLabelText('6-digit vault PIN'), {
      target: { value: '123456' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Unlock Vault' }).closest('form')!
    );
    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  });
});
