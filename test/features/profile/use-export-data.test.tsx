// @vitest-environment jsdom
import { useExportData } from '@/features/profile/hooks/use-export-data';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  read: vi.fn(),
  snapshots: vi.fn(),
  dividends: vi.fn(() => Promise.resolve([])),
  toast: vi.fn(),
}));
vi.mock('@/features/assets/actions/planner-actions', () => ({
  getPlannerSettings: () => null,
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => ({
  getSnapshots: state.snapshots,
}));
vi.mock('@/features/equity/actions/equity-actions', () => ({
  getTrades: () => [],
}));
vi.mock('@/features/equity/actions/dividend-actions', () => ({
  getDividends: state.dividends,
}));
vi.mock('@/features/expenses/actions/expense-actions', () => ({
  getExpenses: () => [],
}));
vi.mock('@/features/salary/actions/relief-actions', () => ({
  getAllTaxReliefs: () => [],
}));
vi.mock('@/features/salary/actions/salary-actions', () => ({
  getSalaryRecords: () => [],
}));
vi.mock('@/features/profile/actions/profile-actions', () => ({
  getProfile: state.read,
}));
vi.mock('sonner', () => ({
  toast: { success: state.toast, error: state.toast },
}));
afterEach(() => vi.clearAllMocks());
beforeEach(() => state.snapshots.mockResolvedValue([]));
it('does not disclose export after vault unmount while reads are pending', async () => {
  let resolveRead: (value: null) => void = () => {};
  state.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      })
  );
  const download = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: download,
  });
  const view = renderHook(() => useExportData());
  let pending: Promise<void>;
  act(() => {
    pending = view.result.current.exportData();
  });
  view.unmount();
  await act(async () => {
    resolveRead(null);
    await pending;
  });
  expect(download).not.toHaveBeenCalled();
  expect(state.toast).not.toHaveBeenCalled();
});

it('rejects a failed dividend read without downloading a partial export', async () => {
  state.read.mockResolvedValue(null);
  state.dividends.mockRejectedValueOnce(new Error('private upstream detail'));
  const download = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: download,
  });
  const view = renderHook(() => useExportData());
  await act(async () => {
    await view.result.current.exportData();
  });
  expect(download).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenCalledWith(
    'Export failed. Make sure your vault is unlocked.'
  );
  view.unmount();
});

it('downloads a complete versioned backup and releases its temporary URL', async () => {
  state.snapshots.mockResolvedValue([
    {
      id: '2026-01',
      snapshotId: 'fixture-parent',
      revision: '9007199254740993',
      entries: [],
    },
  ]);
  state.read.mockResolvedValue({
    birthYear: 1990,
    isNsman: false,
    residencyStatus: 'resident',
  });
  const download = vi.fn((_blob: Blob) => 'blob:fixture-backup');
  const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: download,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revoke,
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const view = renderHook(() => useExportData());
  await act(async () => {
    await view.result.current.exportData();
  });
  expect(download).toHaveBeenCalledWith(expect.any(Blob));
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(download.mock.calls[0][0]);
  });
  expect(JSON.parse(content)).toEqual({
    version: 2,
    app: 'fynfo',
    exportedAt: expect.any(String),
    data: {
      profile: { birthYear: 1990, isNsman: false, residencyStatus: 'resident' },
      snapshots: [{ id: '2026-01', entries: [] }],
      expenses: [],
      salary: [],
      taxReliefs: [],
      trades: [],
      dividends: [],
      plannerSettings: null,
    },
  });
  expect(click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith('blob:fixture-backup');
  expect(document.querySelector('a[download]')).toBeNull();
  expect(state.dividends).toHaveBeenCalledOnce();
  expect(state.toast).toHaveBeenCalledWith('Data exported');
  expect(view.result.current.isExporting).toBe(false);
  click.mockRestore();
  view.unmount();
});
