// @vitest-environment jsdom
import { StatementReview } from '@/features/import-review';
import { OCR_RENDER_SCALE } from '@/features/import-review/constants';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
}));

// Only the engine loader is replaced, so the real openLocalStatementPdf,
// extract() and ocrStatementPages run and a recognise call is the one thing
// counted.
vi.mock('@/features/import-review/lib/statement-ocr', async (original) => ({
  ...(await original<
    typeof import('@/features/import-review/lib/statement-ocr')
  >()),
  loadTesseractRecognizer: async () => ({
    recognize: mocks.recognize,
    terminate: mocks.terminate,
  }),
}));

// pdf.js needs a real worker and canvas, neither of which exists under jsdom,
// so the document is an image-only stand-in: pages with no text layer, which
// is what routes extract() through OCR.
vi.mock('pdfjs-dist', () => {
  const page = {
    getTextContent: async () => ({ items: [] }),
    cleanup: () => undefined,
    getViewport: ({ scale }: { scale: number }) => ({
      width: 600 * scale,
      height: 800 * scale,
    }),
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
  };
  const document = { numPages: 2, getPage: async () => page };
  return {
    PDFWorker: { create: () => ({ destroy: () => undefined }) },
    getDocument: () => ({
      promise: Promise.resolve(document),
      destroy: async () => undefined,
    }),
    AnnotationMode: { DISABLE: 0 },
  };
});
vi.mock('@/features/merchant-rules/actions/rulebook-actions', () => ({
  getMerchantRulebook: async () => null,
  saveMerchantRulebook: vi.fn(),
}));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/lib/import-expense')),
  ...(await import('@/features/expenses/lib/split-amounts')),
  ...(await import('@/features/expenses/components/split-dialog')),
  useDistinctPeople: () => ({ data: [] }),
  EXPENSE_TYPE_LABELS: { other: 'Other', groceries: 'Groceries' },
  EXPENSE_KEY: ['expenses'],
  IMPORT_SAVE_LIMIT: 500,
  IMPORT_SAVE_GROUP_SIZE: 20,
  IMPORT_SAVE_MAX_BYTES: 512 * 1024,
  IMPORT_REQUEST_TIMEOUT_MS: 30_000,
  getExpenses: async () => [],
  getExpensesInRange: async () => [],
  insertImportedExpense: vi.fn(),
  insertImportedExpenses: vi.fn(),
}));

const PAGE_HEIGHT_POINTS = 800;
const SYNTHETIC_PAGE = [
  'DBS TEST CARDS',
  'DATE DESCRIPTION AMOUNT (S$)',
  'NEW TRANSACTIONS TEST USER',
  '20 DEC EXAMPLE MARKET 12.50',
];

function recognisedLines(texts: readonly string[]) {
  return texts.map((text, row) => {
    const baseline = 700 - row * 20;
    return {
      words: text.split(' ').map((word, column) => ({
        text: word,
        confidence: 95,
        bbox: {
          x0: (50 + column * 60) * OCR_RENDER_SCALE,
          x1: (100 + column * 60) * OCR_RENDER_SCALE,
          y0: (PAGE_HEIGHT_POINTS - baseline - 10) * OCR_RENDER_SCALE,
          y1: (PAGE_HEIGHT_POINTS - baseline) * OCR_RENDER_SCALE,
        },
      })),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The statement has two pages and only the first carries rows.
  mocks.recognize.mockImplementation(async () =>
    mocks.recognize.mock.calls.length % 2 === 1
      ? recognisedLines(SYNTHETIC_PAGE)
      : []
  );
  mocks.terminate.mockResolvedValue(undefined);
  // jsdom has no 2D context; the viewer only copies pixels, which no assertion reads.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal(
    'Worker',
    class {
      terminate() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function chooseFile(name: string) {
  const file = new File(['fake'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new ArrayBuffer(4),
  });
  Object.defineProperty(file, 'size', { value: 4 });
  fireEvent.change(screen.getByLabelText('Bank statement PDF'), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
}

it('runs recognition once per image-only page and not again on a bank change', async () => {
  render(
    <AmountVisibilityProvider>
      <StatementReview />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2025-12-15' },
  });
  fireEvent.change(screen.getByLabelText('Period end'), {
    target: { value: '2026-01-14' },
  });
  chooseFile('first.pdf');

  expect(await screen.findByText('Detected: DBS')).toBeVisible();
  expect(await screen.findByLabelText('Item / Brand')).toHaveValue(
    'EXAMPLE MARKET'
  );
  expect(mocks.recognize).toHaveBeenCalledTimes(2);

  fireEvent.change(screen.getByLabelText('Change statement bank'), {
    target: { value: 'uob' },
  });
  expect(
    await screen.findByText(/selected bank could not be identified/)
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText('Statement bank'), {
    target: { value: 'dbs' },
  });
  expect(await screen.findByText('Chosen: DBS')).toBeVisible();
  expect(await screen.findByLabelText('Item / Brand')).toHaveValue(
    'EXAMPLE MARKET'
  );
  expect(mocks.recognize).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: 'Change statement' }));
  chooseFile('second.pdf');
  await waitFor(() => expect(mocks.recognize).toHaveBeenCalledTimes(4));
  expect(await screen.findByLabelText('Item / Brand')).toHaveValue(
    'EXAMPLE MARKET'
  );
});
