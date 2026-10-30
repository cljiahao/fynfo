// @vitest-environment jsdom
import { StatementSourceForm } from '@/features/import-review/components/statement-source-form';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({ hidden: false, canReveal: () => true }),
}));

afterEach(cleanup);

function setup(overrides: { from?: string; to?: string } = {}) {
  const onExtract = vi.fn();
  const onPeriodChange = vi.fn();
  const onUsePdfDates = vi.fn();
  const element = (manualPeriod: boolean) => (
    <StatementSourceForm
      controlId="t"
      bank="dbs"
      from={overrides.from ?? ''}
      to={overrides.to ?? ''}
      manualPeriod={manualPeriod}
      detectedBasis={null}
      busy={false}
      fileName="a.pdf"
      onBankChange={vi.fn()}
      onFileChange={vi.fn()}
      onPeriodChange={onPeriodChange}
      onUsePdfDates={onUsePdfDates}
      onClear={vi.fn()}
      onExtract={onExtract}
    />
  );
  const view = render(element(true));
  return {
    onExtract,
    onPeriodChange,
    onUsePdfDates,
    view,
    setManualPeriod: (value: boolean) => view.rerender(element(value)),
  };
}

function submit() {
  const form = screen.getByRole('button', { name: /extract/i }).closest('form');
  if (!form) throw new Error('form not found');
  fireEvent.submit(form);
}

it('shows an alert and reopens collapsed details instead of a native dead end', () => {
  const { onExtract, view } = setup();
  const details = view.container.querySelector('details');
  if (!details) throw new Error('details not found');
  details.open = false;
  fireEvent(details, new Event('toggle'));
  expect(screen.getByLabelText('Period start')).not.toBeRequired();
  expect(screen.getByLabelText('Period end')).not.toBeRequired();

  submit();

  expect(screen.getByRole('alert')).toHaveTextContent(/both period dates/i);
  expect(details.open).toBe(true);
  expect(onExtract).not.toHaveBeenCalled();
});

it('extracts when both dates are filled', () => {
  const { onExtract } = setup({ from: '2026-01-01', to: '2026-01-31' });
  submit();
  expect(onExtract).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('focuses Period start when it is empty', async () => {
  setup();
  submit();
  await waitFor(() =>
    expect(screen.getByLabelText('Period start')).toHaveFocus()
  );
  expect(screen.getByLabelText('Period start')).toHaveAttribute(
    'aria-describedby',
    't-period-error'
  );
});

it('focuses Period end when only the end is empty', async () => {
  setup({ from: '2026-01-01' });
  submit();
  await waitFor(() =>
    expect(screen.getByLabelText('Period end')).toHaveFocus()
  );
  expect(screen.getByLabelText('Period start')).not.toHaveAttribute(
    'aria-describedby'
  );
  expect(screen.getByLabelText('Period start')).not.toHaveAttribute(
    'aria-invalid'
  );
});

it('clears the error when using the dates from the PDF', () => {
  const { onUsePdfDates } = setup();
  submit();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /use dates from pdf/i }));
  expect(onUsePdfDates).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('drops a stale error when manualPeriod turns off elsewhere', () => {
  const { setManualPeriod } = setup();
  submit();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  setManualPeriod(false);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('clears the error after a date change', () => {
  const { onPeriodChange } = setup();
  submit();
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2026-01-01' },
  });
  expect(onPeriodChange).toHaveBeenCalledWith('from', '2026-01-01');
  expect(screen.queryByRole('alert')).toBeNull();
});
