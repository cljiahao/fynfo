// @vitest-environment jsdom
import DashboardLayout from '@/app/dashboard/layout';
import { Providers } from '@/components/layout/providers';
import { useVaultLock } from '@/features/auth';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  callbacks: new Set<
    (event: string, session: { user: { id: string } } | null) => void
  >(),
  unsubscribe: vi.fn(),
  serverUserId: 'fixture-account-a',
  failFactory: false,
  failSubscription: false,
}));
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => {
    if (state.failFactory) throw new Error('Synthetic factory failure');
    return {
      auth: {
        onAuthStateChange: (
          callback: (
            event: string,
            session: { user: { id: string } } | null
          ) => void
        ) => {
          if (state.failSubscription)
            throw new Error('Synthetic subscription failure');
          state.callbacks.add(callback);
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  state.unsubscribe();
                  state.callbacks.delete(callback);
                },
              },
            },
          };
        },
      },
    };
  },
}));
vi.mock('@/lib/auth-guard', () => ({
  requireUserId: async () => state.serverUserId,
}));
vi.mock('@/lib/keystore', () => ({
  getVaultDekSession: async () => 'synthetic-unlocked',
}));
vi.mock('@/components/layout/user-menu', () => ({ UserMenu: () => null }));
vi.mock('@/components/layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout')>();
  return { ...actual, DashboardNavbar: () => null, SiteFooter: () => null };
});
vi.mock('@/features/auth/components/idle-lock-watcher', () => ({
  IdleLockWatcher: () => null,
}));
vi.mock('@/features/auth/components/vault-unlock-flow', () => ({
  VaultUnlockFlow: () => <p>Locked synthetic vault</p>,
}));

