// @vitest-environment jsdom
import { PlannerInputs } from '@/features/assets/components/planner-inputs';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function renderInputs(overrides = {}) {
  const props = {
    salary: 5000,
    expenses: 2000,
    emergencyMonths: 3,
    warChestMonths: 9,
    avgExpenses: 2000,
    setSalary: vi.fn(),
    setExpenses: vi.fn(),
    setEmergencyMonths: vi.fn(),
    setWarChestMonths: vi.fn(),
    ...overrides,
  };
  render(<PlannerInputs {...props} />);
  return props;
}

describe('PlannerInputs', () => {
  it('renders the four labels (avg-expenses variant)', () => {
    renderInputs();
    expect(screen.getByText('Gross Salary')).toBeInTheDocument();
    expect(screen.getByText('Avg. Expenses')).toBeInTheDocument();
    expect(screen.getByText('Emergency Fund (months)')).toBeInTheDocument();
    expect(screen.getByText('War Chest (months)')).toBeInTheDocument();
  });

  it('shows "Est. Expenses" when avgExpenses is 0', () => {
    renderInputs({ avgExpenses: 0 });
    expect(screen.getByText('Est. Expenses')).toBeInTheDocument();
  });

  it('calls setSalary on salary input change', async () => {
    const props = renderInputs({ salary: 0 });
    await userEvent.type(screen.getByDisplayValue(''), '7');
    expect(props.setSalary).toHaveBeenCalledWith(7);
  });
});
