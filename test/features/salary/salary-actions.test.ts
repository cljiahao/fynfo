import type { SalaryData } from '@/features/salary/types';
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

const validSalary: SalaryData = { id: '2026-03', salary: 5000, bonus: 1000 };

beforeEach(() => {
  setSupabase();
});

describe('salary-actions — getSalaryRecords', () => {
  it('decrypts salary and bonus', async () => {
    setSupabase({
      selectData: [
        {
          month: '2026-03',
          salary: await encryptPayload('5000', DEK),
          bonus: await encryptPayload('1000', DEK),
        },
      ],
    });
    const { getSalaryRecords } =
      await import('@/features/salary/actions/salary-actions');
    expect(await getSalaryRecords()).toEqual([
      { id: '2026-03', salary: 5000, bonus: 1000 },
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
      'salary record read failed'
    );
  });
  it('returns null when the record is absent', async () => {
    setSupabase({ selectData: null });
    const { getSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    expect(await getSalaryRecord('2026-03')).toBeNull();
  });

  it('decrypts the record on success', async () => {
    setSupabase({
      selectData: {
        month: '2026-03',
        salary: await encryptPayload('5000', DEK),
        bonus: await encryptPayload('1000', DEK),
      },
    });
    const { getSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    expect(await getSalaryRecord('2026-03')).toEqual(validSalary);
  });
});

describe('salary-actions — upsertSalaryRecord', () => {
  it('encrypts salary and bonus and sets the month', async () => {
    const fake = setSupabase();
    const { upsertSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await upsertSalaryRecord(validSalary);

    const row = fake.calls.upsert[0] as {
      month: string;
      salary: string;
      bonus: string;
    };
    expect(row.month).toBe('2026-03');
    expect(row.salary).not.toBe('5000');
    expect(await decryptPayload(row.salary, DEK)).toBe('5000');
    expect(await decryptPayload(row.bonus, DEK)).toBe('1000');
  });

  it('rejects invalid input before any DB call', async () => {
    const fake = setSupabase();
    const { upsertSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await expect(
      upsertSalaryRecord({ ...validSalary, salary: -1 })
    ).rejects.toThrow();
    expect(fake.calls.from).toHaveLength(0);
  });
});

describe('salary-actions — deleteSalaryRecord', () => {
  it('issues a delete and surfaces an opaque error on failure', async () => {
    setSupabase({ selectError: { message: 'fk violation on salary_records' } });
    const { deleteSalaryRecord } =
      await import('@/features/salary/actions/salary-actions');
    await expect(deleteSalaryRecord('2026-03')).rejects.toThrow(
      'salary write failed'
    );
  });
});
