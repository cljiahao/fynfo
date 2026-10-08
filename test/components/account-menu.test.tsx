// @vitest-environment jsdom
import DashboardRouteError from '@/app/dashboard/error';
import { UserMenuDropdown } from '@/components/layout/user-menu-dropdown';
import { VaultLockProvider } from '@/features/auth/components/vault-lock-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

it('exposes account destinations and clears financial cache before logout teardown', async () => {
  const client = new QueryClient();
  client.setQueryData(['snapshots'], ['fixture financial data']);
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <VaultLockProvider initiallyUnlocked>
          <UserMenuDropdown name="Fixture Owner" email="owner@example.test" />
        </VaultLockProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
  const logout = await screen.findByRole('menuitem', { name: 'Log out' });
  expect(screen.getByText('Fixture Owner')).toBeTruthy();
  expect(screen.getByText('owner@example.test')).toBeTruthy();
  expect(
    screen.getByRole('menuitem', { name: 'Profile' }).getAttribute('href')
  ).toBe('/dashboard/profile');
  fireEvent.click(logout);
  expect(client.getQueryData(['snapshots'])).toBeUndefined();
  expect(fetch).toHaveBeenCalledWith(
    '/api/vault/lock',
    expect.objectContaining({ method: 'POST' })
  );
});

it.each([undefined, 'fixture-correlation'])(
  'contains private errors and offers a real reset callback (%s)',
  (digest) => {
    const reset = vi.fn();
    render(
      <DashboardRouteError
        error={Object.assign(new Error('private financial detail'), { digest })}
        reset={reset}
      />
    );
    expect(screen.queryByText('private financial detail')).toBeNull();
    if (digest) expect(screen.getByText(`Reference: ${digest}`)).toBeTruthy();
    else expect(screen.queryByText(/Reference:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  }
);
