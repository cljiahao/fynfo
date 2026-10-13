// @vitest-environment jsdom
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import {
  useRecurringExpenseLinks,
  useRecurringRulebook,
} from '@/features/recurring-expenses/hooks/use-recurring-rulebook';
import { applyRecurringCommand } from '@/features/recurring-expenses/lib/commands';
import type {
  RecurringBook,
  RecurringMutation,
  RecurringOutcome,
} from '@/features/recurring-expenses/types';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  expenses: vi.fn(),
}));
vi.mock('@/features/recurring-expenses/actions/recurring-actions', () => ({
  getRecurringRulebook: mocks.read,
  mutateRecurringRulebook: mocks.save,
}));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/constants')),
  getExpenses: mocks.expenses,
}));
const book: RecurringBook = {
  id: '13800000-0000-4000-8000-000000000001',
  revision: '1',
  payload: {
    schemaVersion: 1,
    requestId: '13800000-0000-4000-8000-000000000002',
    templates: [
      {
        archived: false,
        occurrences: [],
        definition: {
          id: '13800000-0000-4000-8000-000000000003',
          name: 'Synthetic monthly bill',
          enabled: true,
          preferredDay: 1,
          startMonth: '2000-01',
          endMonth: null,
          cents: 100,
          category: 'bills',
          item: 'Synthetic bill',
          info: '',
        },
      },
    ],
  },
};
const command: RecurringMutation['command'] = {
  kind: 'confirm',
  templateId: book.payload.templates[0].definition.id,
  month: '2000-01',
  expense: {
    id: '13800000-0000-4000-8000-000000000004',
    date: '2000-01-03',
    category: 'bills',
    item: 'Actual bill',
    info: '',
    cents: 150,
  },
};
function view() {
  return renderHook(
    () => ({
      recurring: useRecurringRulebook(),
      privacy: useAmountVisibility(),
      links: useRecurringExpenseLinks(),
    }),
    { wrapper: AmountVisibilityProvider }
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function recorded(input: RecurringMutation): RecurringBook {
  return {
    id: book.id,
    revision: '2',
    payload: applyRecurringCommand(book.payload, input, '2000-03-01'),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(book);
  mocks.save.mockResolvedValue({ status: 'saved' });
  mocks.expenses.mockResolvedValue([]);
});
afterEach(cleanup);
it.each([false, true])(
  'keeps a confirmed submission checkable when Hide/Show interrupts its reload (batched: %s)',
  async (batched) => {
    const v = view();
    await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
    const pending = deferred<RecurringBook>();
    mocks.read.mockReturnValueOnce(pending.promise);
    let saving!: Promise<boolean>;
    act(() => {
      saving = v.result.current.recurring.execute(command);
    });
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    const saved = recorded(mocks.save.mock.calls[0][0]);
    act(() => {
      v.result.current.privacy.hideAmounts();
      if (batched) v.result.current.privacy.showAmounts();
    });
    if (!batched) act(() => v.result.current.privacy.showAmounts());
    await act(async () => {
      pending.resolve(saved);
      expect(await saving).toBe(false);
    });
    expect(v.result.current.recurring.stage).toBe('unconfirmed');
    mocks.read.mockResolvedValue(saved);
    await act(async () => {
      expect(await v.result.current.recurring.check()).toBe(true);
    });
    expect(v.result.current.recurring.stage).toBe('ready');
    expect(mocks.save).toHaveBeenCalledTimes(1);
  }
);
it('preserves the original review revision through Hide/Show and detects a concurrent edit', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  mocks.read.mockResolvedValue({ ...book, revision: '2' });
  mocks.save.mockResolvedValue({ status: 'conflict' });
  act(() => v.result.current.privacy.hideAmounts());
  act(() => v.result.current.privacy.showAmounts());
  await act(async () => {
    await v.result.current.recurring.execute(command);
  });
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0][0].expectedRevision).toBe('1');
  expect(v.result.current.recurring.stage).toBe('conflict');
});
it('loads under Strict Mode without waiting for its discarded initial read', async () => {
  const old = deferred<RecurringBook | null>();
  mocks.read.mockReturnValueOnce(old.promise);
  const v = renderHook(() => useRecurringRulebook(), {
    reactStrictMode: true,
    wrapper: AmountVisibilityProvider,
  });
  await waitFor(() => expect(v.result.current.stage).toBe('ready'));
  expect(mocks.read).toHaveBeenCalledTimes(2);
  await act(async () => old.resolve(null));
  expect(v.result.current.book).toEqual(book);
  expect(mocks.save).not.toHaveBeenCalled();
});
it('never writes on load and guards repeated same-tick confirmation', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  expect(mocks.save).not.toHaveBeenCalled();
  const pending = deferred<RecurringOutcome>();
  mocks.save.mockReturnValue(pending.promise);
  let saving!: Promise<boolean>;
  act(() => {
    saving = v.result.current.recurring.execute(command);
    void v.result.current.recurring.execute(command);
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  mocks.read.mockResolvedValue(recorded(mocks.save.mock.calls[0][0]));
  await act(async () => {
    pending.resolve({ status: 'saved' });
    await saving;
  });
  expect(
    v.result.current.recurring.book?.payload.templates[0].occurrences
  ).toHaveLength(1);
});
it('freezes unknown submissions and confirms their receipt after an intervening template edit', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  mocks.save.mockRejectedValue(new Error('lost acknowledgement'));
  await act(async () => {
    await v.result.current.recurring.execute(command);
  });
  expect(v.result.current.recurring.stage).toBe('unconfirmed');
  await act(async () => {
    await v.result.current.recurring.check();
    await v.result.current.recurring.execute(command);
  });
  expect(v.result.current.recurring.stage).toBe('unconfirmed');
  expect(mocks.save).toHaveBeenCalledTimes(1);
  const saved = recorded(mocks.save.mock.calls[0][0]);
  saved.revision = '20';
  saved.payload.requestId = book.id;
  saved.payload.templates[0].definition.name = 'Later edit';
  mocks.read.mockResolvedValue(saved);
  await act(async () => {
    await v.result.current.recurring.check();
  });
  expect(v.result.current.recurring.stage).toBe('ready');
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
it('allows a fresh Check after Hide/Show before the original write answers and ignores the old callback', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  const pending = deferred<RecurringOutcome>();
  mocks.save.mockReturnValue(pending.promise);
  let saving!: Promise<boolean>;
  act(() => {
    saving = v.result.current.recurring.execute(command);
  });
  const saved = recorded(mocks.save.mock.calls[0][0]);
  mocks.read.mockResolvedValue(saved);
  act(() => v.result.current.privacy.hideAmounts());
  act(() => v.result.current.privacy.showAmounts());
  await act(async () => {
    await v.result.current.recurring.check();
  });
  expect(v.result.current.recurring.stage).toBe('ready');
  await act(async () => {
    pending.resolve({ status: 'unconfirmed' });
    await saving;
  });
  expect(v.result.current.recurring.stage).toBe('ready');
  expect(v.result.current.recurring.book).toEqual(saved);
});
it('does not treat a different receipt as success and supports explicit conflict reload', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  mocks.save.mockResolvedValue({ status: 'unconfirmed' });
  await act(async () => {
    await v.result.current.recurring.execute(command);
  });
  const saved = recorded(mocks.save.mock.calls[0][0]);
  saved.payload.templates[0].occurrences[0].requestId = book.id;
  mocks.read.mockResolvedValue(saved);
  await act(async () => {
    await v.result.current.recurring.check();
  });
  expect(v.result.current.recurring.stage).toBe('conflict');
  await act(async () => {
    await v.result.current.recurring.load();
  });
  expect(v.result.current.recurring.stage).toBe('ready');
});
it('retains errors, blocks hidden calls and rejects results after owner teardown', async () => {
  mocks.read.mockRejectedValueOnce(new Error('private'));
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.stage).toBe('error'));
  expect(v.result.current.recurring.message).not.toContain('private');
  await act(async () => {
    await v.result.current.recurring.load();
  });
  act(() => v.result.current.privacy.hideAmounts());
  await act(async () => {
    await v.result.current.recurring.execute(command);
  });
  expect(mocks.save).not.toHaveBeenCalled();
  act(() => v.result.current.privacy.showAmounts());
  await waitFor(() => expect(v.result.current.recurring.stage).toBe('ready'));
  const pending = deferred<RecurringOutcome>();
  mocks.save.mockReturnValue(pending.promise);
  let saving!: Promise<boolean>;
  act(() => {
    saving = v.result.current.recurring.execute(command);
  });
  v.unmount();
  await act(async () => {
    pending.resolve({ status: 'saved' });
    await saving;
  });
});
it('never claims save failure when a confirmed save is followed by a failed reload', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  mocks.read.mockRejectedValue(new Error('reload failed'));
  let saved = false;
  await act(async () => {
    saved = await v.result.current.recurring.execute(command);
  });
  expect(saved).toBe(true);
  expect(v.result.current.recurring.message).toMatch(/Save confirmed/);
  expect(v.result.current.recurring.stage).toBe('error');
});
it('invalidates linked-expense read on Hide and allows a new check without waiting for the old read', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.recurring.canEdit).toBe(true));
  const old = deferred<[]>();
  mocks.expenses.mockReturnValueOnce(old.promise);
  let reading!: Promise<void>;
  act(() => {
    reading = v.result.current.links.check();
  });
  act(() => v.result.current.privacy.hideAmounts());
  act(() => v.result.current.privacy.showAmounts());
  await act(async () => {
    await v.result.current.links.check();
  });
  expect(v.result.current.links.rows).toEqual([]);
  await act(async () => {
    old.resolve([]);
    await reading;
  });
  expect(mocks.expenses).toHaveBeenCalledTimes(2);
});
