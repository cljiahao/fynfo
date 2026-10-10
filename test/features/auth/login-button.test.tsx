// @vitest-environment jsdom
import { LoginButton } from '@/features/auth/components/login-button';
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
const boundary = vi.hoisted(() => ({ oauth: vi.fn() }));
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOAuth: boundary.oauth },
  }),
}));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function renderLogin() {
  render(
    <LoginButton
      provider="google"
      redirectTo="/auth/callback?next=/dashboard"
      label="Sign in with Google"
    />
  );
}
describe('OAuth entry', () => {
  it.each(['returned', 'thrown'])(
    'shows opaque %s failures and permits retry',
    async (kind) => {
      if (kind === 'returned')
        boundary.oauth.mockResolvedValueOnce({
          error: { message: 'private provider detail' },
        });
      else
        boundary.oauth.mockRejectedValueOnce(
          new Error('private provider detail')
        );
      boundary.oauth.mockResolvedValueOnce({ error: null });
      renderLogin();
      fireEvent.click(screen.getByRole('button'));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Couldn’t start sign-in. Please try again.'
      );
      expect(screen.queryByText('private provider detail')).toBeNull();
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(boundary.oauth).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );
  it('prevents overlapping PKCE starts and waits for successful browser navigation', async () => {
    let finish!: (value: { error: null }) => void;
    boundary.oauth.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    renderLogin();
    act(() => {
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByRole('button'));
    });
    expect(boundary.oauth).toHaveBeenCalledOnce();
    expect(boundary.oauth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    expect(screen.getByRole('button')).toBeDisabled();
    await act(async () => finish({ error: null }));
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
