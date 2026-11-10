// @vitest-environment jsdom
import {
  PlannerSettingsSheet,
  type PlannerSettingsValues,
} from '@/features/assets/components/planner-settings-sheet';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const values: PlannerSettingsValues = {
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: false,
  tithePctInput: 10,
  allowanceEnabled: false,
  allowancePctInput: 5,
  expenseBufferPct: 0,
};

async function openAndType(raw: string) {
  const onChange = vi.fn();
  render(
    <AmountVisibilityProvider>
      <PlannerSettingsSheet values={values} onChange={onChange} />
    </AmountVisibilityProvider>
  );
  await userEvent.click(screen.getByText('Adjust settings'));
  const input = await screen.findByLabelText(/buffer/i);
  fireEvent.change(input, { target: { value: raw } });
  return onChange;
}

describe('PlannerSettingsSheet expense buffer', () => {
  it('clamps values above 100', async () => {
    const onChange = await openAndType('150');
    expect(onChange).toHaveBeenCalledWith({ expenseBufferPct: 100 });
  });

  it('clamps negative values to 0', async () => {
    const onChange = await openAndType('-5');
    expect(onChange).toHaveBeenCalledWith({ expenseBufferPct: 0 });
  });

  it('passes through in-range values', async () => {
    const onChange = await openAndType('15');
    expect(onChange).toHaveBeenCalledWith({ expenseBufferPct: 15 });
  });
});