let client: QueryClient;
let unlockOldLifetime: () => void;
function QueryCapture() {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
    queryClient.setQueryData(
      ['synthetic-financial-record'],
      'Account A synthetic balance'
    );
  }, [queryClient]);
  return null;
}
function FinancialEditor() {
  const { unlock } = useVaultLock();
  useEffect(() => {
    unlockOldLifetime = unlock;
  }, [unlock]);
  const [draft, setDraft] = useState('');
  return (
    <>
      <p>Account A synthetic balance</p>
      <label>
        Financial draft
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
    </>
  );
}
async function mountDashboard() {
  const layout = await DashboardLayout({ children: <FinancialEditor /> });
  return render(
    <Providers>
      <QueryCapture />
      {layout}
    </Providers>
  );
}
function emit(event: string, userId: string | null) {
  act(() => {
    state.callbacks.forEach((callback) =>
      callback(event, userId ? { user: { id: userId } } : null)
    );
  });
}
beforeEach(() => {
  state.callbacks.clear();
  state.serverUserId = 'fixture-account-a';
  state.failFactory = false;
  state.failSubscription = false;
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([
  ['SIGNED_OUT', null],
  ['SIGNED_IN', 'fixture-account-b'],
])('removes old financial data and drafts on %s', async (event, userId) => {
  await mountDashboard();
  fireEvent.change(screen.getByLabelText('Financial draft'), {
    target: { value: 'Account A unsaved draft' },
  });
  expect(client.getQueryData(['synthetic-financial-record'])).toBe(
    'Account A synthetic balance'
  );
  emit(event as string, userId);
  expect(screen.queryByText('Account A synthetic balance')).toBeNull();
  expect(screen.queryByDisplayValue('Account A unsaved draft')).toBeNull();
  expect(client.getQueryData(['synthetic-financial-record'])).toBeUndefined();
});

it.each([
  'INITIAL_SESSION',
  'SIGNED_IN',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
  'PASSWORD_RECOVERY',
])('retains the verified same-account lifetime on %s', async (event) => {
  await mountDashboard();
  fireEvent.change(screen.getByLabelText('Financial draft'), {
    target: { value: 'Retained draft' },
  });
  emit(event, 'fixture-account-a');
  expect(screen.getByDisplayValue('Retained draft')).toBeTruthy();
  expect(client.getQueryData(['synthetic-financial-record'])).toBe(
    'Account A synthetic balance'
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('blocks an initial missing session, including signout before subscription', async () => {
  await mountDashboard();
  emit('INITIAL_SESSION', null);
  expect(screen.queryByText('Account A synthetic balance')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain(
    'could not be confirmed'
  );
  expect(
    screen
      .getByRole('link', { name: 'Continue to sign in' })
      .getAttribute('href')
  ).toBe('/login');
  expect(client.getQueryData(['synthetic-financial-record'])).toBeUndefined();
});
it('cannot reopen the old financial subtree from a late unlock callback or same-user event', async () => {
  await mountDashboard();
  emit('SIGNED_IN', 'fixture-account-b');
  act(() => unlockOldLifetime());
  emit('SIGNED_IN', 'fixture-account-a');
  expect(screen.queryByText('Account A synthetic balance')).toBeNull();
  expect(screen.queryByText('Locked synthetic vault')).toBeNull();
  expect(screen.getByRole('status')).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('unsubscribes and ignores stale auth callbacks after unmount', async () => {
  const view = await mountDashboard();
  const callback = [...state.callbacks][0];
  view.unmount();
  act(() => callback('SIGNED_OUT', null));
  expect(state.unsubscribe).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
it('does not let a late in-flight query repopulate the cleared cache', async () => {
  await mountDashboard();
  let complete: (value: string) => void = () => {};
  const request = client.fetchQuery({
    queryKey: ['synthetic-late-reply'],
    queryFn: () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  });
  const result = request.catch(() => null);
  emit('SIGNED_OUT', null);
  await act(async () => {
    complete('Old account reply');
    await result;
  });
  expect(client.getQueryData(['synthetic-late-reply'])).toBeUndefined();
  expect(screen.queryByText('Account A synthetic balance')).toBeNull();
});

function mockNavigation() {
  const navigate = vi.fn();
  const actualWindow = window;
  vi.stubGlobal(
    'window',
    new Proxy(actualWindow, {
      get(target, property) {
        return property === 'location'
          ? { assign: navigate }
          : Reflect.get(target, property, target);
      },
    })
  );
  return navigate;
}
it.each(['success', 'non-OK', 'network'])(
  'keeps old UI blocked and performs full navigation after %s cookie teardown',
  async (outcome) => {
    await mountDashboard();
    const navigate = mockNavigation();
    vi.stubGlobal(
      'fetch',
      outcome === 'network'
        ? vi.fn().mockRejectedValue(new Error('Synthetic failure'))
        : vi.fn().mockResolvedValue({ ok: outcome === 'success' })
    );
    await act(async () => {
      state.callbacks.forEach((callback) => callback('SIGNED_OUT', null));
    });
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Account A synthetic balance')).toBeNull();
  }
);
it('does not automatically navigate after uncertain initial session teardown', async () => {
  await mountDashboard();
  const navigate = mockNavigation();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  await act(async () => {
    state.callbacks.forEach((callback) => callback('INITIAL_SESSION', null));
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(
    screen.getByRole('link', { name: 'Continue to sign in' })
  ).toBeTruthy();
});
it('blocks a newly verified layout identity without remounting the old editor', async () => {
  const view = await mountDashboard();
  fireEvent.change(screen.getByLabelText('Financial draft'), {
    target: { value: 'Old draft' },
  });
  state.serverUserId = 'fixture-account-b';
  const layout = await DashboardLayout({ children: <FinancialEditor /> });
  view.rerender(
    <Providers>
      <QueryCapture />
      {layout}
    </Providers>
  );
  expect(screen.queryByText('Account A synthetic balance')).toBeNull();
  expect(screen.queryByDisplayValue('Old draft')).toBeNull();
  expect(client.getQueryData(['synthetic-financial-record'])).toBeUndefined();
  expect(fetch).toHaveBeenCalledOnce();
});
it('does not navigate after teardown completes in an unmounted lifetime', async () => {
  let complete: (value: { ok: boolean }) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    )
  );
  const view = await mountDashboard();
  const navigate = mockNavigation();
  emit('SIGNED_OUT', null);
  view.unmount();
  await act(async () => {
    complete({ ok: true });
  });
  expect(navigate).not.toHaveBeenCalled();
});

it.each(['factory', 'subscription'])(
  'blocks safely when auth %s setup fails',
  async (failure) => {
    state.failFactory = failure === 'factory';
    state.failSubscription = failure === 'subscription';
    const view = await mountDashboard();
    expect(screen.queryByText('Account A synthetic balance')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(client.getQueryData(['synthetic-financial-record'])).toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
    view.unmount();
  }
);
