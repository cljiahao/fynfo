// @vitest-environment jsdom
import { SnapshotForm } from '@/features/assets/components/snapshot-form';
import { SnapshotTable } from '@/features/assets/components/snapshot-table';
import type { SnapshotRecord } from '@/features/assets/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const api = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  getSnapshots: vi.fn(),
  upsertSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  push: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
const original: SnapshotRecord = {
  id: '2026-01',
  snapshotId: 'parent-original',
  revision: '1',
  entries: [{ category: 'savings', account: 'Fixture', amount: 100 }],
};
const fresh: SnapshotRecord = {
  ...original,
  revision: '2',
  entries: [{ category: 'savings', account: 'Fresh', amount: 999 }],
};
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  });
  const view = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  return { ...view, client };
}
async function edit() {
  await screen.findByRole('button', { name: 'Update Snapshot' });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '123' },
  });
}
function amount() {
  return (screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value;
}
async function save(name = 'Update Snapshot') {
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(api.upsertSnapshot).toHaveBeenCalledTimes(1));
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getSnapshot.mockResolvedValue(original);
  api.getSnapshots.mockResolvedValue([original]);
  api.upsertSnapshot.mockResolvedValue({ ok: true });
  api.deleteSnapshot.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

it('submits the draft baseline rather than a refetched identity/revision', async () => {
  const { client } = mount(<SnapshotForm editId="2026-01" />);
  await edit();
  await act(async () => {
    client.setQueryData(['snapshots', '2026-01'], fresh);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await save();
  expect(api.upsertSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({
      entries: [{ category: 'savings', account: 'Fixture', amount: 123 }],
    }),
    '2026-01',
    expect.objectContaining({ snapshotId: 'parent-original', revision: '1' })
  );
});

it('preserves a conflicted draft until explicit reload and captures the reviewed baseline', async () => {
  api.upsertSnapshot.mockResolvedValueOnce({ ok: false, code: 'CONFLICT' });
  const view = mount(<SnapshotForm editId="2026-01" />);
  await edit();
  await save();
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('Your draft is preserved')
  );
  expect(amount()).toBe('123');
  expect(
    screen.getByRole('button', { name: 'Update Snapshot' })
  ).toHaveProperty('disabled', true);
  fireEvent.submit(view.container.querySelector('form')!);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(api.upsertSnapshot).toHaveBeenCalledTimes(1);
  expect(api.push).not.toHaveBeenCalled();
  api.getSnapshot.mockResolvedValue(fresh);
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await waitFor(() => expect(amount()).toBe('999'));
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Update Snapshot' }));
  await waitFor(() => expect(api.upsertSnapshot).toHaveBeenCalledTimes(2));
  expect(api.upsertSnapshot.mock.calls[1][2]).toMatchObject({
    snapshotId: 'parent-original',
    revision: '2',
  });
});

it('does not automatically retry an uncertain create; a failed check retains the draft', async () => {
  api.getSnapshots.mockResolvedValue([]);
  api.upsertSnapshot.mockRejectedValueOnce(new Error('lost response'));
  mount(<SnapshotForm />);
  await screen.findByRole('button', { name: 'Save Snapshot' });
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-03' },
  });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '123' },
  });
  await save('Save Snapshot');
  await screen.findByRole('alert');
  expect(api.upsertSnapshot).toHaveBeenCalledTimes(1);
  api.getSnapshot.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await screen.findByText(
    'Could not check the latest snapshot. Your draft is preserved.'
  );
  expect(amount()).toBe('123');
  expect(screen.getByRole('button', { name: 'Save Snapshot' })).toHaveProperty(
    'disabled',
    true
  );
  api.getSnapshot.mockResolvedValue(null);
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(amount()).toBe('123');
  expect(
    (screen.getByLabelText('Select Month') as HTMLInputElement).value
  ).toBe('2026-03');
  expect(screen.getByRole('button', { name: 'Save Snapshot' })).toHaveProperty(
    'disabled',
    false
  );
  expect(api.upsertSnapshot).toHaveBeenCalledTimes(1);
});

