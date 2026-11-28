// @vitest-environment jsdom
import { CreateCallerDialog } from '@/features/investment-api/components/callers-dialogs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createCallerAction = vi.fn();
vi.mock('@/features/investment-api/actions/callers-actions', () => ({
  listCallers: vi.fn(async () => []),
  createCallerAction: (input: unknown) => createCallerAction(input),
  addKeyAction: vi.fn(),
  revokeKeyAction: vi.fn(),
  revokeCallerAction: vi.fn(),
  setSealingKeyAction: vi.fn(),
}));

const KEY_A = 'A'.repeat(43) + '=';
const KEY_B = 'B'.repeat(43) + '=';

afterEach(() => {
  cleanup();
  createCallerAction.mockReset();
});

describe('CreateCallerDialog', () => {
  it('leaves the form and prompts for a key after a partial create', async () => {
    createCallerAction.mockResolvedValue({
      ok: false,
      partial: true,
      callerId: 'c1',
      message: 'Caller created; add a signing key from the list.',
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateCallerDialog />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create caller' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'ballast' },
    });
    fireEvent.change(screen.getByLabelText(/Signing public key/), {
      target: { value: KEY_A },
    });
    fireEvent.change(screen.getByLabelText(/Sealing public key/), {
      target: { value: KEY_B },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText(
        'Caller created; add a signing key from the list.'
      )
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    );
    expect(createCallerAction).toHaveBeenCalledTimes(1);
  });
});
