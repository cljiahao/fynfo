// @vitest-environment jsdom
import { DividendCoverageSection } from '@/features/assets/components/dividend-coverage-section';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

const money = (v: number) => `$${Math.round(v)}`;

function renderSection(ttmMonthlyAvg: number | null, cost = 2000) {
  render(
    <DividendCoverageSection
      ttmMonthlyAvg={ttmMonthlyAvg}
      monthlyLivingCost={cost}
      money={money}
    />
  );
}

const states = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => `${li.textContent}:${li.getAttribute('data-state')}`);

describe('DividendCoverageSection', () => {
  it('shows no milestone reached and no allowance with zero dividends', () => {
    renderSection(0);
    expect(states()).toEqual([
      '10% next:next',
      '25%:pending',
      '50%:pending',
      '100%:pending',
    ]);
    expect(
      screen.getByText(/\$2400 more dividends a year reaches 10%/)
    ).toBeTruthy();
    expect(screen.queryByText(/You may spend/)).toBeNull();
  });

  it('marks reached milestones and hides the allowance below the threshold', () => {
    renderSection(300);
    expect(states()).toEqual([
      '10% reached:reached',
      '25% next:next',
      '50%:pending',
      '100%:pending',
    ]);
    expect(screen.getByText(/Dividends cover 15% of living cost/)).toBeTruthy();
    expect(screen.queryByText(/You may spend/)).toBeNull();
  });

  it('shows the allowance at or above the threshold', () => {
    renderSection(600);
    expect(states()[1]).toBe('25% reached:reached');
    expect(
      screen.getByText(
        /spend up to \$300 a month from dividends; the rest \(\$300\)/
      )
    ).toBeTruthy();
  });

  it('shows all milestones reached at 100% and above with no gap', () => {
    renderSection(2500);
    expect(states().every((s) => s.endsWith(':reached'))).toBe(true);
    expect(screen.getByText('Dividends cover your living cost.')).toBeTruthy();
    expect(screen.queryByText(/more dividends a year/)).toBeNull();
  });

  it('renders nothing when dividends cannot be valued', () => {
    renderSection(null);
    expect(screen.queryByTestId('dividend-coverage')).toBeNull();
  });

  it('renders nothing when living cost is not positive', () => {
    renderSection(500, 0);
    expect(screen.queryByTestId('dividend-coverage')).toBeNull();
  });
});
