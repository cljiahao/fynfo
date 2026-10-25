// @vitest-environment jsdom
import type {
  ImportedExpenseInput,
  ImportExpenseOutcome,
} from '@/features/expenses/lib/import-expense';
import { useStatementSave } from '@/features/import-review/hooks/use-statement-save';
import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/lib/import-expense')),
  ...(await import('@/features/expenses/constants')),
  getExpenses: api.read,
  insertImportedExpenses: api.save,
}));
const period = { from: '2026-10-01', to: '2026-10-31' };
function fixture(count = 45, padded = false) {
  const rows = parseStatementLines(
    [
      'UOB SGD billed',
      ...Array.from(
        { length: count },
        (_, index) => `01 OCT MARKET ${index} 1.00`
      ),
    ].map((text, index) => ({ page: 1, line: index + 1, text })),
    'uob',
    period
  );
  if (padded)
    for (const row of rows)
      for (let index = 0; index < 3; index++)
        row.source.push({
          page: 1,
          line: 100 + index,
          text: '\u0001'.repeat(4000),
        });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const hook = renderHook(() => useStatementSave(rows, 'uob', period), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => hook.result.current.selectExpenses(rows));
  return { ...hook, invalidate, client };
}
beforeEach(() => {
  vi.clearAllMocks();
  api.read.mockResolvedValue([]);
  api.save.mockImplementation(async (inputs: ImportedExpenseInput[]) =>
    inputs.map(({ id }) => ({ id, status: 'confirmed' }))
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('saves 45 selected rows in three action calls and refreshes only once', async () => {
  const { result, invalidate, client } = fixture();
  expect(result.current.selection).toHaveLength(45);
  await act(() => result.current.compare());
  await act(() => result.current.save());
  expect(api.save.mock.calls.map(([rows]) => rows.length)).toEqual([20, 20, 5]);
  expect(
    Object.values(result.current.attempts).filter(
      (row) => row.status === 'confirmed'
    )
  ).toHaveLength(45);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(api.read).toHaveBeenCalledTimes(1);
  client.clear();
});

it('releases a hung duplicate check and leaves editable selection intact', async () => {
  vi.useFakeTimers();
  api.read.mockImplementation(() => new Promise(() => {}));
  const { result, client } = fixture(1);
  let checking!: Promise<void>;
  act(() => {
    checking = result.current.compare();
  });
  expect(result.current.busy).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await checking;
  });
  expect(result.current.busy).toBe(false);
  expect(result.current.reviewed).toBe(false);
  expect(result.current.selection).toHaveLength(1);
  expect(api.save).not.toHaveBeenCalled();
  client.clear();
});

it('times out a hung group, retains all IDs, ignores late acknowledgement and never retries it', async () => {
  vi.useFakeTimers();
  let finish!: (rows: ImportExpenseOutcome[]) => void;
  api.save.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result, client } = fixture(25);
  await act(() => result.current.compare());
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.save();
  });
  const submitted = api.save.mock.calls[0][0] as ImportedExpenseInput[];
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await saving;
  });
  expect(result.current.busy).toBe(false);
  expect(
    Object.values(result.current.attempts).filter(
      (row) => row.status === 'unconfirmed'
    )
  ).toHaveLength(20);
  expect(
    Object.values(result.current.attempts).filter(
      (row) => row.status === 'not_started'
    )
  ).toHaveLength(5);
  await act(async () =>
    finish(submitted.map(({ id }) => ({ id, status: 'confirmed' })))
  );
  expect(result.current.unresolved).toBe(true);
  act(() => result.current.continueBatch());
  expect(api.save).toHaveBeenCalledTimes(1);
  expect(
    Object.values(result.current.attempts)
      .slice(0, 20)
      .map((row) => row.input.id)
  ).toEqual(submitted.map((row) => row.id));
  client.clear();
});

it('times out recovery reads without clearing frozen write identities', async () => {
  vi.useFakeTimers();
  api.save.mockRejectedValue(new Error('synthetic unknown'));
  const { result, client } = fixture(1);
  await act(() => result.current.compare());
  await act(() => result.current.save());
  api.read.mockImplementation(() => new Promise(() => {}));
  let checking!: Promise<void>;
  act(() => {
    checking = result.current.check();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await checking;
  });
  expect(result.current.busy).toBe(false);
  expect(result.current.unresolved).toBe(true);
  expect(result.current.message).toContain('Frozen submissions are retained');
  client.clear();
});

it('automatically reduces group size for escaped source text below the request payload ceiling', async () => {
  const { result, client } = fixture(20, true);
  expect(result.current.selection).toHaveLength(20);
  await act(() => result.current.compare());
  await act(() => result.current.save());
  expect(api.save.mock.calls.length).toBeGreaterThan(1);
  expect(api.save.mock.calls.flatMap(([rows]) => rows)).toHaveLength(20);
  for (const [rows] of api.save.mock.calls)
    expect(
      new TextEncoder().encode(JSON.stringify(rows)).length
    ).toBeLessThanOrEqual(512 * 1024);
  client.clear();
});

it('reports group progress while saving and completes without a discard prompt', async () => {
  let release!: () => void;
  api.save.mockImplementationOnce(
    (inputs: ImportedExpenseInput[]) =>
      new Promise((resolve) => {
        release = () =>
          resolve(inputs.map(({ id }) => ({ id, status: 'confirmed' })));
      })
  );
  const { result, client } = fixture();
  await act(() => result.current.compare());
  expect(result.current.reviewed).toBe(true);
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.save();
  });
  expect(result.current.activity).toBe('save');
  expect(result.current.progress).toEqual({
    done: 0,
    total: 45,
    group: 1,
    groups: 3,
  });
  expect(result.current.allowDiscard()).toBe(false);
  await act(async () => {
    release();
    await saving;
  });
  expect(result.current.complete).toBe(true);
  expect(result.current.progress).toBeNull();
  const confirm = vi.spyOn(window, 'confirm');
  expect(result.current.allowDiscard()).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  client.clear();
});

it('marks only the edited row stale and rechecks just that row', async () => {
  const period = { from: '2026-10-01', to: '2026-10-31' };
  const rows = parseStatementLines(
    ['UOB SGD billed', '01 OCT ONE 1.00', '01 OCT TWO 2.00'].map(
      (text, index) => ({ page: 1, line: index + 1, text })
    ),
    'uob',
    period
  );
  const client = new QueryClient();
  const hook = renderHook(
    ({ current }) => useStatementSave(current, 'uob', period),
    {
      initialProps: { current: rows },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }
  );
  act(() => hook.result.current.selectExpenses(rows));
  await act(() => hook.result.current.compare());
  expect(hook.result.current.reviewed).toBe(true);
  hook.rerender({
    current: [{ ...rows[0], description: 'Edited' }, rows[1]],
  });
  expect(hook.result.current.isStale(rows[0].id)).toBe(true);
  expect(hook.result.current.isStale(rows[1].id)).toBe(false);
  expect(hook.result.current.pendingCount).toBe(1);
  expect(hook.result.current.recheck).toBe(true);
  await act(() => hook.result.current.compare());
  expect(hook.result.current.reviewed).toBe(true);
  expect(api.read).toHaveBeenCalledTimes(2);
  client.clear();
});
