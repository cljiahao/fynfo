import type { SalaryMonth } from '@/features/salary/types';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 4);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: DEK, supabase }),
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

const enc = (value: string | number) => encryptPayload(String(value), DEK);

async function lineRow(
  month: string,
  type: string,
  label: string,
  amount: number,
  position: number
) {
  return {
    id: `${month}-${position}`,
    month,
    type,
    label: await enc(label),
    amount: await enc(amount),
    position,
  };
}

const validMonth: SalaryMonth = {
  id: '2026-03',
  lines: [
    { id: 'a', type: 'salary', label: ' Acme ', amount: 5000 },
    { id: 'b', type: 'salary', label: 'Beta', amount: 1000 },
    { id: 'c', type: 'bonus', label: 'Bonus', amount: 2000 },
    { id: 'd', type: 'one_time', label: 'AWS', amount: 300 },
  ],
};

beforeEach(() => {
  setSupabase();
});

describe('salary-actions — getSalaryRecords', () => {
  it('groups lines by month in position order with aggregates', async () => {
    setSupabase({
      selectDataByTable: {
        salary_income_lines: [
          await lineRow('2026-03', 'bonus', 'Bonus', 2000, 1),
          await lineRow('2026-03', 'salary', 'Acme', 5000, 0),
        ],
        salary_records: [],
      },
    });
    const { getSalaryRecords } =
      await import('@/features/salary/actions/salary-actions');
    const [month] = await getSalaryRecords();
    expect(month.lines.map((l) => l.label)).toEqual(['Acme', 'Bonus']);
    expect(month).toMatchObject({
      id: '2026-03',
      salary: 5000,
      bonus: 2000,
      recurring: 5000,
      oneTime: 0,
      total: 7000,
    });
  });

  it('synthesizes a legacy-only month and lets lines win elsewhere', async () => {
    setSupabase({
      selectDataByTable: {
        salary_income_lines: [
          await lineRow('2026-04', 'salary', 'Acme', 7000, 0),
        ],
        salary_records: [
          {
            month: '2026-03',
            salary: await enc(5000),
            bonus: await enc(1000),
          },
          { month: '2026-04', salary: await enc(1), bonus: await enc(1) },
        ],
      },
    });
    const { getSalaryRecords } =
      await import('@/features/salary/actions/salary-actions');
    const months = await getSalaryRecords();
    expect(months.map((m) => [m.id, m.salary, m.bonus])).toEqual([
      ['2026-03', 5000, 1000],
      ['2026-04', 7000, 0],
    ]);
  });
});

describe('salary-actions — getSalaryRecord', () => {
  it('throws an opaque error on a failed single-record read', async () => {
    setSupabase({
      selectError: { message: 'permission denied for salary_records' },
    });
    const { getSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await expect(getSalaryRecord('2026-03')).rejects.toThrow(
      'salary lines read failed'
    );
  });

  it('returns null when the month has neither lines nor a legacy row', async () => {
    setSupabase({
      selectDataByTable: { salary_income_lines: [], salary_records: null },
    });
    const { getSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    expect(await getSalaryRecord('2026-03')).toBeNull();
  });

  it('synthesizes from the legacy row when there are no lines', async () => {
    setSupabase({
      selectDataByTable: {
        salary_income_lines: [],
        salary_records: {
          month: '2026-03',
          salary: await enc(5000),
          bonus: await enc(1000),
        },
      },
    });
    const { getSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    const month = await getSalaryRecord('2026-03');
    expect(month).toMatchObject({ salary: 5000, bonus: 1000, total: 6000 });
    expect(month?.lines.map((l) => l.label)).toEqual(['Salary', 'Bonus']);
  });
});

describe('salary-actions — upsertSalaryRecord', () => {
  it('encrypts lines and dual-writes legacy sums through the rpc', async () => {
    const fake = setSupabase();
    const { upsertSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await upsertSalaryRecord(validMonth);

    const [call] = fake.calls.rpc;
    expect(call.name).toBe('replace_salary_month');
    const args = call.args as {
      p_month: string;
      p_lines: {
        type: string;
        label: string;
        amount: string;
        position: number;
      }[];
      p_salary: string;
      p_bonus: string;
    };
    expect(args.p_month).toBe('2026-03');
    expect(decryptPayload(args.p_salary, DEK)).toBe('6000');
    expect(decryptPayload(args.p_bonus, DEK)).toBe('2000');
    expect(args.p_lines.map((l) => l.position)).toEqual([0, 1, 2, 3]);
    expect(decryptPayload(args.p_lines[0].label, DEK)).toBe('Acme');
    expect(args.p_lines[0].label).not.toBe('Acme');
    expect(decryptPayload(args.p_lines[3].amount, DEK)).toBe('300');
  });

  it('writes zero legacy values for a month with only one-time lines', async () => {
    const fake = setSupabase();
    const { upsertSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await upsertSalaryRecord({
      id: '2026-03',
      lines: [{ id: 'x', type: 'one_time', label: 'AWS', amount: 300 }],
    });
    const args = fake.calls.rpc[0].args as {
      p_salary: string;
      p_bonus: string;
    };
    expect(decryptPayload(args.p_salary, DEK)).toBe('0');
    expect(decryptPayload(args.p_bonus, DEK)).toBe('0');
  });

  it('rejects invalid input before any DB call', async () => {
    const fake = setSupabase();
    const { upsertSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await expect(
      upsertSalaryRecord({ ...validMonth, lines: [] })
    ).rejects.toThrow();
    await expect(
      upsertSalaryRecord({
        id: '2026-03',
        lines: [
          { id: 'a', type: 'salary', label: 'Acme', amount: 1 },
          { id: 'b', type: 'salary', label: 'acme', amount: 2 },
        ],
      })
    ).rejects.toThrow();
    expect(fake.calls.rpc).toHaveLength(0);
  });

  it('surfaces an opaque error when the rpc fails', async () => {
    setSupabase({
      rpcError: {
        replace_salary_month: { message: 'constraint salary_income_lines_x' },
      },
    });
    const { upsertSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await expect(upsertSalaryRecord(validMonth)).rejects.toThrow(
      'salary write failed'
    );
  });
});

describe('salary-actions — deleteSalaryRecord', () => {
  it('deletes the legacy row and the lines', async () => {
    const fake = setSupabase();
    const { deleteSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await deleteSalaryRecord('2026-03');
    expect(fake.calls.from).toEqual(['salary_records', 'salary_income_lines']);
    expect(fake.calls.delete).toBe(2);
  });

  it('surfaces an opaque error on failure', async () => {
    setSupabase({ selectError: { message: 'fk violation on salary_records' } });
    const { deleteSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await expect(deleteSalaryRecord('2026-03')).rejects.toThrow(
      'salary write failed'
    );
  });
});
