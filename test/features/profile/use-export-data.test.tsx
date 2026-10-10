// @vitest-environment jsdom
import type { SnapshotRecord } from '@/features/assets/types';
import { ExportDataCard } from '@/features/profile/components/export-data-card';
import { useExportData } from '@/features/profile/hooks/use-export-data';
import type { ExportData } from '@/features/profile/lib/export-data';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  profile: vi.fn(),
  snapshots: vi.fn(),
  expenses: vi.fn(),
  salary: vi.fn(),
  taxReliefs: vi.fn(),
  trades: vi.fn(),
  dividends: vi.fn(),
  plannerSettings: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/assets/actions/planner-actions', () => ({
  getPlannerSettings: state.plannerSettings,
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => ({
  getSnapshots: state.snapshots,
}));
vi.mock('@/features/equity/actions/equity-actions', () => ({
  getTrades: state.trades,
}));
vi.mock('@/features/equity/actions/dividend-actions', () => ({
  getDividends: state.dividends,
}));
vi.mock('@/features/expenses/actions/expense-actions', () => ({
  getExpenses: state.expenses,
}));
vi.mock('@/features/salary/actions/relief-actions', () => ({
  getAllTaxReliefs: state.taxReliefs,
}));
vi.mock('@/features/salary/actions/salary-actions', () => ({
  getSalaryRecords: state.salary,
}));
vi.mock('@/features/profile/actions/profile-actions', () => ({
  getProfile: state.profile,
}));
vi.mock('sonner', () => ({
  toast: { success: state.success, error: state.error },
}));

const EMPTY: ExportData = {
  profile: null,
  snapshots: [],
  expenses: [],
  salary: [],
  taxReliefs: [],
  trades: [],
  dividends: [],
  plannerSettings: null,
};
const NONEMPTY: ExportData = {
  profile: { birthYear: 1990, isNsman: false, residencyStatus: 'resident' },
  snapshots: [
    {
      id: '2026-01',
      entries: [
        { category: 'savings', account: 'Synthetic account', amount: 123.45 },
      ],
    },
  ],
  expenses: [
    {
      id: 'fixture-expense',
      date: '2026-01-02',
      type: 'shopping',
      item: 'Fixture item',
      info: 'Fixture note',
      amount: 10.5,
      splitType: 'shared',
      splits: [{ person: 'Fixture person', amount: 5.25, settled: false }],
    },
  ],
  salary: [{ id: '2026-01', salary: 5000.25, bonus: 100.5 }],
  taxReliefs: [{ year: 2026, reliefKey: 'fixture-relief', amount: 100.25 }],
  trades: [
    {
      id: 'fixture-trade',
      date: '2026-01-01',
      broker: 'Fixture broker',
      ticker: 'ABC',
      action: 'buy',
      shares: 2,
      price: 50.25,
      fees: 1.25,
      isCdp: true,
      isPO: false,
    },
  ],
  dividends: [
    {
      id: 'fixture-dividend',
      ticker: 'ABC',
      date: '2026-01-03',
      amount: 12.34,
      currency: 'USD',
    },
  ],
  plannerSettings: {
    emergencyMonths: 3,
    warChestMonths: 6,
    titheEnabled: false,
    tithePct: 10,
    allowanceEnabled: true,
    allowancePct: 5,
  },
};
const DOMAINS = Object.keys(EMPTY) as Array<keyof ExportData>;
const download = vi.fn((_blob: Blob) => 'blob:fixture-export');
const revoke = vi.fn();
function seed(data: ExportData) {
  for (const domain of DOMAINS) state[domain].mockResolvedValue(data[domain]);
}
function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  seed(EMPTY);
  download.mockReturnValue('blob:fixture-export');
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: download,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revoke,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  ['empty', EMPTY],
  ['all eight nonempty domains', NONEMPTY],
])(
  'downloads versioned %s export without changing values',
  async (_label, data) => {
    seed(data);
    const view = renderHook(() => useExportData());
    await act(async () => {
      await view.result.current.exportData();
    });
    const parsed: unknown = JSON.parse(
      await readBlob(download.mock.calls[0][0])
    );
    expect(parsed).toEqual({
      version: 2,
      app: 'fynfo',
      exportedAt: expect.any(String),
      data,
    });
    for (const domain of DOMAINS) expect(state[domain]).toHaveBeenCalledOnce();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:fixture-export');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(state.success).toHaveBeenCalledWith('Data exported');
    expect(state.error).not.toHaveBeenCalled();
    expect(view.result.current.isExporting).toBe(false);
  }
);

