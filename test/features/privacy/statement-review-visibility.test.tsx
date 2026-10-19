// @vitest-environment jsdom
import { StatementReview } from '@/features/import-review';
import type { StatementLine } from '@/features/import-review/types';
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
const pdf = vi.hoisted(() => ({
  open: vi.fn(),
  extract: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('@/features/import-review/lib/local-pdf', () => ({
  openLocalStatementPdf: pdf.open,
}));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/lib/import-expense')),
  EXPENSE_TYPE_LABELS: { other: 'Other', groceries: 'Groceries' },
  EXPENSE_KEY: ['expenses'],
  IMPORT_SAVE_LIMIT: 500,
  IMPORT_SAVE_GROUP_SIZE: 20,
  IMPORT_SAVE_MAX_BYTES: 512 * 1024,
  IMPORT_REQUEST_TIMEOUT_MS: 30_000,
  getExpenses: vi.fn().mockResolvedValue([]),
  insertImportedExpense: vi.fn(),
  insertImportedExpenses: vi.fn(),
}));
const lines: StatementLine[] = [
  { page: 1, line: 1, text: 'UOB' },
  { page: 1, line: 2, text: 'SGD billed' },
  { page: 1, line: 3, text: '31 DEC SYNTHETIC MARKET 12.30' },
];
beforeEach(() => {
  vi.resetAllMocks();
  pdf.extract.mockResolvedValue(lines);
  pdf.render.mockResolvedValue(undefined);
  pdf.open.mockResolvedValue({
    pageCount: 2,
    extract: pdf.extract,
    render: pdf.render,
    destroy: pdf.destroy,
  });
});
afterEach(cleanup);
function mountReview() {
  return render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <StatementReview />
    </AmountVisibilityProvider>
  );
}
function selectPdf() {
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2025-12-15' },
  });
  fireEvent.change(screen.getByLabelText('Period end'), {
    target: { value: '2026-01-14' },
  });
  const file = new File(['synthetic'], 'constructed.pdf', {
    type: 'application/pdf',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async function readSyntheticPdf() {
      return new ArrayBuffer(4);
    },
  });
  fireEvent.change(screen.getByLabelText('Bank statement PDF'), {
    target: { files: [file] },
  });
}
function hideAmounts() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
}
function showInsideReview() {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Show amounts',
    })
  );
}
it('blocks opening the PDF review while hidden', () => {
  mountReview();
  hideAmounts();
  expect(
    screen.getByRole('button', { name: 'Review bank PDF' })
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(pdf.open).not.toHaveBeenCalled();
});
it('keeps actual editable drafts and labels while removing hidden canvas and selected raw source', async () => {
  mountReview();
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  selectPdf();
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  const amount = await screen.findByLabelText('SGD billed amount');
  const description = screen.getByLabelText('Item / Brand');
  fireEvent.change(amount, { target: { value: '98.76' } });
  fireEvent.change(description, { target: { value: 'Synthetic draft 98.76' } });
  fireEvent.click(screen.getByRole('button', { name: /View source page/ }));
  expect(document.querySelector('canvas')).toBeInTheDocument();
  expect(
    screen.getByText(/Source page 1, line 3: 31 DEC SYNTHETIC MARKET/)
  ).toBeInTheDocument();
  hideAmounts();
  expect(amount).toHaveValue('');
  expect(description).toHaveValue('');
  expect(amount).toBeDisabled();
  expect(description).toBeDisabled();
  expect(document.querySelector('canvas')).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain('SYNTHETIC MARKET');
  expect(document.body.textContent).not.toContain('98.76');
  expect(screen.getByLabelText('Bank statement PDF')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Extract for review' })
  ).toBeDisabled();
  const form = screen.getByLabelText('Bank statement PDF').closest('form');
  if (!form) throw new Error('Expected PDF form');
  fireEvent.submit(form);
  expect(pdf.open).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Your PDF stays on this device/)).toBeInTheDocument();
  showInsideReview();
  expect(amount).toHaveValue('98.76');
  expect(description).toHaveValue('Synthetic draft 98.76');
  expect(document.querySelector('canvas')).toBeInTheDocument();
  expect(
    screen.getByText(/Source page 1, line 3: 31 DEC SYNTHETIC MARKET/)
  ).toBeInTheDocument();
  expect(pdf.destroy).not.toHaveBeenCalled();
});
it('disposes an open PDF and rejects late extraction after Hide then Show', async () => {
  let finish!: (value: StatementLine[]) => void;
  pdf.extract.mockImplementation(
    () =>
      new Promise<StatementLine[]>(function holdExtraction(resolve) {
        finish = resolve;
      })
  );
  mountReview();
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  selectPdf();
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  await waitFor(() => expect(pdf.extract).toHaveBeenCalled());
  hideAmounts();
  expect(pdf.destroy).toHaveBeenCalled();
  showInsideReview();
  await act(async function finishOldExtraction() {
    finish(lines);
  });
  expect(screen.queryByLabelText('SGD billed amount')).not.toBeInTheDocument();
  expect(document.querySelector('canvas')).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain('SYNTHETIC MARKET');
  pdf.extract.mockResolvedValue(lines);
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  expect(await screen.findByLabelText('SGD billed amount')).toHaveValue(
    '12.30'
  );
});
it('cleans a late PDF opening without extracting or showing stale rows', async () => {
  let finish!: (value: {
    pageCount: number;
    extract: typeof pdf.extract;
    render: typeof pdf.render;
    destroy: typeof pdf.destroy;
  }) => void;
  pdf.open.mockImplementation(
    () =>
      new Promise(function holdOpen(resolve) {
        finish = resolve;
      })
  );
  mountReview();
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  selectPdf();
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  await waitFor(() => expect(pdf.open).toHaveBeenCalled());
  hideAmounts();
  showInsideReview();
  await act(async function finishOldOpen() {
    finish({
      pageCount: 2,
      extract: pdf.extract,
      render: pdf.render,
      destroy: pdf.destroy,
    });
  });
  expect(pdf.destroy).toHaveBeenCalled();
  expect(pdf.extract).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('SGD billed amount')).not.toBeInTheDocument();
  expect(document.querySelector('canvas')).not.toBeInTheDocument();
});
