// @vitest-environment jsdom
import LoginPage from '@/app/(public)/login/page';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/features/auth', async () => ({
  LoginCard: (await import('@/features/auth/components/login-card')).LoginCard,
}));
vi.mock('@/features/auth/components/login-button', () => ({
  LoginButton: () => <button>Sign in with Google</button>,
}));
vi.mock('@/features/auth/components/email-login-form', () => ({
  EmailLoginForm: () => <form aria-label="Email sign in" />,
}));
afterEach(cleanup);
describe('login callback feedback', () => {
  it('shows a recoverable message for the known callback failure', async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: 'auth_callback_failed' }),
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in could not be completed. Please try again.'
    );
    expect(
      screen.getByRole('button', { name: 'Sign in with Google' })
    ).toBeTruthy();
  });
  it.each([
    'private provider detail',
    ['auth_callback_failed', 'private provider detail'],
    undefined,
  ])('does not echo unknown or ambiguous callback query %s', async (error) => {
    render(await LoginPage({ searchParams: Promise.resolve({ error }) }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('private provider detail')).toBeNull();
  });
});
