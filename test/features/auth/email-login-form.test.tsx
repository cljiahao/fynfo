// @vitest-environment jsdom
import { EmailLoginForm } from '@/features/auth/components/email-login-form';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: boundary.signIn },
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: boundary.push, refresh: boundary.refresh }),
}));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

function submit(email = 'owner@example.test', password = 'fixture-password') {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Sign in' }).closest('form')!
  );
}

describe('email sign-in', () => {
  it('rejects invalid credentials locally before contacting authentication', async () => {
    render(<EmailLoginForm />);
    submit('invalid', '');
    expect(await screen.findByText('Enter a valid email')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
    expect(boundary.signIn).not.toHaveBeenCalled();
  });

  it('waits for authentication and navigates only after success', async () => {
    let finish!: (value: { error: null }) => void;
    boundary.signIn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<EmailLoginForm />);
    submit();
    await waitFor(() =>
      expect(boundary.signIn).toHaveBeenCalledWith({
        email: 'owner@example.test',
        password: 'fixture-password',
      })
    );
    expect(
      (screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(boundary.push).not.toHaveBeenCalled();
    finish({ error: null });
    await waitFor(() =>
      expect(boundary.push).toHaveBeenCalledWith('/dashboard')
    );
    expect(boundary.refresh).toHaveBeenCalledOnce();
  });

  it('hides provider details and permits retry after a rejected password', async () => {
    boundary.signIn
      .mockResolvedValueOnce({ error: { message: 'private provider detail' } })
      .mockResolvedValueOnce({ error: null });
    render(<EmailLoginForm />);
    submit();
    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(screen.queryByText('private provider detail')).toBeNull();
    expect(boundary.push).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(boundary.push).toHaveBeenCalledOnce());
    expect(screen.queryByText('Invalid email or password')).toBeNull();
  });
});
