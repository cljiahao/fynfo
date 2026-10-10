// @vitest-environment jsdom
import { Providers } from '@/components/layout/providers';
import { VaultGate } from '@/components/layout/vault-gate';
import type { SnapshotData } from '@/features/assets';
import { AuthIdentityWatcher, VaultLockProvider } from '@/features/auth';
import type { ExpenseData } from '@/features/expenses';
import { RecordSearch } from '@/features/search';
import * as loadedTask from '@/features/search/components/record-search-task';
import * as taskLoader from '@/features/search/lib/load-search-task';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
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
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getExpenses: vi.fn(),
  getTrades: vi.fn(),
  getDividends: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  callbacks: new Set<
    (event: string, session: { user: { id: string } } | null) => void
  >(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/dividend-actions', () => api);
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (
        callback: (
          event: string,
          session: { user: { id: string } } | null
        ) => void
      ) => {
        auth.callbacks.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => auth.callbacks.delete(callback),
            },
          },
        };
      },
    },
  }),
}));

const expense: ExpenseData = {
  id: 'synthetic-expense',
  date: '2026-01-02',
  type: 'food_drink',
  item: 'Synthetic meal',
  info: 'Synthetic searchable note',
  amount: 10,
  splitType: 'self',
  splits: [],
};
const snapshot: SnapshotData = {
  id: '2026-01',
  entries: [{ category: 'savings', account: 'Synthetic account', amount: 10 }],
};
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  auth.callbacks.clear();
  for (const read of Object.values(api)) read.mockResolvedValue([]);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  );
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function CaptureClient() {
  const value = useQueryClient();
  useEffect(() => {
    client = value;
  }, [value]);
  return null;
}
function mountSearch() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <RecordSearch />
    </QueryClientProvider>
  );
}
async function openSearch() {
  await userEvent.click(screen.getByRole('button', { name: 'Search records' }));
  return screen.findByRole('textbox', { name: 'Search your records' });
}
async function ready() {
  await waitFor(() =>
    expect(screen.queryByText(/Results are partial/)).not.toBeInTheDocument()
  );
}

