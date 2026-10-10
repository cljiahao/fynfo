import { createOverviewReadCohorts } from '@/features/overview/lib/read-cohorts';
import type {
  OverviewReadAction,
  OverviewReadOutcome,
} from '@/features/overview/types';
import { expect, it, vi } from 'vitest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

it('coalesces unique pending sources and resolves each independently', async () => {
  const slow = deferred<OverviewReadOutcome<[]>>();
  const action = vi.fn<OverviewReadAction>().mockResolvedValue({
    snapshots: slow.promise,
    salary: Promise.resolve({ ok: true, data: [] }),
  });
  const transport = createOverviewReadCohorts(action);
  const snapshots = transport.read('snapshots', new AbortController().signal);
  const salary = transport.read('salary', new AbortController().signal);
  await expect(salary).resolves.toEqual([]);
  expect(action).toHaveBeenCalledExactlyOnceWith(['snapshots', 'salary']);
  let done = false;
  void snapshots.then(() => {
    done = true;
  });
  expect(done).toBe(false);
  slow.resolve({ ok: true, data: [] });
  await expect(snapshots).resolves.toEqual([]);
});

it('starts fresh duplicate-key cohorts and does not let old finalizers consume later reads', async () => {
  const old = deferred<OverviewReadOutcome<[]>>();
  const action = vi
    .fn<OverviewReadAction>()
    .mockResolvedValueOnce({ salary: old.promise })
    .mockResolvedValue({
      salary: Promise.resolve({
        ok: true,
        data: [{ id: '2026-02', salary: 5, bonus: 0 }],
      }),
    });
  const transport = createOverviewReadCohorts(action);
  const first = transport.read('salary', new AbortController().signal);
  const second = transport.read('salary', new AbortController().signal);
  await expect(second).resolves.toEqual([
    { id: '2026-02', salary: 5, bonus: 0 },
  ]);
  old.resolve({ ok: true, data: [] });
  await expect(first).resolves.toEqual([]);
  await expect(
    transport.read('salary', new AbortController().signal)
  ).resolves.toHaveLength(1);
  expect(action).toHaveBeenCalledTimes(3);
  expect(action.mock.calls).toEqual([[['salary']], [['salary']], [['salary']]]);
});

it('drops cancellation before flush and in the gap before starting the action', async () => {
  const action = vi.fn<OverviewReadAction>();
  const transport = createOverviewReadCohorts(action);
  const before = new AbortController();
  before.abort();
  await expect(transport.read('salary', before.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  const queued = new AbortController();
  const one = transport.read('salary', queued.signal);
  const oneRejected = expect(one).rejects.toMatchObject({ name: 'AbortError' });
  queued.abort();
  await oneRejected;
  const gap = new AbortController();
  const two = transport.read('salary', gap.signal);
  const twoRejected = expect(two).rejects.toMatchObject({ name: 'AbortError' });
  queueMicrotask(() => gap.abort());
  await twoRejected;
  expect(action).not.toHaveBeenCalled();
});

it('rejects a cancelled started source while its surviving source finishes', async () => {
  const old = deferred<OverviewReadOutcome<[]>>();
  const action = vi.fn<OverviewReadAction>().mockResolvedValue({
    salary: old.promise,
    snapshots: Promise.resolve({ ok: true, data: [] }),
  });
  const transport = createOverviewReadCohorts(action);
  const controller = new AbortController();
  const salary = transport.read('salary', controller.signal);
  const rejected = expect(salary).rejects.toMatchObject({ name: 'AbortError' });
  await expect(
    transport.read('snapshots', new AbortController().signal)
  ).resolves.toEqual([]);
  controller.abort();
  old.resolve({ ok: true, data: [] });
  await rejected;
  expect(action).toHaveBeenCalledOnce();
});

it('signal abort removes started listeners but permits a fresh StrictMode lifecycle', async () => {
  const old = deferred<OverviewReadOutcome<[]>>();
  const action = vi
    .fn<OverviewReadAction>()
    .mockResolvedValueOnce({ salary: old.promise })
    .mockResolvedValue({ salary: Promise.resolve({ ok: true, data: [] }) });
  const transport = createOverviewReadCohorts(action);
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const first = transport.read('salary', controller.signal);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
  controller.abort();
  old.resolve({ ok: true, data: [] });
  await rejected;
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  await expect(
    transport.read('salary', new AbortController().signal)
  ).resolves.toEqual([]);
  expect(action).toHaveBeenCalledTimes(2);
});

it.each(['source', 'outer', 'missing', 'nested-rejection'])(
  'redacts %s failure and requests a fresh failed-only retry',
  async (kind) => {
    const action = vi.fn<OverviewReadAction>();
    if (kind === 'outer')
      action.mockRejectedValueOnce(new Error('private action detail'));
    else if (kind === 'missing') action.mockResolvedValueOnce({});
    else
      action.mockResolvedValueOnce({
        salary:
          kind === 'source'
            ? Promise.resolve({ ok: false, code: 'UNAVAILABLE' })
            : Promise.reject(new Error('private nested detail')),
      });
    action.mockResolvedValue({
      salary: Promise.resolve({ ok: true, data: [] }),
    });
    const transport = createOverviewReadCohorts(action);
    await expect(
      transport.read('salary', new AbortController().signal)
    ).rejects.toThrow('Could not load overview source');
    await expect(
      transport.read('salary', new AbortController().signal)
    ).resolves.toEqual([]);
    expect(action.mock.calls).toEqual([[['salary']], [['salary']]]);
  }
);
it('cancels then queues a fresh same-key request before the old flush microtask', async () => {
  const action = vi
    .fn<OverviewReadAction>()
    .mockResolvedValue({ salary: Promise.resolve({ ok: true, data: [] }) });
  const transport = createOverviewReadCohorts(action);
  const controller = new AbortController();
  const first = transport.read('salary', controller.signal);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  const second = transport.read('salary', new AbortController().signal);
  await rejected;
  await expect(second).resolves.toEqual([]);
  expect(action).toHaveBeenCalledExactlyOnceWith(['salary']);
});
it.each(['outer', 'nested'])(
  'makes a late old %s rejection inert after a fresh cohort succeeds',
  async (kind) => {
    let fail!: (reason: Error) => void;
    const pending = new Promise<never>((_resolve, reject) => {
      fail = reject;
    });
    const action = vi.fn<OverviewReadAction>();
    if (kind === 'outer') action.mockReturnValueOnce(pending);
    else action.mockResolvedValueOnce({ salary: pending });
    action.mockResolvedValue({
      salary: Promise.resolve({ ok: true, data: [] }),
    });
    const transport = createOverviewReadCohorts(action);
    const controller = new AbortController();
    const first = transport.read('salary', controller.signal);
    const rejected = expect(first).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
    controller.abort();
    await expect(
      transport.read('salary', new AbortController().signal)
    ).resolves.toEqual([]);
    fail(new Error('late private source failure'));
    await rejected;
    await Promise.resolve();
    expect(action).toHaveBeenCalledTimes(2);
  }
);
