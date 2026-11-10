// @vitest-environment jsdom
import { HouseholdYearTable } from '@/features/household/components/household-year-table';
import type { ScheduleEntry } from '@/features/household/lib/household-plan';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

const entry = (
  goalId: string,
  date: string,
  amount: number
): ScheduleEntry => ({
  goalId,
  itemId: null,
  label: goalId,
  date,
  amount,
});

const schedule = [
  entry('g1', '2027-03-01', 1000),
  entry('g2', '2027-09-01', 500),
  entry('g1', '2028-02-01', 2000),
  entry('g1', '2027-12-01', 250),
];
const goals = [
  { id: 'g1', name: 'Wedding' },
  { id: 'g2', name: 'Sofa' },
];

function Hider() {
  const { hideAmounts } = useAmountVisibility();
  return <button onClick={hideAmounts}>Hide amounts</button>;
}

function mount(entries = schedule) {
  return render(
    <AmountVisibilityProvider>
      <Hider />
      <HouseholdYearTable schedule={entries} goals={goals} />
    </AmountVisibilityProvider>
  );
}

afterEach(cleanup);

describe('HouseholdYearTable', () => {
  it('renders nothing for an empty schedule', () => {
    mount([]);
    expect(screen.queryByRole('button', { name: /20/ })).toBeNull();
  });

  it('sums the schedule per calendar year, earliest first', () => {
    mount();
    const rows = screen.getAllByRole('button', { name: /^20/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      '2027$1,750',
      '2028$2,000',
    ]);
  });

  it('expands one year into per-goal sums', async () => {
    mount();
    const year = screen.getByRole('button', { name: /^2027/ });
    expect(year).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(year);
    expect(year).toHaveAttribute('aria-expanded', 'true');
    const lines = screen.getAllByRole('listitem');
    expect(lines.map((line) => line.textContent)).toEqual([
      'Wedding$1,250',
      'Sofa$500',
    ]);
    await userEvent.click(year);
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('masks totals and goal lines when amounts are hidden', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^2027/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(screen.queryByText(/1,750/)).toBeNull();
    const line = screen.getAllByRole('listitem')[0];
    expect(within(line).queryByText(/1,250/)).toBeNull();
    expect(within(line).getAllByText('Hidden')).toHaveLength(2);
    expect(screen.queryByText('Wedding')).toBeNull();
    expect(screen.queryByText('Sofa')).toBeNull();
  });

  it('links each year button to its panel', async () => {
    mount();
    const year = screen.getByRole('button', { name: /^2027/ });
    await userEvent.click(year);
    const panelId = year.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId ?? '')).toContainElement(
      screen.getByText('Wedding')
    );
  });
});
