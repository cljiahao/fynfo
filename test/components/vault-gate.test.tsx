// @vitest-environment jsdom
import { VaultGate } from '@/components/layout/vault-gate';
import { VaultLockProvider, useVaultLock } from '@/features/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/components/vault-unlock-flow', () => ({
  VaultUnlockFlow: ({ onUnlocked }: { onUnlocked: () => void }) => (
    <button onClick={onUnlocked}>Unlock test vault</button>
  ),
}));

function FinancialContent() {
  const { lock } = useVaultLock();
  return <button onClick={lock}>Sensitive financial editor</button>;
}

afterEach(cleanup);

describe('VaultGate', () => {
  it('does not mount financial content while locked and removes it on relock', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <VaultLockProvider initiallyUnlocked={false}>
          <VaultGate>
            <FinancialContent />
          </VaultGate>
        </VaultLockProvider>
      </QueryClientProvider>
    );
    expect(screen.queryByText('Sensitive financial editor')).toBeNull();
    fireEvent.click(screen.getByText('Unlock test vault'));
    fireEvent.click(screen.getByText('Sensitive financial editor'));
    expect(screen.queryByText('Sensitive financial editor')).toBeNull();
    expect(screen.getByText('Unlock test vault')).toBeTruthy();
  });
});