it('reviews an already-committed create through the edit route without replaying it', async () => {
  api.getSnapshots.mockResolvedValue([]);
  api.upsertSnapshot.mockRejectedValueOnce(new Error('lost response'));
  mount(<SnapshotForm />);
  await screen.findByRole('button', { name: 'Save Snapshot' });
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-03' },
  });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '123' },
  });
  await save('Save Snapshot');
  await screen.findByRole('alert');
  api.getSnapshot.mockResolvedValue({ ...original, id: '2026-03' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await waitFor(() =>
    expect(api.push).toHaveBeenCalledWith('/dashboard/entry?edit=2026-03')
  );
  expect(api.upsertSnapshot).toHaveBeenCalledTimes(1);
});

it('checks both target and original after an uncertain rename and keeps missing edits blocked', async () => {
  api.upsertSnapshot.mockRejectedValueOnce(new Error('lost response'));
  mount(<SnapshotForm editId="2026-01" />);
  await edit();
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-03' },
  });
  await save();
  await screen.findByRole('alert');
  api.getSnapshot.mockResolvedValue(null);
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await screen.findByText(
    'This snapshot no longer exists. Your draft is preserved; cancel to start a new snapshot.'
  );
  expect(api.getSnapshot.mock.calls.slice(-2)).toEqual([
    ['2026-03'],
    ['2026-01'],
  ]);
  expect(amount()).toBe('123');
  expect(
    screen.getByRole('button', { name: 'Update Snapshot' })
  ).toHaveProperty('disabled', true);
  expect(api.upsertSnapshot).toHaveBeenCalledTimes(1);
});

it('keeps a dirty editor visible when a background read fails', async () => {
  const { client } = mount(<SnapshotForm editId="2026-01" />);
  await edit();
  api.getSnapshot.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await client.refetchQueries({
      queryKey: ['snapshots', '2026-01'],
      exact: true,
    });
  });
  expect(amount()).toBe('123');
  expect(
    await screen.findByText(
      'Latest data could not be refreshed. Your draft is preserved.'
    )
  ).toBeTruthy();
});

it('binds delete confirmation to the opened record, even if table props refresh', async () => {
  api.deleteSnapshot.mockResolvedValueOnce({ ok: false, code: 'CONFLICT' });
  const view = mount(<SnapshotTable snapshots={[original]} />);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Delete snapshot' })[0]
  );
  view.rerender(
    <QueryClientProvider client={view.client}>
      <SnapshotTable snapshots={[fresh]} />
    </QueryClientProvider>
  );
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: /^Delete$/ })
  );
  await waitFor(() =>
    expect(api.deleteSnapshot).toHaveBeenCalledWith('2026-01', {
      snapshotId: original.snapshotId,
      revision: original.revision,
    })
  );
  expect(
    await screen.findByText(
      'Snapshot changed. Refresh history before deleting.'
    )
  ).toBeTruthy();
  expect(
    screen.getAllByRole('button', { name: 'Delete snapshot' })[0]
  ).toHaveProperty('disabled', true);
  api.getSnapshots.mockResolvedValue([fresh]);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Delete snapshot' })[0]
  );
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: /^Delete$/ })
  );
  await waitFor(() => expect(api.deleteSnapshot).toHaveBeenCalledTimes(2));
  expect(api.deleteSnapshot.mock.calls[1][1]).toMatchObject({ revision: '2' });
});

it('initializes every account row before watching loaded values', async () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    category: 'savings' as const,
    account: 'Fixture ' + index,
    amount: index + 1,
  }));
  api.getSnapshot.mockResolvedValue({ ...original, entries });
  mount(<SnapshotForm editId="2026-01" />);
  await screen.findByRole('button', { name: 'Update Snapshot' });
  await waitFor(() =>
    expect(screen.getAllByPlaceholderText('Account name')).toHaveLength(18)
  );
  expect(screen.getByDisplayValue('Fixture 11')).toBeTruthy();
  expect(screen.getAllByRole('spinbutton')[11]).toHaveProperty('value', '12');
});

