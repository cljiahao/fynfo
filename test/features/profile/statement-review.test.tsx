// @vitest-environment jsdom
import { StatementReview } from '@/features/import-review';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  extract: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
  read: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/features/import-review/lib/local-pdf', () => ({
  openLocalStatementPdf: mocks.open,
}));
vi.mock('@/features/merchant-rules/actions/rulebook-actions', () => ({
  getMerchantRulebook: async () => null,
  saveMerchantRulebook: vi.fn(),
}));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/lib/import-expense')),
  EXPENSE_TYPE_LABELS: { other: 'Other', groceries: 'Groceries' },
  EXPENSE_KEY: ['expenses'],
  getExpenses: mocks.read,
  insertImportedExpense: mocks.insert,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: 'SGD billed' },
    { page: 1, line: 3, text: '31 DEC SYNTHETIC MARKET 12.30' },
  ]);
  mocks.render.mockResolvedValue(undefined);
  mocks.open.mockResolvedValue({
    pageCount: 2,
    extract: mocks.extract,
    render: mocks.render,
    destroy: mocks.destroy,
  });
});
afterEach(cleanup);
function setup(read = async () => new ArrayBuffer(4), size = 4, manual = true) {
  render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <StatementReview />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  if (manual) {
    fireEvent.change(screen.getByLabelText('Period start'), {
      target: { value: '2025-12-15' },
    });
    fireEvent.change(screen.getByLabelText('Period end'), {
      target: { value: '2026-01-14' },
    });
  }
  const file = new File(['fake'], 'constructed.pdf', {
    type: 'application/pdf',
  });
  Object.defineProperty(file, 'arrayBuffer', { value: read });
  Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(screen.getByLabelText('Bank statement PDF'), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
}
it('keeps secondary information closed until requested without hiding editable fields or blockers', async () => {
  setup();
  expect(await screen.findByText(/1 expense suggestions/)).toBeInTheDocument();
  expect(
    screen.getByText('Change statement').closest('details')
  ).not.toHaveAttribute('open');
  expect(
    screen.getByText('Saved merchant rules').closest('details')
  ).not.toHaveAttribute('open');
  expect(
    screen.getByText('Select purchases, check the details, then save.')
  ).toBeVisible();
  expect(screen.queryByText('Include expense')).not.toBeInTheDocument();

  expect(screen.getByLabelText('Description')).toBeVisible();
  expect(screen.getByLabelText('SGD billed amount')).toBeVisible();
  expect(screen.getByLabelText('Classification')).not.toBeVisible();
  fireEvent.click(screen.getByText('Details'));
  expect(screen.getByLabelText('Classification')).toBeVisible();
  fireEvent.click(screen.getByText('Details'));
  fireEvent.change(screen.getByLabelText('SGD billed amount'), {
    target: { value: '-1.00' },
  });
  expect(
    screen.getByText(
      'Enter a positive SGD amount with exactly two decimal places.'
    )
  ).toBeVisible();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('reviews editable drafts, keeps provenance, navigates source pages and clears locally', async () => {
  setup();
  expect(await screen.findByText(/1 expense suggestions/)).toBeVisible();
  expect(screen.getByLabelText('SGD billed amount')).toHaveValue('12.30');
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Edited draft' },
  });
  fireEvent.change(screen.getByLabelText('Category'), {
    target: { value: 'groceries' },
  });
  fireEvent.click(screen.getByRole('button', { name: /View source page/ }));
  expect(
    screen.getByText(/Source page 1, line 3: 31 DEC SYNTHETIC MARKET/)
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() =>
    expect(mocks.render).toHaveBeenCalledWith(2, expect.any(HTMLCanvasElement))
  );
  fireEvent.click(screen.getByRole('button', { name: 'Extracted' }));
  expect(screen.getByLabelText('Description')).toHaveValue('Edited draft');
  expect(screen.getByLabelText('Category')).toHaveValue('groceries');
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  expect(mocks.insert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  expect(mocks.destroy).toHaveBeenCalled();
  expect(screen.queryByText(/source rows:/)).not.toBeInTheDocument();
});
it('follows the focused draft to its source page while keeping secondary details closed', async () => {
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: '31 DEC FIRST MARKET SGD 12.30' },
    { page: 2, line: 1, text: '01 JAN SECOND MARKET SGD 20.00' },
  ]);
  setup();
  const descriptions = await screen.findAllByLabelText('Description');
  expect(
    screen.getAllByRole('button', { name: /View source page/ })
  ).toHaveLength(2);
  fireEvent.focus(descriptions[1]);
  await waitFor(() =>
    expect(mocks.render).toHaveBeenLastCalledWith(
      2,
      expect.any(HTMLCanvasElement)
    )
  );
  expect(
    screen.getByText(/Source page 2, line 1: 01 JAN SECOND MARKET/)
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Extracted' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(
    screen
      .getAllByText('Details')
      .every((element) => !element.closest('details')!.open)
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  expect(screen.queryByText(/Source page 2, line 1:/)).not.toBeInTheDocument();
  fireEvent.focus(descriptions[0]);
  expect(
    screen.getByText(/Source page 1, line 2: 31 DEC FIRST MARKET/)
  ).toBeInTheDocument();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('opens the first transaction page when a statement begins with a cover page', async () => {
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 2, line: 1, text: '31 DEC FIRST MARKET SGD 12.30' },
  ]);
  setup();
  await screen.findByLabelText('Description');
  await waitFor(() =>
    expect(mocks.render).toHaveBeenLastCalledWith(
      2,
      expect.any(HTMLCanvasElement)
    )
  );
  expect(
    screen.getByText(/Source page 2, line 1: 31 DEC FIRST MARKET/)
  ).toBeInTheDocument();
});
it('updates classification counts, preserves the suggestion and restores it without changing other edits', async () => {
  setup();
  expect(await screen.findByText(/1 expense suggestions/)).toBeVisible();
  screen.getByText('Details').closest('details')!.open = true;
  fireEvent.change(screen.getByLabelText('Classification'), {
    target: { value: 'transfer' },
  });
  expect(
    screen.getByText(/0 expense suggestions, 0 unresolved, 1 excluded/)
  ).toBeInTheDocument();
  expect(screen.getByText(/Suggested: Expense/)).toBeInTheDocument();
  expect(
    screen.getByText('Your classification overrides the suggestion.')
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'My correction' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Restore suggestion' }));
  expect(screen.getByLabelText('Classification')).toHaveValue('expense');
  expect(screen.getByLabelText('Description')).toHaveValue('My correction');
  expect(
    screen.getByText(/1 expense suggestions, 0 unresolved, 0 excluded/)
  ).toBeVisible();
  expect(
    screen.queryByText('Your classification overrides the suggestion.')
  ).not.toBeInTheDocument();
  screen.getByText('Details').closest('details')!.open = true;
  fireEvent.change(screen.getByLabelText('Classification'), {
    target: { value: 'unknown' },
  });
  expect(
    screen.getByText(/0 expense suggestions, 1 unresolved, 0 excluded/)
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /View source page/ }));
  expect(screen.getByText(/31 DEC SYNTHETIC MARKET 12.30/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Extracted' }));
  expect(screen.getByLabelText('Classification')).toHaveValue('unknown');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  expect(screen.queryByLabelText('Classification')).not.toBeInTheDocument();
});
it('keeps source credit blockers after expense overrides and prevents summary classification', async () => {
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: '31 DEC CARD PAYMENT SGD 100.00 CR' },
    { page: 1, line: 3, text: '31 DEC TOTAL BALANCE SGD 100.00' },
  ]);
  setup();
  expect(
    await screen.findByText(/0 expense suggestions, 0 unresolved, 2 excluded/)
  ).toBeVisible();
  const repayment = within(
    screen.getByRole('group', { name: 'Row 1: Excluded from expenses' })
  );
  expect(repayment.getByLabelText('Classification')).toHaveValue(
    'card_repayment'
  );
  fireEvent.change(repayment.getByLabelText('Classification'), {
    target: { value: 'expense' },
  });
  fireEvent.change(repayment.getByLabelText('SGD billed amount'), {
    target: { value: '100.00' },
  });
  expect(
    screen.getByText(/0 expense suggestions, 1 unresolved, 1 excluded/)
  ).toBeVisible();
  expect(
    repayment.getByText(/A source credit cannot be converted/)
  ).toBeVisible();
  repayment.getByText('Details').closest('details')!.open = true;
  expect(repayment.getByText(/Suggested: Card repayment/)).toBeVisible();
  const summary = within(
    screen.getByRole('group', { name: 'Row 2: Excluded from expenses' })
  );
  expect(summary.getByLabelText('Classification')).toBeDisabled();
  fireEvent.change(summary.getByLabelText('Classification'), {
    target: { value: 'expense' },
  });
  expect(summary.getByLabelText('Classification')).toHaveValue('unknown');
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('shows invalid edited expense fields as needing review and recovers when corrected', async () => {
  setup();
  expect(await screen.findByText(/1 expense suggestions/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('SGD billed amount'), {
    target: { value: '-12.30' },
  });
  expect(
    screen.getByText(/0 expense suggestions, 1 unresolved/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Enter a positive SGD amount with exactly two decimal places.'
    )
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText('SGD billed amount'), {
    target: { value: '12.30' },
  });
  expect(screen.getByText(/1 expense suggestions, 0 unresolved/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-02-01' },
  });
  expect(
    screen.getByText('Enter a valid date within the statement period.')
  ).toBeVisible();
});
it('preserves classification through Hide/Show, rejects hidden changes and clears on owner teardown', async () => {
  setup();
  expect(await screen.findByText(/1 expense suggestions/)).toBeVisible();
  const classification = screen.getByLabelText('Classification');
  fireEvent.change(classification, { target: { value: 'transfer' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(classification).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Restore suggestion' })
  ).toBeDisabled();
  expect(screen.getByText(/source rows:/).textContent).not.toMatch(/\d/);
  fireEvent.change(classification, { target: { value: 'expense' } });
  expect(classification).toHaveValue('transfer');
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Show amounts',
    })
  );
  expect(classification).toBeEnabled();
  expect(classification).toHaveValue('transfer');
  expect(
    screen.getByText(/0 expense suggestions, 0 unresolved, 1 excluded/)
  ).toBeVisible();
  cleanup();
  setup();
  expect(await screen.findByLabelText('Classification')).toHaveValue('expense');
});
it('rejects size before reading or opening a worker', async () => {
  const read = vi.fn();
  setup(read, 10 * 1024 * 1024 + 1);
  expect(await screen.findByText(/Choose a PDF up to 10 MiB/)).toBeVisible();
  expect(read).not.toHaveBeenCalled();
  expect(mocks.open).not.toHaveBeenCalled();
});
it('invalidates an outstanding file read on clear', async () => {
  let finish!: (value: ArrayBuffer) => void;
  setup(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  await act(async () => finish(new ArrayBuffer(4)));
  expect(mocks.open).not.toHaveBeenCalled();
  expect(screen.queryByText(/source rows:/)).not.toBeInTheDocument();
});
it('destroys the session and rejects late extraction when closed', async () => {
  let finish!: (value: unknown[]) => void;
  mocks.extract.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  setup();
  await waitFor(() => expect(mocks.extract).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(mocks.destroy).toHaveBeenCalled();
  await act(async () => finish([]));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('shows opaque failures and destroys failed sessions', async () => {
  mocks.extract.mockRejectedValue(new Error('SYNTHETIC-PRIVATE-TEXT'));
  setup();
  expect(
    await screen.findByText(/This PDF or layout could not be extracted/)
  ).toBeVisible();
  expect(screen.queryByText(/SYNTHETIC-PRIVATE/)).not.toBeInTheDocument();
  expect(mocks.destroy).toHaveBeenCalled();
});

it('extracts without manual dates using the printed statement date', async () => {
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: 'Statement Date: 14 JAN 2026' },
    { page: 1, line: 3, text: '31 DEC MARKET SGD 12.30' },
  ]);
  setup(undefined, 4, false);
  expect(screen.getByLabelText('Period start')).not.toBeVisible();
  expect(await screen.findByLabelText('Description')).toHaveValue('MARKET');
  expect(screen.getByLabelText('Date')).toHaveValue('2025-12-31');
  expect(screen.getByLabelText('Period start')).toHaveValue('2025-12-01');
  expect(screen.getByLabelText('Period end')).toHaveValue('2026-01-14');
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('retains the PDF and reveals manual dates when no reliable header is available', async () => {
  setup(undefined, 4, false);
  expect(
    await screen.findByText(/We could not read a clear statement date/)
  ).toBeVisible();
  expect(screen.getByLabelText('Period start')).toBeVisible();
  expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2025-12-15' },
  });
  fireEvent.change(screen.getByLabelText('Period end'), {
    target: { value: '2026-01-14' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  expect(await screen.findByLabelText('Date')).toHaveValue('2025-12-31');
  expect(mocks.open).toHaveBeenCalledTimes(2);
});
it('does not reuse inferred dates for a second PDF', async () => {
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: 'Statement Date: 14 JAN 2026' },
    { page: 1, line: 3, text: '31 DEC MARKET SGD 12.30' },
  ]);
  setup(undefined, 4, false);
  await screen.findByLabelText('Date');
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: 'Statement Date: 14 JAN 2027' },
    { page: 1, line: 3, text: '31 DEC MARKET SGD 12.30' },
  ]);
  const file = new File(['fake'], 'second.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new ArrayBuffer(4),
  });
  fireEvent.change(screen.getByLabelText('Bank statement PDF'), {
    target: { files: [file] },
  });
  expect(screen.getByLabelText('Period start')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  expect(await screen.findByLabelText('Date')).toHaveValue('2026-12-31');
});

it('re-extracts a corrected automatic period without reselecting the PDF and releases it on clear', async () => {
  mocks.extract.mockResolvedValue([
    { page: 1, line: 1, text: 'UOB' },
    { page: 1, line: 2, text: 'Statement Date: 14 JAN 2026' },
    { page: 1, line: 3, text: '31 DEC MARKET SGD 12.30' },
  ]);
  setup(undefined, 4, false);
  await screen.findByLabelText('Date');
  fireEvent.click(screen.getByText('Change statement'));
  fireEvent.click(screen.getByText('Dates (optional)'));
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2025-12-15' },
  });
  expect(
    screen.getByRole('button', { name: 'Extract for review' })
  ).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  expect(await screen.findByLabelText('Date')).toHaveValue('2025-12-31');
  expect(screen.getByLabelText('Period start')).toHaveValue('2025-12-15');
  expect(mocks.open).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  expect(
    screen.getByRole('button', { name: 'Extract for review' })
  ).toBeDisabled();
});
