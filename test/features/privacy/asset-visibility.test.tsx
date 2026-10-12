// @vitest-environment jsdom
import { CategoryBreakdown } from '@/features/assets/components/category-breakdown';
import { PlannerInputs } from '@/features/assets/components/planner-inputs';
import { SummaryCards } from '@/features/assets/components/summary-cards';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function EditablePlanner() {
  const [salary, setSalary] = useState(7351);
  return (
    <PlannerInputs
      salary={salary}
      expenses={1837}
      emergencyMonths={4}
      warChestMonths={8}
      avgExpenses={1837}
      setSalary={setSalary}
      setExpenses={vi.fn()}
      setEmergencyMonths={vi.fn()}
      setWarChestMonths={vi.fn()}
    />
  );
}

describe('asset amount presentation', () => {
  it('preserves an edited planner draft while concealing all already-open numeric inputs', async () => {
    const user = userEvent.setup();
    render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <EditablePlanner />
      </AmountVisibilityProvider>
    );
    const salary = screen.getByLabelText('Gross Salary');
    fireEvent.change(salary, { target: { value: '8257' } });
    await user.click(screen.getByRole('button', { name: 'Adjust reserves' }));
    expect(salary).toHaveValue(8257);
    await user.click(screen.getByRole('button', { name: 'Hide amounts' }));
    for (const input of screen.getAllByRole('spinbutton')) {
      expect(input).toHaveValue(null);
      expect(input).toBeDisabled();
    }
    expect(document.body.textContent).not.toContain('8257');
    expect(document.body.textContent).not.toContain('1837');
    await user.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(salary).toHaveValue(8257);
    expect(screen.getByLabelText('Emergency Fund (months)')).toHaveValue(4);
  });

  it('rejects direct change events while hidden without changing the restored draft', async () => {
    const user = userEvent.setup();
    render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <EditablePlanner />
      </AmountVisibilityProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Hide amounts' }));
    fireEvent.change(screen.getByLabelText('Gross Salary'), {
      target: { value: '9999' },
    });
    await user.click(screen.getByRole('button', { name: 'Show amounts' }));
    expect(screen.getByLabelText('Gross Salary')).toHaveValue(7351);
  });

  it('conceals totals, signed changes and financial percentages while keeping month labels', async () => {
    const user = userEvent.setup();
    render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <SummaryCards
          snapshots={[
            {
              id: '2026-01',
              total: 4000,
              entries: [
                { category: 'savings', account: 'Synthetic', amount: 4000 },
              ],
            },
            {
              id: '2026-02',
              total: 6000,
              entries: [
                { category: 'savings', account: 'Synthetic', amount: 6000 },
              ],
            },
          ]}
        />
      </AmountVisibilityProvider>
    );
    expect(document.body.textContent).toContain('50.0%');
    await user.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(document.body.textContent).not.toContain('50.0%');
    expect(document.body.textContent).not.toContain('6,000');
    expect(document.body.textContent).not.toContain('+Hidden');
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getAllByText('2026-02')).toHaveLength(2);
  });

  it('removes chart content and financial progress geometry while retaining category labels', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <CategoryBreakdown
          snapshot={{
            id: '2026-02',
            entries: [
              { category: 'savings', account: 'Synthetic', amount: 2468 },
              { category: 'pension', account: 'OA', amount: 1357 },
            ],
          }}
        />
      </AmountVisibilityProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(screen.getByText('Latest Month Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Amounts hidden')).toBeInTheDocument();
    expect(container.querySelector('.recharts-wrapper')).toBeNull();
    expect(container.textContent).not.toContain('2,468');
    expect(container.textContent).not.toContain('1,357');
    for (const bar of container.querySelectorAll('[style*="width"]'))
      expect(bar.getAttribute('style')).toContain('width: 0%');
  });
});
