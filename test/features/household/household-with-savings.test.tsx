// @vitest-environment jsdom
import { HouseholdWithSavings } from '@/app/dashboard/household/household-with-savings';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  report: null as null | ((surplus: number | null) => void),
  mounts: 0,
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function Reporter({
      onSurplus,
    }: {
      onSurplus: (surplus: number | null) => void;
    }) {
      state.report = onSurplus;
      return null;
    },
}));

vi.mock('@/features/household', () => ({
  HouseholdOverview: function OverviewStub({
    personalSurplus,
  }: {
    personalSurplus: number | null;
  }) {
    const [tab, setTab] = useState('goals');
    state.mounts += 1;
    return (
      <div>
        <button onClick={() => setTab('spending')}>Spending tab</button>
        <p data-testid="tab">{tab}</p>
        <p data-testid="surplus">{String(personalSurplus)}</p>
      </div>
    );
  },
}));

afterEach(cleanup);

describe('HouseholdWithSavings', () => {
  it('keeps the overview state when the surplus arrives', async () => {
    render(<HouseholdWithSavings />);
    await userEvent.click(screen.getByRole('button', { name: 'Spending tab' }));
    expect(screen.getByTestId('tab')).toHaveTextContent('spending');
    expect(screen.getByTestId('surplus')).toHaveTextContent('null');

    act(() => state.report?.(1234));

    expect(screen.getByTestId('surplus')).toHaveTextContent('1234');
    expect(screen.getByTestId('tab')).toHaveTextContent('spending');
  });
});