it('reads exactly five histories only when opened and keeps blank state instructional', async () => {
  mountSearch();
  for (const read of Object.values(api)) expect(read).not.toHaveBeenCalled();
  await openSearch();
  await ready();
  for (const read of Object.values(api)) {
    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith();
  }
  expect(
    screen.getByText('Try an account, category, ticker or recorded date.')
  ).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText(/No matches/)).not.toBeInTheDocument();
});
it('resets term on close/reopen while retaining reusable owner histories and fresh read counts', async () => {
  api.getExpenses.mockResolvedValue([expense]);
  mountSearch();
  await openSearch();
  await ready();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'meal' },
  });
  expect(screen.getByText('Synthetic meal')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Search records' })).toHaveFocus();
  expect(client.getQueryData(['expenses'])).toEqual([expense]);
  expect(await openSearch()).toHaveValue('');
  expect(screen.queryByText('Synthetic meal')).not.toBeInTheDocument();
  for (const read of Object.values(api)) expect(read).toHaveBeenCalledOnce();
});
it('qualifies ready-source matches while another history is pending, never claiming global no matches', async () => {
  let complete!: (value: []) => void;
  api.getDividends.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  api.getExpenses.mockResolvedValue([expense]);
  mountSearch();
  await openSearch();
  await screen.findByText('1 record loaded');
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'meal' },
  });
  expect(screen.getByText('Synthetic meal')).toBeInTheDocument();
  expect(screen.getByText(/Results are partial/)).toBeInTheDocument();
  expect(screen.getByText('Loading distributions…')).toBeInTheDocument();
  expect(screen.queryByText(/No matches/)).not.toBeInTheDocument();
  await act(async () => complete([]));
  await ready();
});
it('shows opaque source failure and retries only that history', async () => {
  api.getSalaryRecords
    .mockRejectedValueOnce(new Error('Synthetic private details'))
    .mockResolvedValue([]);
  mountSearch();
  await openSearch();
  const retry = await screen.findByRole('button', { name: 'Retry salary' });
  expect(
    screen.queryByText(/Synthetic private details/)
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'absent' },
  });
  expect(screen.queryByText(/No matches/)).not.toBeInTheDocument();
  await userEvent.click(retry);
  await ready();
  expect(api.getSalaryRecords).toHaveBeenCalledTimes(2);
  for (const [name, read] of Object.entries(api))
    if (name !== 'getSalaryRecords') expect(read).toHaveBeenCalledOnce();
  expect(
    screen.getByText('No matches in the loaded personal histories.')
  ).toBeInTheDocument();
});
it('hides cached rows after a failed refetch and labels an in-flight cached refresh', async () => {
  api.getExpenses.mockResolvedValue([expense]);
  mountSearch();
  await openSearch();
  await ready();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'meal' },
  });
  let fail!: (reason: Error) => void;
  api.getExpenses.mockReturnValue(
    new Promise((_resolve, reject) => {
      fail = reject;
    })
  );
  await act(async () => {
    void client.invalidateQueries({ queryKey: ['expenses'] });
  });
  expect(
    await screen.findByText('Updating cached records · 1 record loaded')
  ).toBeInTheDocument();
  expect(screen.getByText(/Results are partial/)).toBeInTheDocument();
  await act(async () => fail(new Error('Synthetic refresh failed')));
  await screen.findByRole('button', { name: 'Retry expenses' });
  expect(screen.queryByText('Synthetic meal')).not.toBeInTheDocument();
  expect(screen.queryByText(/No matches/)).not.toBeInTheDocument();
});
it('updates matching from owner cache mutation without a new search request and keeps term local', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const history = vi.spyOn(window.history, 'pushState');
  const url = window.location.href;
  api.getExpenses.mockResolvedValue([expense]);
  mountSearch();
  await openSearch();
  await ready();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'new private match' },
  });
  await act(async () =>
    client.setQueryData(
      ['expenses'],
      [{ ...expense, item: 'New private match' }]
    )
  );
  expect(await screen.findByText('New private match')).toBeInTheDocument();
  expect(window.location.href).toBe(url);
  expect(storage).not.toHaveBeenCalled();
  expect(history).not.toHaveBeenCalled();
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  for (const read of Object.values(api)) {
    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith();
  }
});
it('renders at most twenty escaped matches with honest record destinations and bounded input', async () => {
  api.getSnapshots.mockResolvedValue(
    Array.from({ length: 6 }, (_, index) => ({
      ...snapshot,
      id: `2026-0${index + 1}`,
    }))
  );
  api.getSalaryRecords.mockResolvedValue(
    Array.from({ length: 6 }, (_, index) => ({
      id: `2026-0${index + 1}`,
      salary: 0,
      bonus: 0,
    }))
  );
  api.getExpenses.mockResolvedValue(
    Array.from({ length: 6 }, (_, index) => ({
      ...expense,
      id: `expense-${index}`,
      item: `<script> expense${index}`,
    }))
  );
  api.getTrades.mockResolvedValue(
    Array.from({ length: 6 }, () => ({
      date: '2026-01-03',
      ticker: 'DBS',
      broker: 'Synthetic',
      action: 'buy',
      shares: 10,
      price: 5,
      fees: 0,
    }))
  );
  api.getDividends.mockResolvedValue(
    Array.from({ length: 6 }, () => ({
      date: '2026-01-04',
      ticker: 'DBS',
      amount: 1,
      currency: 'USD',
    }))
  );
  mountSearch();
  const input = await openSearch();
  await ready();
  fireEvent.change(input, { target: { value: '2026' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(20);
  expect(screen.getAllByText('More matches; refine search.')).toHaveLength(5);
  expect(
    screen.getAllByRole('link', { name: 'Edit snapshot' })[0]
  ).toHaveAttribute('href', '/dashboard/entry?edit=2026-06');
  expect(
    screen.getAllByRole('link', { name: 'Open Salary' })[0]
  ).toHaveAttribute('href', '/dashboard/salary');
  expect(
    screen.getAllByRole('link', { name: 'Open Expenses' })[0]
  ).toHaveAttribute('href', '/dashboard/expenses');
  expect(
    within(screen.getByRole('region', { name: 'Expenses search' })).getByText(
      '<script> expense0'
    )
  ).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  fireEvent.change(input, { target: { value: 'x'.repeat(120) } });
  expect(input).toHaveValue('x'.repeat(100));
});
it('makes a deferred completion inert after closing without clearing other owner cache', async () => {
  let complete!: (value: ExpenseData[]) => void;
  api.getExpenses.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  mountSearch();
  client.setQueryData(['other-owner-history'], ['Synthetic retained']);
  await openSearch();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'meal' },
  });
  await userEvent.keyboard('{Escape}');
  await act(async () => complete([expense]));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic meal')).not.toBeInTheDocument();
  expect(client.getQueryData(['other-owner-history'])).toEqual([
    'Synthetic retained',
  ]);
  expect(await openSearch()).toHaveValue('');
  expect(screen.queryByText('Synthetic meal')).not.toBeInTheDocument();
});
it('closes when selecting a supported result without constructing guessed edit parameters', async () => {
  api.getExpenses.mockResolvedValue([expense]);
  mountSearch();
  await openSearch();
  await ready();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'meal' },
  });
  const link = screen.getByRole('link', { name: 'Open Expenses' });
  expect(link).toHaveAttribute('href', '/dashboard/expenses');
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  click.preventDefault();
  fireEvent(link, click);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it.each(['SIGNED_OUT', 'SIGNED_IN'])(
  'preserves095 identity lifetime on%s and rejects a late history reply',
  async (event) => {
    let complete!: (value: ExpenseData[]) => void;
    api.getExpenses.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    render(
      <Providers>
        <CaptureClient />
        <VaultLockProvider initiallyUnlocked userId="synthetic-a">
          <AuthIdentityWatcher userId="synthetic-a" />
          <VaultGate>
            <RecordSearch />
          </VaultGate>
        </VaultLockProvider>
      </Providers>
    );
    await openSearch();
    fireEvent.change(screen.getByLabelText('Search your records'), {
      target: { value: 'meal' },
    });
    act(() =>
      auth.callbacks.forEach((callback) =>
        callback(
          event,
          event === 'SIGNED_OUT' ? null : { user: { id: 'synthetic-b' } }
        )
      )
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Search records' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue to sign in' })
    ).toBeInTheDocument();
    await act(async () => complete([expense]));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.queryByText('Synthetic meal')).not.toBeInTheDocument();
  }
);
it('keeps the same-owner refresh and active search intact', async () => {
  api.getExpenses.mockResolvedValue([expense]);
  render(
    <Providers>
      <CaptureClient />
      <VaultLockProvider initiallyUnlocked userId="synthetic-a">
        <AuthIdentityWatcher userId="synthetic-a" />
        <VaultGate>
          <RecordSearch />
        </VaultGate>
      </VaultLockProvider>
    </Providers>
  );
  await openSearch();
  await ready();
  fireEvent.change(screen.getByLabelText('Search your records'), {
    target: { value: 'meal' },
  });
  act(() =>
    auth.callbacks.forEach((callback) =>
      callback('TOKEN_REFRESHED', { user: { id: 'synthetic-a' } })
    )
  );
  expect(screen.getByLabelText('Search your records')).toHaveValue('meal');
  expect(screen.getByText('Synthetic meal')).toBeInTheDocument();
  expect(client.getQueryData(['expenses'])).toEqual([expense]);
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

it('keeps code-loading failure opaque and retries before starting history reads', async () => {
  const load = vi
    .spyOn(taskLoader, 'loadSearchTask')
    .mockRejectedValueOnce(new Error('private chunk location'))
    .mockResolvedValue(loadedTask);
  mountSearch();
  expect(load).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Search records' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't open record search."
  );
  expect(document.body.textContent).not.toContain('private chunk location');
  for (const read of Object.values(api)) expect(read).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  expect(
    await screen.findByRole('textbox', { name: 'Search your records' })
  ).toHaveFocus();
  await ready();
  expect(load).toHaveBeenCalledTimes(2);
  for (const read of Object.values(api)) expect(read).toHaveBeenCalledOnce();
});
it.each(['success', 'failure'] as const)(
  'ignores an old module %s after closing and reopening the requested editor',
  async (outcome) => {
    let complete!: (value: typeof loadedTask) => void;
    let fail!: (error: Error) => void;
    const pending = new Promise<typeof loadedTask>((resolve, reject) => {
      complete = resolve;
      fail = reject;
    });
    const load = vi
      .spyOn(taskLoader, 'loadSearchTask')
      .mockReturnValueOnce(pending)
      .mockResolvedValue(loadedTask);
    mountSearch();
    await userEvent.click(
      screen.getByRole('button', { name: 'Search records' })
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading record search'
    );
    for (const read of Object.values(api)) expect(read).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    const input = await openSearch();
    await userEvent.type(input, 'Current synthetic term');
    await act(async () => {
      if (outcome === 'success') complete(loadedTask);
      else fail(new Error('old chunk failure'));
    });
    expect(input).toHaveValue('Current synthetic term');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    for (const read of Object.values(api)) expect(read).toHaveBeenCalledOnce();
  }
);
