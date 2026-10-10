// @vitest-environment jsdom
import { getScenarios } from '@/features/assets/actions/scenario-actions';
import {
  deleteSnapshot,
  getSnapshot,
} from '@/features/assets/actions/snapshot-actions';
import { useChartData } from '@/features/assets/hooks/use-chart-data';
import {
  scenarioPayloadSchema,
  snapshotFormSchema,
} from '@/features/assets/schemas';
import type { ScenarioRecord, SnapshotData } from '@/features/assets/types';
import {
  buildExportEnvelope,
  serializeExport,
} from '@/features/profile/lib/export-data';
import {
  deleteSalaryRecord,
  getSalaryRecord,
} from '@/features/salary/actions/salary-actions';
import { SalaryChart } from '@/features/salary/components/salary-chart';
import { salaryDataSchema } from '@/features/salary/schemas';
import { formatRecordedMonth } from '@/lib/utils/month';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../helpers/fake-supabase';

const boundary = vi.hoisted(() => ({
  context: vi.fn(),
  decrypt: vi.fn((v: string) => v),
}));
vi.mock('@/lib/action-guard', () => ({
  requireActionContext: boundary.context,
}));
vi.mock('@/lib/crypto', () => ({
  encryptPayload: vi.fn(),
  decryptPayload: boundary.decrypt,
}));
vi.mock('@/lib/recharts', () => ({
  CHART_AXIS_TICK_PROPS: {},
  CHART_TOOLTIP_PROPS: {},
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  LineChart: ({ data }: { data: unknown }) => (
    <pre data-testid="salary-data">{JSON.stringify(data)}</pre>
  ),
  Line: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const records = [
  { id: '0000-01', salary: 100, bonus: 20 },
  { id: '2026-02', salary: 200, bonus: 30 },
];
const snapshots: SnapshotData[] = records.map((r) => ({
  id: r.id,
  entries: [{ category: 'savings', account: 'Synthetic', amount: r.salary }],
}));

describe('legacy month chart data', () => {
  it('retains invalid asset IDs and amounts without crashing or mutating inputs', () => {
    const original = structuredClone(snapshots);
    const { result } = renderHook(() => useChartData(snapshots));
    expect(
      result.current.map((p) => ({ month: p.month, id: p.id, total: p.total }))
    ).toEqual([
      { month: '0000-01 (invalid month)', id: '0000-01', total: 100 },
      { month: 'Feb 2026', id: '2026-02', total: 200 },
    ]);
    expect(snapshots).toEqual(original);
  });
  it('passes qualified salary labels with every amount and cumulative value', () => {
    const original = structuredClone(records);
    render(<SalaryChart records={records} />);
    expect(
      JSON.parse(screen.getByTestId('salary-data').textContent ?? 'null')
    ).toEqual([
      {
        month: '0000-01 (invalid month)',
        salary: 100,
        bonus: 20,
        cumulative: 120,
      },
      { month: 'Feb 2026', salary: 200, bonus: 30, cumulative: 350 },
    ]);
    expect(records).toEqual(original);
  });
  it.each(['bad', '2026-13', '2026-00', '2026-1', '0000-12'])(
    'qualifies malformed synthetic history %s',
    (id) => {
      const { result } = renderHook(() =>
        useChartData([{ ...snapshots[0], id }])
      );
      expect(result.current[0]).toMatchObject({
        id,
        month: `${id} (invalid month)`,
        total: 100,
      });
      render(<SalaryChart records={[{ ...records[0], id }]} />);
      expect(screen.getByTestId('salary-data').textContent).toContain(
        `${id} (invalid month)`
      );
    }
  );
  it('retains existing asset view limit and empty states', () => {
    const { result } = renderHook(() => useChartData(snapshots, 1));
    expect(result.current.map((p) => p.id)).toEqual(['2026-02']);
    const { result: empty } = renderHook(() => useChartData(undefined));
    expect(empty.current).toEqual([]);
    render(<SalaryChart records={[]} />);
    expect(screen.getByText('No salary records yet')).toBeTruthy();
  });
});

it('preserves legacy schemas and version3 export keys including scenario source metadata', async () => {
  expect(snapshotFormSchema.safeParse(snapshots[0]).success).toBe(true);
  expect(salaryDataSchema.safeParse(records[0]).success).toBe(true);
  const payload = scenarioPayloadSchema.parse({
    schemaVersion: 1,
    name: 'Synthetic',
    model: 'allocation-flat-cpf-v1',
    currency: 'SGD',
    capturedAt: '2026-10-10T00:00:00Z',
    sourceSnapshotMonth: '0000-01',
    inputs: {
      salary: 100,
      expenses: 10,
      emergencyMonths: 1,
      warChestMonths: 1,
      titheEnabled: false,
      tithePctInput: 0,
      allowanceEnabled: false,
      allowancePctInput: 0,
      currentSavings: 0,
      currentBonds: 0,
    },
  });
  const scenario: ScenarioRecord = {
    id: 'synthetic',
    creationRequestId: 'synthetic-request',
    revision: '1',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
    payload,
  };
  const scenarioFake = makeFakeSupabase({
    rpcData: {
      get_personal_planning_scenarios: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          creation_request_id: '10000000-0000-4000-8000-000000000002',
          payload: JSON.stringify(payload),
          revision: '1',
          created_at: scenario.createdAt,
          updated_at: scenario.updatedAt,
        },
      ],
    },
  });
  boundary.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: Buffer.alloc(32, 1),
    supabase: scenarioFake.client,
  });
  const decryptedRecords = await getScenarios();
  expect(decryptedRecords[0].payload.sourceSnapshotMonth).toBe('0000-01');
  const data = {
    profile: null,
    snapshots,
    expenses: [],
    salary: records,
    taxReliefs: [],
    trades: [],
    dividends: [],
    plannerSettings: null,
    scenarios: decryptedRecords,
  };
  const envelope = buildExportEnvelope(data, '2026-10-10T00:00:00Z');
  expect(envelope.version).toBe(3);
  expect(JSON.parse(serializeExport(envelope))).toMatchObject({
    data: {
      snapshots: [{ id: '0000-01' }, { id: '2026-02' }],
      salary: [{ id: '0000-01' }, { id: '2026-02' }],
      scenarios: [{ payload: { sourceSnapshotMonth: '0000-01' } }],
    },
  });
});

