// @vitest-environment jsdom
import { useSignOut } from '@/features/auth/hooks/use-sign-out';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  clear: vi.fn(),
  lock: vi.fn(),
  logout: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: state.clear }),
}));
vi.mock('@/features/auth/components/vault-lock-context', () => ({
  useVaultLock: () => ({ lock: state.lock }),
}));
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut: state.logout } }),
}));
vi.mock('sonner', () => ({ toast: { error: state.toast } }));
beforeEach(() => {
  vi.clearAllMocks();
  state.logout.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});
it('locks and clears immediately, then tears down keys before auth logout/navigation', async () => {
  let resolveFetch: (value: { ok: boolean }) => void = () => {};
  const fetchMock = vi.fn(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  const view = renderHook(() => useSignOut());
  const navigate = vi.fn();
  vi.stubGlobal('window', { location: { assign: navigate } });
  let pending: Promise<void>;
  act(() => {
    pending = view.result.current.signOut();
  });
  expect(state.clear).toHaveBeenCalledOnce();
  expect(state.lock).toHaveBeenCalledOnce();
  expect(state.logout).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/vault/lock',
    expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
  );
  await act(async () => {
    resolveFetch({ ok: true });
    await pending;
  });
  expect(state.logout).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith('/login');
});
it.each(['non-OK', 'network', 'timeout'])(
  'keeps locked and prevents auth logout/navigation on %s teardown failure',
  async (kind) => {
    vi.stubGlobal(
      'fetch',
      kind === 'non-OK'
        ? vi.fn().mockResolvedValue({ ok: false })
        : vi.fn().mockRejectedValue(new Error(kind))
    );
    const view = renderHook(() => useSignOut());
    const navigate = vi.fn();
    vi.stubGlobal('window', { location: { assign: navigate } });
    await act(async () => {
      await view.result.current.signOut();
    });
    expect(state.lock).toHaveBeenCalledOnce();
    expect(state.clear).toHaveBeenCalledOnce();
    expect(state.logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(
      'Could not log out. Your vault is locked; try again.'
    );
  }
);
it('does not navigate after Supabase signout failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  state.logout.mockResolvedValue({ error: new Error('private detail') });
  const view = renderHook(() => useSignOut());
  const navigate = vi.fn();
  vi.stubGlobal('window', { location: { assign: navigate } });
  await act(async () => {
    await view.result.current.signOut();
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenCalledOnce();
});
