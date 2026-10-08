// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IDLE_LIMIT_MS,
  useIdleLock,
  useVaultLock,
  VaultLockProvider,
} from '@/features/auth';

const ONE_MINUTE = 60 * 1000;

function makeWrapper(initiallyUnlocked: boolean) {
  const queryClient = new QueryClient();
  const clearSpy = vi.spyOn(queryClient, 'clear');
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <VaultLockProvider initiallyUnlocked={initiallyUnlocked}>
          {children}
        </VaultLockProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, clearSpy };
}

// Probe hook: arm the watcher and surface the lock state it manipulates.
function useProbe() {
  useIdleLock();
  return useVaultLock();
}

describe('useIdleLock', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('locks after IDLE_LIMIT_MS of inactivity', async () => {
    const { Wrapper, clearSpy } = makeWrapper(true);
    const { result } = renderHook(useProbe, { wrapper: Wrapper });

    expect(result.current.locked).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS + ONE_MINUTE);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/vault/lock', {
      method: 'POST',
    });
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(result.current.locked).toBe(true);
  });

  it('locks and clears decrypted cache even when the cookie request never settles', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { Wrapper, clearSpy } = makeWrapper(true);
    const { result } = renderHook(useProbe, { wrapper: Wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS + ONE_MINUTE);
    });

    expect(clearSpy).toHaveBeenCalledOnce();
    expect(result.current.locked).toBe(true);
  });

  it('activity before the limit resets the timer (no lock)', async () => {
    const { Wrapper } = makeWrapper(true);
    const { result } = renderHook(useProbe, { wrapper: Wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS - ONE_MINUTE);
    });
    expect(result.current.locked).toBe(false);

    // User activity bumps the clock...
    await act(async () => {
      window.dispatchEvent(new Event('keydown'));
      await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS - ONE_MINUTE);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.locked).toBe(false);
  });

  it('disarms when already locked (no interval, no fetch)', async () => {
    const { Wrapper } = makeWrapper(false);
    const { result } = renderHook(useProbe, { wrapper: Wrapper });

    expect(result.current.locked).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS * 3);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