it('does not redirect or replace a newly selected editor when an earlier save finishes', async () => {
  let finish: (value: { ok: true }) => void = () => {};
  api.upsertSnapshot.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const view = mount(<SnapshotForm editId="2026-01" />);
  await edit();
  await save();
  api.getSnapshot.mockResolvedValue({
    ...fresh,
    id: '2026-02',
    snapshotId: 'second-parent',
    entries: [{ category: 'savings', account: 'Second', amount: 200 }],
  });
  view.rerender(
    <QueryClientProvider client={view.client}>
      <SnapshotForm editId="2026-02" />
    </QueryClientProvider>
  );
  await waitFor(() => expect(amount()).toBe('200'));
  await act(async () => {
    finish({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(api.push).not.toHaveBeenCalled();
  expect(amount()).toBe('200');
});

it('blocks uncertain delete retries and retains the recovery control when refresh fails', async () => {
  api.deleteSnapshot.mockRejectedValue(new Error('lost response'));
  mount(<SnapshotTable snapshots={[original]} />);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Delete snapshot' })[0]
  );
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: /^Delete$/ })
  );
  await screen.findByText(
    'Delete outcome is uncertain. Refresh history before trying again.'
  );
  expect(api.deleteSnapshot).toHaveBeenCalledTimes(1);
  expect(
    screen.getAllByRole('button', { name: 'Delete snapshot' })[0]
  ).toHaveProperty('disabled', true);
  api.getSnapshots.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
  await screen.findByText(
    'Could not refresh history. Try again before deleting.'
  );
  expect(api.deleteSnapshot).toHaveBeenCalledTimes(1);
  expect(
    screen.getAllByRole('button', { name: 'Delete snapshot' })[0]
  ).toHaveProperty('disabled', true);
});

it('does not load a different record occupying the target after an uncertain rename', async () => {
  api.upsertSnapshot.mockRejectedValueOnce(new Error('lost response'));
  mount(<SnapshotForm editId="2026-01" />);
  await edit();
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-03' },
  });
  await save();
  await screen.findByRole('alert');
  api.getSnapshot.mockImplementation(async (id: string) =>
    id === '2026-03'
      ? { ...fresh, id: '2026-03', snapshotId: 'different-parent' }
      : fresh
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await waitFor(() => expect(amount()).toBe('999'));
  expect(
    (screen.getByLabelText('Select Month') as HTMLInputElement).value
  ).toBe('2026-01');
  expect(api.getSnapshot.mock.calls.slice(-2)).toEqual([
    ['2026-03'],
    ['2026-01'],
  ]);
  expect(api.push).not.toHaveBeenCalled();
});

it('reloads a fresh read instead of reusing an older in-flight response', async () => {
  let finishOld: (value: SnapshotRecord) => void = () => {};
  api.upsertSnapshot.mockResolvedValueOnce({ ok: false, code: 'CONFLICT' });
  const view = mount(<SnapshotForm editId="2026-01" />);
  await edit();
  api.getSnapshot.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      })
  );
  let oldRead: Promise<void>;
  act(() => {
    oldRead = view.client.refetchQueries({
      queryKey: ['snapshots', '2026-01'],
      exact: true,
    });
  });
  await waitFor(() => expect(api.getSnapshot).toHaveBeenCalledTimes(2));
  await save();
  await screen.findByRole('alert');
  api.getSnapshot.mockResolvedValue(fresh);
  fireEvent.click(
    screen.getByRole('button', { name: 'Check latest and reload' })
  );
  await waitFor(() => expect(amount()).toBe('999'));
  await act(async () => {
    finishOld(original);
    await oldRead!;
  });
  expect(amount()).toBe('999');
  expect(api.getSnapshot).toHaveBeenCalledTimes(3);
});
