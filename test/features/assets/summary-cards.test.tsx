// @vitest-environment jsdom
import { SummaryCards } from '@/features/assets/components/summary-cards';
import type {
  AssetCategory,
  SnapshotWithTotals,
} from '@/features/assets/types';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const entry = (category: AssetCategory, amount: number) => ({
  category,
  account: 'acct',
  amount,
});

const snap = (
  id: string,
  entries: ReturnType<typeof entry>[]
): SnapshotWithTotals => ({
  id,
  entries,
  total: entries.reduce((s, e) => s + e.amount, 0),
});

afterEach(cleanup);

describe('SummaryCards', () => {
  it('shows month-over-month gains with sign and percent', () => {
    render(
      <SummaryCards
        snapshots={[
          snap('2026-04', [
            entry('savings', 1000),
            entry('stocks', 500),
            entry('pension', 200),
          ]),
          snap('2026-05', [
            entry('savings', 1200),
            entry('stocks', 800),
            entry('pension', 200),
          ]),
        ]}
      />
    );

    // Savings 1000 → 1200 = +20%; Investment (stocks) 500 → 800 = +60%.
    expect(screen.getByText(/\+20\.0% from 2026-04/)).toBeInTheDocument();
    expect(screen.getByText(/\+60\.0% from 2026-04/)).toBeInTheDocument();
    // Latest snapshot id labels the Total / Excl-Pension cards.
    expect(screen.getAllByText('2026-05').length).toBeGreaterThanOrEqual(1);
  });

  it('shows a negative percent when a category falls', () => {
    render(
      <SummaryCards
        snapshots={[
          snap('2026-04', [entry('savings', 1000)]),
          snap('2026-05', [entry('savings', 600)]),
        ]}
      />
    );

    expect(screen.getByText(/-40\.0% from 2026-04/)).toBeInTheDocument();
  });

  it('falls back to "No previous month" with a single snapshot', () => {
    render(
      <SummaryCards snapshots={[snap('2026-05', [entry('savings', 600)])]} />
    );

    expect(screen.getAllByText('No previous month')).toHaveLength(2);
  });
});
