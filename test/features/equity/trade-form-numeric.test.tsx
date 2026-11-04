// @vitest-environment jsdom
import { TradeFormDialog } from '@/features/equity/components/trade-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createTrade: vi.fn(),
  updateTrade: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('sonner', () => ({
  toast: { success: api.success, error: api.error },
}));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('trade form numeric fields', () => {
  it('shows typed shares verbatim and an error, not 0, when cleared', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <TradeFormDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    const shares = screen.getByLabelText('Shares');
    await user.type(shares, '3500');
    expect(shares).toHaveValue('3500');
    await user.clear(shares);
    expect(shares).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Add Trade' }));
    expect(
      await screen.findByText('Shares must be greater than 0')
    ).toBeInTheDocument();
    expect(api.createTrade).not.toHaveBeenCalled();
  });
});
