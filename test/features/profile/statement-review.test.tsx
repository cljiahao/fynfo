// @vitest-environment jsdom
import { StatementReview } from '@/features/import-review';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  extract: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('@/features/import-review/lib/local-pdf', () => ({
  openLocalStatementPdf: mocks.open,
}));
vi.mock('@/features/expenses', () => ({
  EXPENSE_TYPE_LABELS: { other: 'Other', groceries: 'Groceries' },
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
function setup(read = async () => new ArrayBuffer(4), size = 4) {
  render(<StatementReview />);
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2025-12-15' },
  });
  fireEvent.change(screen.getByLabelText('Period end'), {
    target: { value: '2026-01-14' },
  });
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
    screen.queryByRole('button', { name: /save|upload/i })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  expect(mocks.destroy).toHaveBeenCalled();
  expect(screen.queryByText(/source rows:/)).not.toBeInTheDocument();
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
