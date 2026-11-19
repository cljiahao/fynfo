// @vitest-environment jsdom
import EquityPage from '@/app/dashboard/equity/page';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ query: '' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock('@/features/equity', () => ({
  useTrades: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  PortfolioSummary: () => <p>summary</p>,
  HoldingsTable: () => <p>holdings</p>,
  TradeTable: () => <p>trades</p>,
  DistributionsSection: () => <p>distributions</p>,
  TradeFormDialog: () => null,
}));

afterEach(cleanup);

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('equity page tab param', () => {
  it('opens Holdings by default', () => {
    nav.query = '';
    render(<EquityPage />);
    expect(pressed('Holdings')).toBe('true');
    expect(pressed('Dividends')).toBe('false');
  });

  it('opens Dividends for ?tab=dividends', () => {
    nav.query = 'tab=dividends';
    render(<EquityPage />);
    expect(pressed('Dividends')).toBe('true');
    expect(screen.getByText('distributions')).toBeVisible();
  });
});
