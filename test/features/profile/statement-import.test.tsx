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
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extract: vi.fn(),
  read: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/features/import-review/lib/local-pdf', () => ({
  openLocalStatementPdf: async () => ({
    pageCount: 1,
    extract: mocks.extract,
    render: async () => {},
    destroy: () => {},
  }),
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
async function selectAndCheck() {
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save selected expenses' })
    ).toBeEnabled()
  );
}
it('requires selection, fresh duplicate check and explicit save; previews original notes and freezes confirmed row', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Corrected market' },
  });
  fireEvent.keyDown(screen.getByLabelText('Description'), { key: 'Enter' });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  await selectAndCheck();
  expect(
    screen.getByText(/1 selected across all pages · SGD 12.30/)
  ).toBeVisible();
  expect(
    screen.getByText(/Page 1, line 2: 01 OCT INVENTED MARKET/)
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  await screen.findByText(/Confirmed saved/);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  expect(input.description).toBe('Corrected market');
  expect(input.source[0].text).toContain('INVENTED MARKET');
  expect(screen.getByLabelText('Description')).toBeDisabled();
});
it('requires explicit possible-duplicate acknowledgement and rechecks after editing', async () => {
  await setup();
  const match = {
    id: 'saved',
    date: '2026-10-01',
    type: 'other',
    item: 'invented market',
    info: '',
    amount: 12.3,
    splitType: 'self',
    splits: [],
  };
  mocks.read.mockResolvedValue([match]);
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  const acknowledgement = await screen.findByLabelText(
    /I compared the possible duplicate/
  );
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  fireEvent.click(acknowledgement);
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeEnabled();
  fireEvent.change(screen.getByLabelText('SGD billed amount'), {
    target: { value: '12.40' },
  });
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('failed duplicate read blocks saving and retains editable selected draft', async () => {
  await setup();
  mocks.read.mockRejectedValue(new Error('private details'));
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await screen.findByText(/Expenses could not be checked/);
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  expect(screen.getByLabelText('Description')).toBeEnabled();
  expect(screen.queryByText('private details')).not.toBeInTheDocument();
});
it('definite rejection permits identical retry without a new ID or changed source', async () => {
  await setup();
  mocks.insert.mockImplementationOnce(async (input: ImportedExpenseInput) => ({
    id: input.id,
    status: 'not_saved',
  }));
  await selectAndCheck();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry same expense' })
  );
  await screen.findByText(/Confirmed saved/);
  expect(mocks.insert.mock.calls[1][0]).toEqual(mocks.insert.mock.calls[0][0]);
});
it('lost acknowledgement with missing then changed saved row never retries or overwrites', async () => {
  await setup();
  mocks.insert.mockRejectedValue(new Error('lost ack'));
  await selectAndCheck();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
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
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('an exact authoritative read confirms a lost acknowledgement', async () => {
  await setup();
  mocks.insert.mockResolvedValue(undefined);
  await selectAndCheck();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  await screen.findByText(/Save unconfirmed/);
  mocks.read.mockResolvedValue([
    importedExpenseValues(mocks.insert.mock.calls[0][0]),
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await screen.findByText(/Confirmed saved/);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('hide during pending save rejects its late acknowledgement, masks notes and preserves a checkable frozen identity', async () => {
  await setup();
  let finish!: (value: unknown) => void;
  mocks.insert.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await selectAndCheck();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  await screen.findByText(/Saving/);
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
  expect(screen.queryByText(/Statement source:/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Description')).toHaveValue('');
  const input = mocks.insert.mock.calls[0][0] as ImportedExpenseInput;
  await act(async () => finish({ id: input.id, status: 'confirmed' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  await screen.findByText(/Save unconfirmed/);
  expect(screen.queryByText(/Confirmed saved/)).not.toBeInTheDocument();
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('keeps review on canceled discard and ignores completion after explicit close', async () => {
  await setup();
  await selectAndCheck();
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Clear review' }));
  expect(screen.getByLabelText('Description')).toBeInTheDocument();
  let finish!: (value: unknown) => void;
  mocks.insert.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () =>
    finish({ id: mocks.insert.mock.calls[0][0].id, status: 'confirmed' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review bank PDF' }));
  expect(screen.queryByText(/Confirmed saved/)).not.toBeInTheDocument();
});
it('immediate hide/show invalidates pending acknowledgement even without a hidden render', async () => {
  await setup();
  let finish!: (value: unknown) => void;
  mocks.insert.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await selectAndCheck();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Hide then show immediately',
      hidden: true,
    })
  );
  await act(async () =>
    finish({ id: mocks.insert.mock.calls[0][0].id, status: 'confirmed' })
  );
  await screen.findByText(/Save unconfirmed/);
  expect(screen.queryByText(/Confirmed saved/)).not.toBeInTheDocument();
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
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Hide then show immediately',
      hidden: true,
    })
  );
  await act(async () => finish([]));
  expect(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  ).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
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
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  await screen.findByText(/Confirmed saved/);
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
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  await screen.findByText(/Confirmed saved/);
  client.removeQueries({ queryKey: ['expenses'], exact: true });
  const invalidation = vi.spyOn(client, 'invalidateQueries');
  await act(async () => {
    finish();
    await completion;
  });
  expect(invalidation).not.toHaveBeenCalled();
  client.clear();
});
it('stops a partial batch on unknown outcome, retains unsent payload and resumes only after exact check', async () => {
  mocks.extract.mockResolvedValue(
    [
      'UOB SGD billed',
      '01 OCT MARKET ONE 12.30',
      '02 OCT MARKET TWO 13.30',
      '03 OCT MARKET THREE 14.30',
    ].map((text, index) => ({ page: 1, line: index + 1, text }))
  );
  await setup();
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 2'));
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 3'));
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 4'));
  mocks.insert.mockImplementationOnce(async (input: ImportedExpenseInput) => ({
    id: input.id,
    status: 'confirmed',
  }));
  mocks.insert.mockImplementationOnce(async () => {
    throw new Error('lost ack');
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save selected expenses' })
    ).toBeEnabled()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save selected expenses' })
  );
  await screen.findByText(
    /1 confirmed · 0 not saved · 1 unconfirmed · 0 conflicts · 1 not started/
  );
  expect(mocks.insert).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('button', { name: 'Continue frozen batch' })
  ).toBeDisabled();
  mocks.read.mockResolvedValue(
    mocks.insert.mock.calls.map(([input]) => importedExpenseValues(input))
  );
  fireEvent.click(screen.getByRole('button', { name: 'Check saved expenses' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Continue frozen batch' })
    ).toBeEnabled()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue frozen batch' })
  );
  await screen.findByText(/3 confirmed · 0 not saved/);
  expect(mocks.insert).toHaveBeenCalledTimes(3);
  expect(mocks.insert.mock.calls[2][0].description).toBe('MARKET THREE');
});
it('selection across pages is included and a twenty-one row selection blocks the bounded batch', async () => {
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
  expect(screen.getByText(/20 selected across all pages/)).toBeVisible();
  fireEvent.click(screen.getByLabelText('Select expense from page 1, line 22'));
  expect(screen.getByText(/21 selected across all pages/)).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Save selected expenses' })
  ).toBeDisabled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
