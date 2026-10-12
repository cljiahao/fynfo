// @vitest-environment jsdom
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import {
  BudgetReserveWorksheet,
  type BudgetReserveWorksheetProps,
} from '@/features/review/components/budget-reserve-worksheet';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);
const ready: BudgetReserveWorksheetProps = {
  month: '2026-01',
  availability: 'ready',
  spending: { status: 'recorded', cents: 10000, expenseCount: 1 },
};
function surface(props: BudgetReserveWorksheetProps) {
  return (
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <BudgetReserveWorksheet {...props} />
    </AmountVisibilityProvider>
  );
}
function open() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Budget and annual reserve plan' })
  );
}
function enter(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('session-only budget and reserve worksheet', () => {
  it('keeps unset distinct from zero and exposes errors without silently rounding', () => {
    render(surface(ready));
    open();
    expect(
      screen.getByText(
        'Enter your own monthly limit to compare recorded spending.'
      )
    ).toBeInTheDocument();
    enter('Monthly spending limit (SGD)', '1.005');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'at most two decimal places'
    );
    expect(
      screen.queryByText(/Recorded spending above your limit:/)
    ).toBeNull();
    enter('Monthly spending limit (SGD)', '0');
    expect(
      screen.getByText(/Recorded spending above your limit:/)
    ).toHaveTextContent('SGD 100.00');
    expect(
      screen.getByText(/Missing records do not mean zero spending/)
    ).toBeInTheDocument();
  });
  it('preserves exact high-value cents instead of a dollar round-trip', () => {
    render(
      surface({
        ...ready,
        spending: {
          status: 'recorded',
          cents: 4503599627370002,
          expenseCount: 1,
        },
      })
    );
    open();
    expect(
      screen.getByText(/Recorded spending · your share:/)
    ).toHaveTextContent('SGD 45,035,996,273,700.02');
    enter('Monthly spending limit (SGD)', '45035996273700.02');
    expect(
      screen.getByText(/Remaining against recorded spending:/)
    ).toHaveTextContent('SGD 0.00');
  });
  it('clears only the monthly limit on month changes and keeps reserve/disclosure drafts', () => {
    const view = render(surface(ready));
    open();
    enter('Monthly spending limit (SGD)', '500');
    enter('Annual cost target (SGD)', '100');
    enter('Amount already reserved (SGD)', '0.01');
    enter('Remaining planned contributions', '4');
    expect(screen.getByText(/Final contribution:/)).toHaveTextContent(
      'SGD 24.99'
    );
    view.rerender(surface({ ...ready, month: '2026-02' }));
    expect(screen.getByLabelText('Monthly spending limit (SGD)')).toHaveValue(
      ''
    );
    expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
      '100'
    );
    expect(
      screen.getByLabelText('Remaining planned contributions')
    ).toHaveValue('4');
    view.rerender(surface(ready));
    expect(screen.getByLabelText('Monthly spending limit (SGD)')).toHaveValue(
      ''
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Budget and annual reserve plan' })
    );
    open();
    expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
      '100'
    );
  });
  it('conceals financial drafts/results and rejects hidden edits while retaining errors and assumptions', () => {
    render(surface(ready));
    open();
    enter('Monthly spending limit (SGD)', '987.65');
    enter('Annual cost target (SGD)', '123.45');
    enter('Amount already reserved (SGD)', '0');
    enter('Remaining planned contributions', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    for (const label of [
      'Monthly spending limit (SGD)',
      'Annual cost target (SGD)',
      'Amount already reserved (SGD)',
      'Remaining planned contributions',
    ]) {
      expect(screen.getByLabelText(label)).toHaveValue('');
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(document.body.textContent).not.toContain('123.45');
    expect(document.body.textContent).not.toContain('987.65');
    expect(document.body.textContent).not.toContain('SGD 100.00');
    expect(document.body.textContent).toContain(
      'No money is moved or reserved'
    );
    enter('Annual cost target (SGD)', '99999');
    fireEvent.click(screen.getAllByRole('button', { name: 'Show amounts' })[0]);
    expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue(
      '123.45'
    );
    expect(screen.getByLabelText('Monthly spending limit (SGD)')).toHaveValue(
      '987.65'
    );
  });
  it('withholds comparisons for unavailable or unrecorded source data and retains the independent reserve draft', () => {
    const view = render(
      surface({ ...ready, spending: { status: 'not-recorded' } })
    );
    open();
    enter('Monthly spending limit (SGD)', '500');
    enter('Annual cost target (SGD)', '1');
    expect(screen.getByText(/your share: Not recorded/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Remaining against recorded spending:/)
    ).toBeNull();
    view.rerender(surface({ ...ready, availability: 'error', spending: null }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Recorded spending is unavailable'
    );
    expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue('1');
    view.rerender(
      surface({
        ...ready,
        spending: {
          status: 'invalid',
          issue: 'splits',
          message: 'Enter valid, nonnegative shares.',
        },
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter valid, nonnegative shares.'
    );
    expect(
      screen.getByRole('link', { name: 'Review expenses' })
    ).toBeInTheDocument();
  });
  it('validates explicit contribution count and explains covered and tiny targets', () => {
    render(surface(ready));
    open();
    enter('Annual cost target (SGD)', '0.02');
    enter('Amount already reserved (SGD)', '0');
    enter('Remaining planned contributions', '13');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'whole contribution count from 1 to 12'
    );
    enter('Remaining planned contributions', '4');
    expect(screen.getByText(/Contribution schedule:/)).toHaveTextContent(
      'SGD 0.01 · SGD 0.01 · SGD 0.00 · SGD 0.00'
    );
    enter('Amount already reserved (SGD)', '1');
    expect(
      screen.getByText(/Target covered by the amount entered:/)
    ).toHaveTextContent('SGD 0.00');
    expect(screen.getByLabelText('Amount already reserved (SGD)')).toHaveValue(
      '1'
    );
  });
  it('clears session-only drafts when the unlocked worksheet owner is unmounted', () => {
    const view = render(surface(ready));
    open();
    enter('Annual cost target (SGD)', '250');
    view.unmount();
    render(surface(ready));
    open();
    expect(screen.getByLabelText('Annual cost target (SGD)')).toHaveValue('');
    expect(screen.getByText(/Session only/)).toBeInTheDocument();
  });
});
