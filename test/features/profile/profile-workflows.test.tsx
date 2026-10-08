// @vitest-environment jsdom
import { ProfileForm } from '@/features/profile/components/profile-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/profile/actions/profile-actions', () => ({
  getProfile: actions.getProfile,
  upsertProfile: actions.upsertProfile,
}));
vi.mock('sonner', () => ({
  toast: { success: actions.success, error: actions.error },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ProfileForm />
    </QueryClientProvider>
  );
  return client;
}

describe('profile workflow', () => {
  it('keeps loading and failed reads away from editable defaults, then retries', async () => {
    actions.getProfile
      .mockRejectedValueOnce(new Error('fixture outage'))
      .mockResolvedValueOnce(null);
    mount();
    expect(screen.queryByLabelText('Birth Year')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Birth Year')).toBeTruthy();
    expect(actions.getProfile).toHaveBeenCalledTimes(2);
  });

  it('saves edited details and refreshes the cached profile', async () => {
    actions.getProfile.mockResolvedValue({
      birthYear: 1990,
      isNsman: false,
      residencyStatus: 'resident',
    });
    actions.upsertProfile.mockResolvedValue(undefined);
    const client = mount();
    fireEvent.change(await screen.findByLabelText('Birth Year'), {
      target: { value: '1988' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'NSman relief (SGD 1,500)' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() =>
      expect(actions.upsertProfile).toHaveBeenCalledWith({
        birthYear: 1988,
        isNsman: true,
        residencyStatus: 'resident',
      })
    );
    await waitFor(() => expect(actions.getProfile).toHaveBeenCalledTimes(2));
    expect(actions.success).toHaveBeenCalledWith('Profile saved');
    expect(client.getQueryData(['profile'])).toEqual({
      birthYear: 1990,
      isNsman: false,
      residencyStatus: 'resident',
    });
  });

  it('preserves input and enables retry after a failed write', async () => {
    actions.getProfile.mockResolvedValue(null);
    actions.upsertProfile
      .mockRejectedValueOnce(new Error('private detail'))
      .mockResolvedValueOnce(undefined);
    mount();
    const birthYear = await screen.findByLabelText('Birth Year');
    fireEvent.change(birthYear, { target: { value: '1995' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() =>
      expect(actions.error).toHaveBeenCalledWith('Failed to save profile')
    );
    expect((birthYear as HTMLInputElement).value).toBe('1995');
    expect(actions.getProfile).toHaveBeenCalledOnce();
    fireEvent.change(birthYear, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
    await waitFor(() =>
      expect(actions.upsertProfile).toHaveBeenLastCalledWith({
        birthYear: null,
        isNsman: false,
        residencyStatus: 'resident',
      })
    );
    await waitFor(() => expect(actions.success).toHaveBeenCalledOnce());
  });
});
