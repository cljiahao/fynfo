// @vitest-environment jsdom
import { HouseholdRecommendations } from '@/features/household/components/household-recommendations';
import type { HouseholdRecommendation } from '@/features/household/lib/household-plan';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

const now = new Date(2026, 10, 10);

const pace = (id: string, monthly: number): HouseholdRecommendation => ({
  kind: 'monthly-pace',
  goalId: id,
  label: `Goal ${id}`,
  amounts: { monthly },
  dates: { target: '2027-12-01' },
});

function Hider() {
  const { hideAmounts } = useAmountVisibility();
  return <button onClick={hideAmounts}>Hide amounts</button>;
}

function mount(recommendations: HouseholdRecommendation[]) {
  return render(
    <AmountVisibilityProvider>
      <Hider />
      <HouseholdRecommendations recommendations={recommendations} now={now} />
    </AmountVisibilityProvider>
  );
}

afterEach(cleanup);

describe('HouseholdRecommendations', () => {
  it('renders nothing for an empty list', () => {
    mount([]);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows up to three without a Show all control', () => {
    mount([pace('a', 100), pace('b', 200), pace('c', 300)]);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });

  it('caps at three and reveals the rest with Show all', async () => {
    mount([pace('a', 100), pace('b', 200), pace('c', 300), pace('d', 400)]);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText(/Goal d/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText(/Goal d/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('masks every amount when amounts are hidden', async () => {
    mount([pace('a', 1200)]);
    expect(screen.getByText(/1,200/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(screen.queryByText(/1,200/)).toBeNull();
    expect(screen.getByText(/Hidden a month/)).toBeInTheDocument();
  });
});
