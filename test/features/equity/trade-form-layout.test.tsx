// @vitest-environment jsdom
import { TradeFormDialog } from '@/features/equity/components/trade-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getTrades: vi.fn().mockResolvedValue([]),
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

describe('trade form layout', () => {
  it('puts the ticker and the action buttons in separate, non-grid rows', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TradeFormDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    const tickerRow = screen.getByTestId('trade-ticker-row');
    const actionRow = screen.getByTestId('trade-action-row');
    expect(tickerRow).not.toBe(actionRow);
    expect(tickerRow.contains(actionRow)).toBe(false);
    expect(actionRow.contains(tickerRow)).toBe(false);
    expect(tickerRow.parentElement).toBe(actionRow.parentElement);
    expect(tickerRow.parentElement).not.toHaveClass('grid-cols-2');
    expect(screen.getByRole('button', { name: 'Buy' })).toHaveClass('flex-1');
  });
});
