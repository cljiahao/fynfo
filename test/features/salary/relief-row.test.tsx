// @vitest-environment jsdom
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReliefRow } from '@/features/salary/components/relief-row';
import { RELIEF_CATALOG } from '@/features/salary/constants';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

it('names a standard relief amount and retains its disabled state and numeric update', () => {
  const update = vi.fn();
  const def = RELIEF_CATALOG.find((entry) => entry.key === 'srs')!;
  const view = render(
    <TooltipProvider>
      <ReliefRow def={def} state={undefined} onUpdate={update} />
    </TooltipProvider>
  );
  expect(
    screen.getByRole('spinbutton', { name: def.label + ' amount (SGD)' })
  ).toBeDisabled();
  view.rerender(
    <TooltipProvider>
      <ReliefRow
        def={def}
        state={{ enabled: true, amount: 100, count: 1, variant: '' }}
        onUpdate={update}
      />
    </TooltipProvider>
  );
  const input = screen.getByRole('spinbutton', {
    name: def.label + ' amount (SGD)',
  });
  expect(input).toHaveValue(100);
  fireEvent.change(input, { target: { value: '200' } });
  expect(update).toHaveBeenCalledWith({ amount: 200 });
});

it.each(['child', 'parent'] as const)(
  'names the %s relief selection and preserves its disabled/default value',
  async (key) => {
    const update = vi.fn();
    const def = RELIEF_CATALOG.find((entry) => entry.key === key)!;
    render(
      <TooltipProvider>
        <ReliefRow def={def} state={undefined} onUpdate={update} />
      </TooltipProvider>
    );
    const name = def.label + (key === 'child' ? ' count' : ' option');
    const control = screen.getByRole('combobox', { name });
    expect(control).toBeDisabled();
    expect(control).toHaveTextContent(
      key === 'child' ? '1' : 'Staying with you'
    );
    await userEvent.click(screen.getByRole('checkbox', { name: def.label }));
    expect(update).toHaveBeenCalledWith(
      key === 'child'
        ? { enabled: true, count: 1, amount: 4000 }
        : { enabled: true, variant: 'staying', amount: 9000 }
    );
  }
);

it('gives repeated relief checkboxes distinct native label targets', () => {
  render(
    <TooltipProvider>
      <ReliefRow def={standardDef} state={undefined} onUpdate={vi.fn()} />
      <ReliefRow def={standardDef} state={undefined} onUpdate={vi.fn()} />
    </TooltipProvider>
  );
  const controls = screen.getAllByRole('checkbox', { name: standardDef.label });
  expect(controls[0].id).not.toBe(controls[1].id);
  const labels = screen
    .getAllByText(standardDef.label)
    .map((text) => text.closest('label')!);
  expect(labels[0]).toHaveAttribute('for', controls[0].id);
  expect(labels[1]).toHaveAttribute('for', controls[1].id);
});

it('routes a second relief label click to that mounted row', async () => {
  const first = vi.fn(),
    second = vi.fn();
  render(
    <TooltipProvider>
      <section aria-label="First relief">
        <ReliefRow def={standardDef} state={undefined} onUpdate={first} />
      </section>
      <section aria-label="Second relief">
        <ReliefRow def={standardDef} state={undefined} onUpdate={second} />
      </section>
    </TooltipProvider>
  );
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Second relief' })).getByText(
      standardDef.label
    )
  );
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith({ enabled: true });
});
