// @vitest-environment jsdom
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReliefRow } from '@/features/salary/components/relief-row';
import { RELIEF_CATALOG } from '@/features/salary/constants';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

// A plain (non-countable, non-variant) relief from the catalog.
const standardDef = RELIEF_CATALOG.find((d) => !d.maxCount && !d.variants)!;

function renderRow(onUpdate = vi.fn()) {
  render(
    <TooltipProvider>
      <ReliefRow def={standardDef} state={undefined} onUpdate={onUpdate} />
    </TooltipProvider>
  );
  return onUpdate;
}

describe('ReliefRow', () => {
  it('renders the relief label', () => {
    renderRow();
    expect(screen.getByText(standardDef.label)).toBeInTheDocument();
  });

  it('calls onUpdate with enabled=true when the checkbox is toggled', async () => {
    const onUpdate = renderRow();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith({ enabled: true });
  });
});
