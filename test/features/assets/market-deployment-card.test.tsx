// @vitest-environment jsdom
import { TooltipProvider } from '@/components/ui/tooltip';
import { MarketDeploymentCard } from '@/features/assets/components/market-deployment-card';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

const market = {
  label: 'SG',
  quarterly: 1000,
  spent: 400,
  equity: 2500,
  target: 5000,
  available: 2500,
  deployPct: 50,
};

function renderCard() {
  return render(
    <TooltipProvider>
      <MarketDeploymentCard
        market={market}
        qLabel="Q2"
        qDaysLeft={12}
        cashAllocPct={60}
      />
    </TooltipProvider>
  );
}

describe('MarketDeploymentCard', () => {
  it('renders the market label, quarter, and days left', () => {
    renderCard();
    expect(screen.getByText(/SG — Q2/)).toBeInTheDocument();
    expect(screen.getByText('12d left')).toBeInTheDocument();
  });

  it('renders the cash-alloc target label and formatted available amount', () => {
    renderCard();
    expect(screen.getByText('Target (60%)')).toBeInTheDocument();
    // available = 2500 -> formatted SGD appears
    expect(screen.getAllByText(/\$2,500/).length).toBeGreaterThan(0);
  });
});
