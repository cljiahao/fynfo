// @vitest-environment jsdom
import { type ImportedExpenseInput } from '@/features/expenses/lib/import-expense';
import { StatementReview } from '@/features/import-review';
import { useStatementSave } from '@/features/import-review/hooks/use-statement-save';
import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
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
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const forced = vi.hoisted(() => ({ hidden: false }));
const paging = vi.hoisted(() => ({ rowsPerPage: 20 }));
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
// Rendering a full 20-row page is what made the pagination case slow.
vi.mock('@/features/import-review/constants', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/import-review/constants')>();
  return {
    ...actual,
    get STATEMENT_ROWS_PER_PAGE() {
      return paging.rowsPerPage;
    },
  };
});
vi.mock('@/features/privacy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/privacy')>();
  return {
    ...actual,
    // Lets a test hide amounts between a click and the render it causes.
    useAmountVisibility: () => {
      const value = actual.useAmountVisibility();
      return forced.hidden ? { ...value, hidden: true } : value;
    },
  };
});
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

function statementLines(count: number) {
  return [
    'UOB SGD billed',
    ...Array.from(
      { length: count },
      (_, index) => `01 OCT SHOP ${index + 1} 1.00`
    ),
  ].map((text, index) => ({ page: 1, line: index + 1, text }));
}
beforeEach(() => {
  vi.clearAllMocks();
  forced.hidden = false;
  paging.rowsPerPage = 20;
  mocks.rulebook.mockResolvedValue(null);
  mocks.extract.mockResolvedValue(statementLines(4));
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
  await screen.findByLabelText('Remove row #1');
}

const removeButton = (n: number) => screen.getByLabelText(`Remove row #${n}`);
const showAll = () =>
  fireEvent.change(screen.getByLabelText('Show transactions'), {
    target: { value: 'all' },
  });
// Keyboard removal: the button holds focus when it is pressed.
function pressRemove(n: number) {
  const button = removeButton(n);
  button.focus();
  fireEvent.click(button);
}
const status = () => screen.getByText(/source rows/).textContent;
const section = () => screen.getByLabelText('Extracted transaction drafts');

describe('announced counts', () => {
  it('counts only remaining rows and brings them back on restore', async () => {
    await setup();
    expect(status()).toMatch(/^4 source rows: 4 expense suggestions/);
    fireEvent.click(removeButton(1));
    expect(status()).toMatch(/^3 source rows: 3 expense suggestions/);
    expect(status()).toContain('1 removed');
    showAll();
    fireEvent.click(screen.getByRole('button', { name: 'Restore row #1' }));
    expect(status()).toMatch(/^4 source rows: 4 expense suggestions/);
    expect(status()).not.toContain('removed');
  });

  it('excludes removed stubs from the all-view pagination text', async () => {
    paging.rowsPerPage = 3;
    mocks.extract.mockResolvedValue(statementLines(5));
    await setup();
    showAll();
    expect(screen.getByText(/Rows 1–3 of 5/)).toBeInTheDocument();
    fireEvent.click(removeButton(1));
    expect(screen.getByText(/Rows 1–2 of 4/)).toBeInTheDocument();
  });

  it('keeps the figures masked while amounts are hidden', async () => {
    await setup();
    fireEvent.click(removeButton(1));
    fireEvent.click(
      screen.getByRole('button', { name: 'Hide amounts', hidden: true })
    );
    expect(status()).toMatch(/^Hidden source rows: Hidden expense/);
    expect(status()).toContain('Hidden removed');
  });
});

describe('focus after remove', () => {
  it('moves to the next row Remove button', async () => {
    await setup();
    pressRemove(2);
    expect(removeButton(3)).toHaveFocus();
  });

  it('moves to the previous row when the last row is removed', async () => {
    await setup();
    pressRemove(4);
    expect(removeButton(3)).toHaveFocus();
  });

  it('skips already removed neighbours', async () => {
    await setup();
    fireEvent.click(removeButton(3));
    showAll();
    pressRemove(2);
    expect(removeButton(4)).toHaveFocus();
  });

  it('lands on the Restore button of the only row in the all view', async () => {
    mocks.extract.mockResolvedValue(statementLines(1));
    await setup();
    showAll();
    pressRemove(1);
    expect(
      screen.getByRole('button', { name: 'Restore row #1' })
    ).toHaveFocus();
  });

  it('lands on the list section when no stub is rendered', async () => {
    mocks.extract.mockResolvedValue(statementLines(1));
    await setup();
    pressRemove(1);
    expect(section()).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it('does not move focus when the button was not focused', async () => {
    await setup();
    fireEvent.click(removeButton(2));
    expect(removeButton(3)).not.toHaveFocus();
    expect(section()).not.toHaveFocus();
  });

  it('falls back to the stub card when amounts hide with the remove', async () => {
    mocks.extract.mockResolvedValue(statementLines(1));
    await setup();
    showAll();
    removeButton(1).addEventListener('click', () => {
      forced.hidden = true;
    });
    pressRemove(1);
    expect(screen.getByText(/Row #1 removed/).closest('div')).toHaveFocus();
  });
});

describe('remove and restore state', () => {
  const period = { from: '2026-10-01', to: '2026-10-31' };
  const rows = parseStatementLines(statementLines(3), 'uob', period);
  const open = () => renderHook(() => useStatementSave(rows, 'uob', period));

  it('keeps both removals and drops selection and decisions for both', () => {
    const { result } = open();
    act(() => {
      result.current.selectExpenses(rows);
    });
    act(() => result.current.resolve(rows[0].id, 'amend'));
    act(() => result.current.resolve(rows[1].id, 'amend'));
    expect(result.current.resolutionFor(rows[1].id)).toBe('amend');
    expect(result.current.selection).toHaveLength(3);
    act(() => {
      result.current.remove(rows[0]);
      result.current.remove(rows[1]);
    });
    expect(result.current.isRemoved(rows[0].id)).toBe(true);
    expect(result.current.isRemoved(rows[1].id)).toBe(true);
    expect(result.current.selection).toEqual([rows[2].id]);
    expect(result.current.resolutionFor(rows[0].id)).toBeUndefined();
    expect(result.current.resolutionFor(rows[1].id)).toBeUndefined();
  });

  it('keeps both restores', () => {
    const { result } = open();
    act(() => {
      result.current.remove(rows[0]);
      result.current.remove(rows[1]);
    });
    act(() => {
      result.current.restore(rows[0]);
      result.current.restore(rows[1]);
    });
    expect(result.current.removedCount).toBe(0);
  });
});