it('omits internal snapshot identity and lossless revision from the export', async () => {
  seed(NONEMPTY);
  const versioned: SnapshotRecord = {
    ...NONEMPTY.snapshots[0],
    snapshotId: 'fixture-parent',
    revision: '9007199254740993',
  };
  state.snapshots.mockResolvedValue([versioned]);
  const view = renderHook(() => useExportData());
  await act(async () => {
    await view.result.current.exportData();
  });
  const parsed: unknown = JSON.parse(await readBlob(download.mock.calls[0][0]));
  expect(parsed).toEqual({
    version: 2,
    app: 'fynfo',
    exportedAt: expect.any(String),
    data: NONEMPTY,
  });
});

it.each(DOMAINS)(
  'rejects failed %s read without a partial download or private error',
  async (domain) => {
    seed(NONEMPTY);
    state[domain].mockRejectedValueOnce(new Error('private upstream detail'));
    const view = renderHook(() => useExportData());
    await act(async () => {
      await view.result.current.exportData();
    });
    expect(download).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith(
      'Export failed. Make sure your vault is unlocked.'
    );
    expect(view.result.current.isExporting).toBe(false);
    await act(async () => {
      await view.result.current.exportData();
    });
    expect(download).toHaveBeenCalledOnce();
  }
);

it.each(['resolved', 'rejected'])(
  'suppresses late %s completion after vault unmount',
  async (kind) => {
    let finish: () => void = () => {};
    state.profile.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = () =>
            kind === 'resolved'
              ? resolve(null)
              : reject(new Error('private pending detail'));
        })
    );
    const view = renderHook(() => useExportData());
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = view.result.current.exportData();
    });
    view.unmount();
    await act(async () => {
      finish();
      await pending;
    });
    expect(download).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.error).not.toHaveBeenCalled();
  }
);

it('prevents same-tick overlapping exports while reads are pending', async () => {
  let finish: (value: null) => void = () => {};
  state.profile.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const view = renderHook(() => useExportData());
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = view.result.current.exportData();
    void view.result.current.exportData();
  });
  expect(state.profile).toHaveBeenCalledOnce();
  await act(async () => {
    finish(null);
    await pending;
  });
  expect(download).toHaveBeenCalledOnce();
  expect(view.result.current.isExporting).toBe(false);
});

it('releases temporary download resources after click failure and permits retry', async () => {
  vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
    throw new Error('private browser detail');
  });
  const view = renderHook(() => useExportData());
  await act(async () => {
    await view.result.current.exportData();
  });
  expect(revoke).toHaveBeenCalledWith('blob:fixture-export');
  expect(document.querySelector('a[download]')).toBeNull();
  expect(state.success).not.toHaveBeenCalled();
  expect(state.error).toHaveBeenCalledWith(
    'Export failed. Make sure your vault is unlocked.'
  );
  expect(view.result.current.isExporting).toBe(false);
  await act(async () => {
    await view.result.current.exportData();
  });
  expect(state.success).toHaveBeenCalledOnce();
});

it('explains material export limitations beside the existing action', () => {
  render(<ExportDataCard />);
  expect(screen.getByText(/file contains plaintext/)).toBeVisible();
  expect(screen.getByText(/cannot be restored in Fynfo/)).toBeVisible();
  expect(screen.getByText(/Edits made during export/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Export my data' })).toBeEnabled();
});