it('preserves raw legacy snapshot and salary read/delete targets with inert boundaries', async () => {
  const fake = makeFakeSupabase({
    rpcData: {
      get_asset_snapshot_for_edit: {
        id: '0000-01',
        snapshotId: 'synthetic-snapshot',
        revision: '1',
        entries: [],
      },
    },
    selectData: { month: '0000-01', salary: '100', bonus: '20' },
  });
  boundary.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: Buffer.alloc(32, 1),
    supabase: fake.client,
  });
  expect(await getSnapshot('0000-01')).toMatchObject({
    id: '0000-01',
    snapshotId: 'synthetic-snapshot',
    revision: '1',
  });
  expect(await getSalaryRecord('0000-01')).toEqual(records[0]);
  await deleteSnapshot('0000-01', {
    snapshotId: 'synthetic-snapshot',
    revision: '1',
  });
  await deleteSalaryRecord('0000-01');
  expect(fake.calls.rpc).toEqual([
    { name: 'get_asset_snapshot_for_edit', args: { p_month: '0000-01' } },
    {
      name: 'delete_asset_snapshot_if_current',
      args: {
        p_month: '0000-01',
        p_expected_revision: '1',
        p_expected_snapshot_id: 'synthetic-snapshot',
      },
    },
  ]);
  expect(
    fake.calls.queries.filter((q) => q.table === 'salary_records')
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        eq: [
          { column: 'user_id', value: 'synthetic-owner' },
          { column: 'month', value: '0000-01' },
        ],
      }),
    ])
  );
});

describe('recorded month formatter compatibility', () => {
  it.each([
    ['0001-01', 'Jan 0001'],
    ['0099-12', 'Dec 0099'],
    ['0100-01', 'Jan 0100'],
    ['0999-12', 'Dec 0999'],
    ['1000-01', 'Jan 1000'],
    ['9999-12', 'Dec 9999'],
  ])('retains positive historical label for %s', (id, label) => {
    expect(formatRecordedMonth(id)).toBe(label);
    const { result } = renderHook(() =>
      useChartData([{ ...snapshots[0], id }])
    );
    expect(result.current[0]).toMatchObject({ id, month: label, total: 100 });
    render(<SalaryChart records={[{ ...records[0], id }]} />);
    expect(screen.getByTestId('salary-data').textContent).toContain(label);
  });
  it.each([
    '0000-01',
    '0000-12',
    '2026-13',
    '2026-00',
    '2026-1',
    'bad',
    '10000-01',
    '-001-01',
    '2026-01x',
  ])('qualifies unsupported key %s verbatim', (id) => {
    expect(formatRecordedMonth(id)).toBe(`${id} (invalid month)`);
  });
});
