// @vitest-environment jsdom
import {
  importedExpenseValues,
  type ImportedExpenseInput,
} from '@/features/expenses/lib/import-expense';
import { StatementReview } from '@/features/import-review';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
  useAmountVisibility,
} from '@/features/privacy';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
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
  EXPENSE_TYPE_LABELS: { other: 'Other', groceries: 'Groceries' },
  EXPENSE_KEY: ['expenses'],
  IMPORT_SAVE_LIMIT: 500,
  IMPORT_SAVE_GROUP_SIZE: 20,
  IMPORT_SAVE_MAX_BYTES: 512 * 1024,
  IMPORT_REQUEST_TIMEOUT_MS: 30_000,
  getExpenses: mocks.read,
  insertImportedExpense: mocks.insert,
  insertImportedExpenses: async (inputs: unknown[]) =>
    Promise.all(
      inputs.map((input) =>
        mocks.insert(input).catch(() => ({
          id: (input as { id: string }).id,
          status: 'unconfirmed',
        }))
      )
    ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rulebook.mockResolvedValue(null);
  mocks.extract.mockResolvedValue(
    ['UOB SGD billed', '01 OCT INVENTED MARKET 12.30'].map((text, index) => ({
      page: 1,
      line: index + 1,
      text,
    }))
  );
  mocks.read.mockResolvedValue([]);
  mocks.insert.mockImplementation(async (input: ImportedExpenseInput) => ({
    id: input.id,
    status: 'confirmed',
  }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function ImmediateVisibilitySwitch() {
  const privacy = useAmountVisibility();
  return (
    <button
      onClick={() => {
        privacy.hideAmounts();
        privacy.showAmounts();
      }}
    >
      Hide then show immediately
    </button>
  );
}
function ExpenseProbe() {
  const query = useQuery({
    queryKey: ['expenses'],
    queryFn: mocks.read,
    staleTime: Infinity,
    gcTime: 0,
  });
  return (
    <p>{query.data?.map((row: { item: string }) => row.item).join(' / ')}</p>
  );
}
async function setup(client?: QueryClient) {
  const content = (
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <ImmediateVisibilitySwitch />
      <StatementReview />
      {client && <ExpenseProbe />}
    </AmountVisibilityProvider>
  );
  render(
    client ? (
      <QueryClientProvider client={client}>{content}</QueryClientProvider>
    ) : (
      content
    )
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
const saveButton = () =>
  screen.queryByRole('button', { name: /^Save \d+ expenses?$/ });
async function selectAndCheck() {
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  await screen.findByRole('button', { name: 'Save 1 expense' });
}
function deferInsert() {
  const pending: { finish: (value: unknown) => void } = { finish: () => {} };
  mocks.insert.mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.finish = resolve;
      })
  );
  return pending;
}
const savedMatch = {
  id: 'saved',
  date: '2026-10-01',
  type: 'other',
  item: 'invented market',
  info: '',
  amount: 12.3,
  splitType: 'self',
  splits: [],
};
it('offers one primary action per step and closes on Done after a confirmed save', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('Item / Brand'), {
    target: { value: 'Corrected market' },
  });
  fireEvent.keyDown(screen.getByLabelText('Item / Brand'), { key: 'Enter' });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(saveButton()).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Select all 1 expense' })
  ).toBeEnabled();
  expect(screen.getByText('Select the expenses to import.')).toBeVisible();
  await selectAndCheck();
  expect(screen.getByText(/1 selected · SGD 12.30/)).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /for duplicates/ })
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Source note to save')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  expect(await screen.findByText('1 expense saved')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  expect(input.description).toBe('Corrected market');
  expect(input.source[0].text).toContain('INVENTED MARKET');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(window.confirm).not.toHaveBeenCalled();
});
it('names the matched saved expense and requires a per-row keep that an edit invalidates', async () => {
  await setup();
  mocks.read.mockResolvedValue([savedMatch]);
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  expect(
    await screen.findByText(
      'Possible duplicate of a saved expense: 2026-10-01 · invented market · SGD 12.30'
    )
  ).toBeVisible();
  expect(saveButton()).not.toBeInTheDocument();
  expect(
    screen.getByText(
      '0 of 1 possible duplicate resolved. Compare each with its source line.'
    )
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Keep both' }));
  expect(screen.getByRole('button', { name: 'Keep both' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(saveButton()).toBeEnabled();
  expect(screen.queryByText(/to resolve|Compare each/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('SGD billed amount'), {
    target: { value: '12.40' },
  });
  expect(saveButton()).not.toBeInTheDocument();
  expect(screen.getByText('Changed · recheck')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Recheck 1 row' })).toBeEnabled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('skips a duplicate row reversibly and rechecks a row marked needs amend', async () => {
  await setup();
  mocks.read.mockResolvedValue([savedMatch]);
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
  expect(screen.getByText(/0 selected/)).toBeVisible();
  expect(
    screen.getByText('Skipped. Select the row again to bring it back.')
  ).toBeVisible();
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  expect(screen.getByRole('button', { name: 'Skip' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Needs amend' }));
  expect(screen.getByLabelText('Item / Brand')).toHaveFocus();
  expect(saveButton()).not.toBeInTheDocument();
  expect(
    screen.getByText('Correct the 1 row marked Needs amend, then recheck.')
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Recheck 1 row' }));
  await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Needs amend' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  );
  expect(
    screen.getByRole('button', { name: 'Go to next duplicate' })
  ).toBeEnabled();
  mocks.read.mockResolvedValue([]);
  fireEvent.change(screen.getByLabelText('Item / Brand'), {
    target: { value: 'Different market' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Recheck 1 row' }));
  expect(
    await screen.findByRole('button', { name: 'Save 1 expense' })
  ).toBeEnabled();
  expect(screen.queryByText(/Possible duplicate of/)).not.toBeInTheDocument();
});
it('links statement-internal duplicates and clears the partner warning on skip without a read', async () => {
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      '01 OCT INVENTED MARKET 12.30',
      '01 OCT INVENTED MARKET 12.30',
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  await setup();
  fireEvent.click(
    screen.getByRole('button', { name: 'Select all 2 expenses' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 2 for duplicates' })
  );
  const partner = await screen.findByRole('button', {
    name: '#2 (page 1 · line 3)',
  });
  expect(
    screen.getByRole('button', { name: '#1 (page 1 · line 2)' })
  ).toBeVisible();
  fireEvent.click(partner);
  await waitFor(() => expect(document.activeElement?.tagName).toBe('FIELDSET'));
  expect(document.activeElement).toHaveTextContent('#2');
  const filter = screen.getByLabelText('Show transactions');
  fireEvent.change(filter, { target: { value: 'duplicates' } });
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Duplicate decision for row 1' })
    ).getByRole('button', { name: 'Skip' })
  );
  expect(
    screen.queryByRole('group', { name: 'Duplicate decision for row 2' })
  ).not.toBeInTheDocument();
  expect(filter).toHaveValue('expenses');
  expect(screen.getByText('2 rows')).toBeVisible();
  expect(mocks.read).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  expect(await screen.findByText('1 expense saved')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /unsaved row/ })
  ).not.toBeInTheDocument();
});
it('goes to the next unresolved duplicate and focuses its decision', async () => {
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      '01 OCT OTHER SHOP 5.00',
      '01 OCT INVENTED MARKET 12.30',
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  await setup();
  mocks.read.mockResolvedValue([savedMatch]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Select all 2 expenses' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 2 for duplicates' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Go to next duplicate' })
  );
  expect(screen.getByLabelText('Show transactions')).toHaveValue('duplicates');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Keep both' })).toHaveFocus()
  );
  expect(screen.getAllByLabelText('Item / Brand')).toHaveLength(1);
});
it('failed duplicate read blocks saving and retains editable selected draft', async () => {
  await setup();
  mocks.read.mockRejectedValue(new Error('private details'));
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  await screen.findByText(/Expenses could not be checked/);
  expect(saveButton()).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  ).toBeEnabled();
  expect(screen.getByLabelText('Item / Brand')).toBeEnabled();
  expect(screen.queryByText('private details')).not.toBeInTheDocument();
});
it('blocks the dialog behind a progress overlay while checking and lets the check be cancelled', async () => {
  await setup();
  let finish!: (value: unknown[]) => void;
  mocks.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  const overlay = screen.getByRole('alertdialog', {
    name: 'Checking for duplicates',
  });
  expect(overlay).toHaveFocus();
  expect(overlay).toHaveAttribute('aria-busy', 'true');
  expect(
    screen.getByRole('button', { name: 'Close', hidden: true })
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel check' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  await act(async () => finish([]));
  expect(saveButton()).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  ).toBeEnabled();
});
it('definite rejection permits identical retry without a new ID or changed source', async () => {
  await setup();
  mocks.insert.mockImplementationOnce(async (input: ImportedExpenseInput) => ({
    id: input.id,
    status: 'not_saved',
  }));
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  expect(
    await screen.findByText(
      'Row #1 · page 1, line 2 · INVENTED MARKET · SGD 12.30: Not saved'
    )
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry same expense' }));
  await screen.findByText('1 expense saved');
  expect(mocks.insert.mock.calls[1][0]).toEqual(mocks.insert.mock.calls[0][0]);
});
it('lost acknowledgement with missing then changed saved row never retries or overwrites', async () => {
  await setup();
  mocks.insert.mockRejectedValue(new Error('lost ack'));
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  await screen.findByText(/Save unconfirmed/);
  expect(
    screen.queryByRole('button', { name: 'Retry same expense' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await screen.findByText(/Missing records remain unconfirmed/);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  mocks.read.mockResolvedValue([
    { ...importedExpenseValues(input), item: 'Edited elsewhere' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await screen.findByText(/Saved record changed/);
  expect(screen.getByRole('button', { name: 'Saving paused' })).toBeDisabled();
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('an exact authoritative read confirms a lost acknowledgement', async () => {
  await setup();
  mocks.insert.mockResolvedValue(undefined);
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  await screen.findByText(/Save unconfirmed/);
  mocks.read.mockResolvedValue([
    importedExpenseValues(mocks.insert.mock.calls[0][0]),
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await screen.findByText('1 expense saved');
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('hide during pending save rejects its late acknowledgement, masks notes and preserves a checkable frozen identity', async () => {
  await setup();
  const pending = deferInsert();
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  expect(await screen.findByText('Saving 0 of 1 · group 1 of 1')).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.queryByText(/Statement source:/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Item / Brand')).toHaveValue('');
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  await act(async () => pending.finish({ id: input.id, status: 'confirmed' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  await screen.findByText(/Save unconfirmed/);
  expect(screen.queryByText('1 expense saved')).not.toBeInTheDocument();
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('keeps review on canceled discard and refuses to close while a save is in flight', async () => {
  await setup();
  await selectAndCheck();
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Change statement' }));
  expect(screen.getByLabelText('Item / Brand')).toBeInTheDocument();
  vi.mocked(window.confirm).mockClear();
  const pending = deferInsert();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  expect(
    screen.getByRole('progressbar', { name: 'Save progress' })
  ).toHaveAttribute('max', '1');
  expect(
    screen.getByRole('button', { name: 'Close', hidden: true })
  ).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
  expect(window.confirm).not.toHaveBeenCalled();
  await act(async () =>
    pending.finish({
      id: mocks.insert.mock.calls[0][0].id,
      status: 'confirmed',
    })
  );
  expect(await screen.findByText('1 expense saved')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(window.confirm).not.toHaveBeenCalled();
});
it('immediate hide/show invalidates pending acknowledgement even without a hidden render', async () => {
  await setup();
  const pending = deferInsert();
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Hide then show immediately',
      hidden: true,
    })
  );
  await act(async () =>
    pending.finish({
      id: mocks.insert.mock.calls[0][0].id,
      status: 'confirmed',
    })
  );
  await screen.findByText(/Save unconfirmed/);
  expect(screen.queryByText('1 expense saved')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Check saved expenses' })
  ).toBeEnabled();
});
it('immediate hide/show during duplicate read rejects stale readiness and releases busy controls', async () => {
  await setup();
  let finish!: (value: unknown[]) => void;
  mocks.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Hide then show immediately',
      hidden: true,
    })
  );
  await act(async () => finish([]));
  expect(
    screen.getByRole('button', { name: 'Check 1 for duplicates' })
  ).toBeEnabled();
  expect(saveButton()).not.toBeInTheDocument();
});
it('refreshes a confirmed import after another real mutation finishes without replacing its optimistic row early', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['expenses'], [{ item: 'Optimistic other expense' }]);
  await setup(client);
  let finish!: () => void;
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  });
  const completion = mutation.execute(undefined);
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  await screen.findByText('1 expense saved');
  expect(client.getQueryData(['expenses'])).toEqual([
    { item: 'Optimistic other expense' },
  ]);
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  mocks.read.mockResolvedValue([importedExpenseValues(input)]);
  await act(async () => {
    finish();
    await completion;
  });
  await waitFor(() =>
    expect(client.getQueryData(['expenses'])).toEqual([
      importedExpenseValues(input),
    ])
  );
  client.clear();
});
it('does not recreate a removed private query when a deferred refresh is released', async () => {
  const client = new QueryClient();
  client.setQueryData(['expenses'], [{ item: 'Optimistic expense' }]);
  await setup(client);
  let finish!: () => void;
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  });
  const completion = mutation.execute(undefined);
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  await screen.findByText('1 expense saved');
  client.removeQueries({ queryKey: ['expenses'], exact: true });
  const invalidation = vi.spyOn(client, 'invalidateQueries');
  await act(async () => {
    finish();
    await completion;
  });
  expect(invalidation).not.toHaveBeenCalled();
  client.clear();
});
it('pauses after an uncertain group and checks all submitted identities without resending', async () => {
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      '01 OCT MARKET ONE 12.30',
      '02 OCT MARKET TWO 13.30',
      '03 OCT MARKET THREE 14.30',
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  await setup();
  fireEvent.click(
    screen.getByRole('button', { name: 'Select all 3 expenses' })
  );
  mocks.insert.mockImplementationOnce(async (input: ImportedExpenseInput) => ({
    id: input.id,
    status: 'confirmed',
  }));
  mocks.insert.mockRejectedValueOnce(new Error('lost ack'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 3 for duplicates' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Save 3 expenses' })
  );
  await screen.findByText(/2 confirmed · 0 not saved · 1 unconfirmed/);
  expect(mocks.insert).toHaveBeenCalledTimes(3);
  mocks.read.mockResolvedValue(
    mocks.insert.mock.calls.map(([input]) => importedExpenseValues(input))
  );
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await screen.findByText('3 expenses saved');
  expect(mocks.insert).toHaveBeenCalledTimes(3);
});
// Dense native-control fixture exceeded 10s in the parallel V8 coverage run.
// Keep all 21 selections/assertions; only this test gets a 20s harness allowance.
it('selection across pages is included and twenty-one rows save in automatic groups', async () => {
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      ...Array.from(
        { length: 21 },
        (_, index) =>
          `${String(index + 1).padStart(2, '0')} OCT MARKET ${index} 1.00`
      ),
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  await setup();
  const visibleSelections = screen.getAllByRole('checkbox', {
    name: /Select expense from page 1, line/,
  });
  act(() => {
    for (const checkbox of visibleSelections) fireEvent.click(checkbox);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next rows' }));
  expect(screen.getByText(/20 selected/)).toBeVisible();
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 22'));
  expect(screen.getByText(/21 selected/)).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 21 for duplicates' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Save 21 expenses' })
  );
  await screen.findByText('21 expenses saved');
  expect(mocks.insert).toHaveBeenCalledTimes(21);
}, 20_000);

it('checks a hidden interrupted save before its old acknowledgement returns and ignores that late result', async () => {
  await setup();
  const pending = deferInsert();
  await selectAndCheck();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 expense' }));
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  mocks.read.mockResolvedValue([importedExpenseValues(input)]);
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
  await screen.findByText('1 expense saved');
  await act(async () =>
    pending.finish({ id: input.id, status: 'unconfirmed' })
  );
  expect(screen.getByText('1 expense saved')).toBeInTheDocument();
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});

it('merchant rules fill drafts automatically and preserve manual edits and explicit restoration', async () => {
  mocks.rulebook.mockResolvedValue({
    id: '851af27a-e752-4aa5-8294-44b02bd911ca',
    revision: '1',
    payload: {
      schemaVersion: 1,
      requestId: 'ff65feb2-8ffa-427c-a057-8779580f162f',
      rules: [
        {
          id: '28df2170-47da-4771-90cc-9aa36eff48d5',
          label: 'Market',
          enabled: true,
          matchMode: 'exact',
          matchText: 'INVENTED MARKET',
          bank: 'uob',
          displayName: 'Suggested market',
          category: 'groceries',
        },
      ],
    },
  });
  await setup();
  fireEvent.change(screen.getByLabelText('Item / Brand'), {
    target: { value: 'My merchant' },
  });
  await selectAndCheck();
  expect(screen.getByLabelText('Item / Brand')).toHaveValue('My merchant');
  expect(screen.getByLabelText('Category')).toHaveValue('groceries');
  expect(saveButton()).toBeEnabled();
  fireEvent.click(screen.getByText('Details'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Review changes / restore' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Restore values' }));
  expect(screen.getByLabelText('Item / Brand')).toHaveValue('INVENTED MARKET');
  expect(screen.getByLabelText('Category')).toHaveValue('other');
  expect(saveButton()).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recheck 1 row' })).toBeEnabled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it('saving a rule fills every matching row and invalidates checked duplicates without saving expenses', async () => {
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      '01 OCT INVENTED MARKET 12.30',
      '02 OCT INVENTED MARKET 20.00',
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  mocks.saveRules.mockResolvedValue({ status: 'saved', revision: '1' });
  await setup();
  fireEvent.click(
    screen.getByRole('button', { name: 'Select all 2 expenses' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Check 2 for duplicates' })
  );
  await screen.findByRole('button', { name: 'Save 2 expenses' });
  fireEvent.click(screen.getAllByText('Details', { exact: true })[0]);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Create rule', exact: true })[0]
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Item / Brand', exact: true }),
    {
      target: { value: 'Weekly market' },
    }
  );
  fireEvent.change(screen.getByLabelText('Suggested category'), {
    target: { value: 'groceries' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save rule', exact: true })
  );
  await screen.findByText(
    'Merchant rules saved. Existing expenses are unchanged.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
  await waitFor(() =>
    expect(
      screen
        .getAllByLabelText('Item / Brand')
        .map((input) => (input as HTMLInputElement).value)
    ).toEqual(['Weekly market', 'Weekly market'])
  );
  expect(
    screen
      .getAllByLabelText('Category')
      .map((input) => (input as HTMLSelectElement).value)
  ).toEqual(['groceries', 'groceries']);
  expect(saveButton()).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recheck 2 rows' })).toBeEnabled();
  expect(screen.queryByText('Source note to save')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Apply suggestion' })
  ).not.toBeInTheDocument();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it('keeps an explicit conflict choice after the chosen rule is paused', async () => {
  const rule = {
    id: '28df2170-47da-4771-90cc-9aa36eff48d5',
    label: 'Rule A',
    enabled: true,
    matchMode: 'exact',
    matchText: 'INVENTED MARKET',
    bank: 'uob',
    displayName: 'Merchant A',
    category: 'groceries',
  };
  mocks.rulebook.mockResolvedValue({
    id: '851af27a-e752-4aa5-8294-44b02bd911ca',
    revision: '1',
    payload: {
      schemaVersion: 1,
      requestId: 'ff65feb2-8ffa-427c-a057-8779580f162f',
      rules: [
        rule,
        {
          ...rule,
          id: 'afc9ad1a-2b12-433a-ad54-e4d1ad683374',
          label: 'Rule B',
          displayName: 'Merchant B',
          category: 'other',
        },
      ],
    },
  });
  mocks.saveRules.mockResolvedValue({ status: 'saved', revision: '2' });
  await setup();
  fireEvent.click(screen.getByText('Details', { exact: true }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose Rule B', exact: true })
  );
  expect(screen.getByLabelText('Item / Brand')).toHaveValue('Merchant B');
  fireEvent.click(
    screen.getByRole('button', { name: 'Merchant rules', exact: true })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit rule Rule B', exact: true })
  );
  fireEvent.click(screen.getByLabelText('Apply this rule automatically'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Save rule', exact: true })
  );
  await screen.findByText(
    'Merchant rules saved. Existing expenses are unchanged.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
  expect(screen.getByLabelText('Item / Brand')).toHaveValue('Merchant B');
  expect(screen.getByLabelText('Category')).toHaveValue('other');
  expect(
    screen.queryByRole('button', { name: 'Choose Rule A', exact: true })
  ).not.toBeInTheDocument();
});
