// @vitest-environment jsdom
import {
  TradeFeeBreakdown,
  TradeSummary,
} from '@/features/equity/components/trade-form-summary';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('TradeFeeBreakdown', () => {
  it('renders only the non-zero fee lines plus the total', () => {
    render(
      <TradeFeeBreakdown
        fees={{ commission: 10, platformFee: 0, clearingFee: 2, total: 12 }}
        currency="SGD"
      />
    );
    expect(screen.getByText('Commission')).toBeInTheDocument();
    expect(screen.getByText('Clearing / SGX Fees')).toBeInTheDocument();
    expect(screen.queryByText('Platform Fee')).not.toBeInTheDocument();
    expect(screen.getByText('Total Fees')).toBeInTheDocument();
  });
});

describe('TradeSummary', () => {
  it('shows total value and the incl-fees line for a buy', () => {
    render(
      <TradeSummary tradeValue={1000} fees={5} action="buy" currency="SGD" />
    );
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('Total incl. Fees')).toBeInTheDocument();
  });

  it('omits the incl-fees line when fees are 0', () => {
    render(
      <TradeSummary tradeValue={1000} fees={0} action="buy" currency="SGD" />
    );
    expect(screen.queryByText('Total incl. Fees')).not.toBeInTheDocument();
  });
});
