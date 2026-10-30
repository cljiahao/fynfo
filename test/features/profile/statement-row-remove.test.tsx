// @vitest-environment jsdom
import { type ImportedExpenseInput } from '@/features/expenses/lib/import-expense';
import { StatementReview } from '@/features/import-review';
import { withoutRemoved } from '@/features/import-review/lib/import-selection';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extract: vi.fn(),
  read: vi.fn(),
  insert: vi.fn(),
  rulebook: vi.fn(),
  saveRules: vi.fn(),
}));
vi.mock('@/features/import-review/lib/local-pdf', () => ({
  openLocalStatementPdf: async () => ({
    pageCount: 1,
    extract: mocks.extract,
    render: async () => {},
    destroy: () => {},
  }),
}));
vi.mock('@/features/merchant-rules/actions/rulebook-actions', () => ({
  getMerchantRulebook: mocks.rulebook,
  saveMerchantRulebook: mocks.saveRules,
}));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/lib/import-expense')),
  ...(await import('@/features/expenses/lib/split-amounts')),
  ...(await import('@/features/expenses/components/split-dialog')),
  useDistinctPeople: () => ({ data: ['Alex'] }),
  EXPENSE_TYPE_LABELS: { other: 'Other', groceries: 'Groceries' },
  EXPENSE_KEY: ['expenses'],
  IMPORT_SAVE_LIMIT: 500,
  IMPORT_SAVE_GROUP_SIZE: 20,
  IMPORT_SAVE_MAX_BYTES: 512 * 1024,
  IMPORT_REQUEST_TIMEOUT_MS: 30_000,
  getExpenses: mocks.read,
  getExpensesInRange: (from: string, to: string) => mocks.read(from, to),
  insertImportedExpense: mocks.insert,
  insertImportedExpenses: async (inputs: unknown[]) =>
    Promise.all(inputs.map((input) => mocks.insert(input))),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rulebook.mockResolvedValue(null);
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      '01 OCT INVENTED MARKET 12.30',
      '01 OCT OTHER SHOP 4.50',
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  mocks.read.mockResolvedValue([]);
  mocks.insert.mockImplementation(async (input: ImportedExpenseInput) => ({
    id: input.id,
    status: 'confirmed',
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function setup() {
  render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <StatementReview />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  fireEvent.change(screen.getByLabelText('Period start'), {
    target: { value: '2026-10-01' },
  });
  fireEvent.change(screen.getByLabelText('Period end'), {
    target: { value: '2026-10-31' },
  });
  const file = new File(['synthetic'], 'invented.pdf', {
    type: 'application/pdf',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new ArrayBuffer(4),
  });
  fireEvent.change(screen.getByLabelText('Bank statement PDF'), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Extract for review' }));
  await screen.findByLabelText('Select expense from page 1, line 2');
}
// Removed rows stay as stubs only in the "all" view.
const remove = (n: number) => {
  fireEvent.click(screen.getByRole('button', { name: `Remove row #${n}` }));
  fireEvent.change(screen.getByLabelText('Show transactions'), {
    target: { value: 'all' },
  });
};
const box = () => screen.getByLabelText('Select expense from page 1, line 2');

it('collapses a removed row to a stub with an accessible Restore button', async () => {
  await setup();
  remove(1);
  expect(screen.getByText(/Row #1 removed/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Restore row #1' })).toBeVisible();
  expect(
    screen.queryByLabelText('Select expense from page 1, line 2')
  ).not.toBeInTheDocument();
});

it('excludes removed rows from select-all, the duplicate check and the save', async () => {
  await setup();
  remove(1);
  fireEvent.click(screen.getByRole('button', { name: 'Select all 1 expense' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Save 1 expense' })
  );
  await screen.findByText('1 expense saved');
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  expect(mocks.insert.mock.calls[0][0]).toMatchObject({
    description: 'OTHER SHOP',
  });
});

it('clears selection on remove and restores the row unselected', async () => {
  await setup();
  fireEvent.click(box());
  expect(box()).toBeChecked();
  remove(1);
  expect(
    screen.queryByRole('button', { name: /^Check \d+ for duplicates$/ })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Restore row #1' }));
  expect(box()).not.toBeChecked();
});

it('offers no Remove button for a saved row', async () => {
  await setup();
  fireEvent.click(
    screen.getByRole('button', { name: 'Select all 2 expenses' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 2 for duplicates' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Save 2 expenses' })
  );
  await screen.findByText('2 expenses saved');
  expect(
    screen.queryByRole('button', { name: 'Remove row #1' })
  ).not.toBeInTheDocument();
});

it('offers no Remove button while amounts are hidden', async () => {
  await setup();
  expect(screen.getByRole('button', { name: 'Remove row #1' })).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(
    screen.queryByRole('button', { name: 'Remove row #1' })
  ).not.toBeInTheDocument();
});

it('withoutRemoved keeps order, ignores unknown ids and passes an empty set through', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(withoutRemoved(rows, new Set())).toBe(rows);
  expect(withoutRemoved(rows, new Set(['b', 'zzz']))).toEqual([
    { id: 'a' },
    { id: 'c' },
  ]);
});
