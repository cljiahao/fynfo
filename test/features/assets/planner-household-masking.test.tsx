// @vitest-environment jsdom
import { HouseholdBreakdown } from '@/features/assets/components/planner-household';
import type {
  HouseholdPlan,
  HouseholdPlanInput,
} from '@/features/household/lib/household-plan';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

const input = {
  state: 'ready',
  isDefaultSplit: false,
  callerShares: { default: 50 },
  goals: [{ id: 'g1', name: 'Wedding' }],
  budgets: [],
} as unknown as HouseholdPlanInput;

const plan = {
  monthly: 800,
  goalsMonthly: 800,
  budgetsMonthly: 0,
  bindingMonths: 6,
  surplusUsed: 0,
  schedule: [
    {
      goalId: 'g1',
      itemId: null,
      label: 'Wedding',
      date: '2027-03-01',
      amount: 800,
    },
  ],
  perGoal: [{ goalId: 'g1', scheduleTotal: 800, surplusUsed: 0, monthly: 800 }],
} as unknown as HouseholdPlan;

function Hider() {
  const { hideAmounts } = useAmountVisibility();
  return <button onClick={hideAmounts}>Hide amounts</button>;
}

afterEach(cleanup);

describe('HouseholdBreakdown masking', () => {
  it('masks the goal link text and year-table names when amounts are hidden', async () => {
    render(
      <AmountVisibilityProvider>
        <Hider />
        <HouseholdBreakdown
          input={input}
          plan={plan}
          recommendations={[
            {
              kind: 'covered',
              goalId: 'g1',
              label: 'Wedding',
              amounts: { covered: 100 },
              dates: {},
            },
          ]}
          now={new Date(2026, 10, 10)}
        />
      </AmountVisibilityProvider>
    );
    expect(screen.getAllByText(/Wedding/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    await userEvent.click(screen.getByRole('button', { name: /^2027/ }));
    expect(screen.queryByText(/Wedding/)).toBeNull();
    const link = screen.getAllByRole('link')[0];
    expect(link).toHaveTextContent('Hidden');
    expect(link).toHaveAttribute('href', expect.stringContaining('g1'));
  });
});
