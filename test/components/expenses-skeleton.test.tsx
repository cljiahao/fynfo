// @vitest-environment jsdom
import { ExpensesSkeleton } from '@/app/dashboard/expenses/expenses-skeleton';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ExpensesSkeleton', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('announces loading text in a polite status region', () => {
    render(<ExpensesSkeleton />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Loading expenses');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).not.toContain('Still loading');
  });

  it('adds a still-loading note after the delay', () => {
    vi.useFakeTimers();
    render(<ExpensesSkeleton />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole('status').textContent).toContain('Still loading');
  });

  it('clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<ExpensesSkeleton />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByText(/Still loading/)).toBeNull();
  });
});
