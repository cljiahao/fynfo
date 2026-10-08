// @vitest-environment jsdom
import { ProfileForm } from '@/features/profile/components/profile-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: () => <input type="checkbox" />,
}));
vi.mock('@/features/profile/hooks/use-profile', () => ({
  useProfile: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch,
  }),
  useUpsertProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
afterEach(cleanup);

describe('ProfileForm read errors', () => {
  it('offers retry instead of an editable default profile', () => {
    render(<ProfileForm />);
    expect(screen.queryByText('Save Profile')).toBeNull();
    expect(screen.queryByLabelText('Birth Year')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
