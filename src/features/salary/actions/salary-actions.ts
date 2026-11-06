'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { YYYY_MM } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import { mergeSalaryMonths, summarizeMonth } from '../lib/income-aggregates';
import { salaryMonthSchema } from '../schemas';
import type { IncomeLine, IncomeLineType, SalaryData } from '../types';

interface LineRow {
  id: string;
  month: string;
  type: IncomeLineType;
  label: string;
  amount: string;
  position: number;
}

interface LegacyRow {
  month: string;
  salary: string;
  bonus: string | null;
}

function decryptLine(
  row: LineRow,
  dek: Buffer
): IncomeLine & { month: string; position: number } {
  return {
    id: row.id,
    month: row.month,
    position: row.position,
    type: row.type,
    label: decryptOptionalString(row.label, dek),
    amount: decryptNumber(row.amount, dek),
  };
}

function toMonths(
  lineRows: LineRow[],
  legacyRows: LegacyRow[],
  dek: Buffer
): SalaryData[] {
  const lines = lineRows
    .map((row) => decryptLine(row, dek))
    .sort((a, b) => a.position - b.position);
  const legacy = legacyRows.map((row) => ({
    month: row.month,
    salary: decryptNumber(row.salary, dek),
    bonus: row.bonus ? decryptNumber(row.bonus, dek) : 0,
  }));
  return mergeSalaryMonths(lines, legacy);
}

export async function getSalaryRecords(): Promise<SalaryData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const [lineRows, legacyRows] = await Promise.all([
    readAllRows<LineRow>(
      (from, to) =>
        supabase
          .from('salary_income_lines')
          .select('id, month, type, label, amount, position', {
            count: 'exact',
          })
          .eq('user_id', userId)
          .order('month', { ascending: true })
          .order('position', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'salary lines read'
    ),
    readAllRows<LegacyRow>(
      (from, to) =>
        supabase
          .from('salary_records')
          .select('month, salary, bonus', { count: 'exact' })
          .eq('user_id', userId)
          .order('month', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'salary read'
    ),
  ]);

  return toMonths(lineRows, legacyRows, dek);
}

export async function getSalaryRecord(id: string): Promise<SalaryData | null> {
  parseOrThrow(YYYY_MM, id, 'salary.read.month');
  const { userId, dek, supabase } = await requireActionContext();

  const [lines, legacy] = await Promise.all([
    supabase
      .from('salary_income_lines')
      .select('id, month, type, label, amount, position')
      .eq('user_id', userId)
      .eq('month', id)
      .order('position', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('salary_records')
      .select('month, salary, bonus')
      .eq('user_id', userId)
      .eq('month', id)
      .maybeSingle(),
  ]);

  throwIfSupabaseError(lines.error, 'salary lines read');
  throwIfSupabaseError(legacy.error, 'salary record read');

  const months = toMonths(
    (lines.data ?? []) as LineRow[],
    legacy.data ? [legacy.data as LegacyRow] : [],
    dek
  );
  return months[0] ?? null;
}

export async function upsertSalaryRecord(input: unknown): Promise<void> {
  const month = parseOrThrow(salaryMonthSchema, input, 'salary.upsert.input');
  const { dek, supabase } = await requireActionContext();

  const summary = summarizeMonth(month.lines);
  const encSalary = encryptPayload(summary.recurring.toString(), dek);
  const encBonus = encryptPayload(summary.bonus.toString(), dek);
  const lines = month.lines.map((line, position) => ({
    id: randomUUID(),
    type: line.type,
    label: encryptPayload(line.label, dek),
    amount: encryptPayload(line.amount.toString(), dek),
    position,
  }));

  const { error } = await supabase.rpc('replace_salary_month', {
    p_month: month.id,
    p_lines: lines,
    p_salary: encSalary,
    p_bonus: encBonus,
  });

  throwIfSupabaseError(error, 'salary write');
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  parseOrThrow(YYYY_MM, id, 'salary.delete.month');
  const { userId, supabase } = await requireActionContext();

  // The legacy row goes first: if the second delete fails, remaining lines
  // still win on read, whereas the reverse order would resurrect the legacy row.
  const legacy = await supabase
    .from('salary_records')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);
  throwIfSupabaseError(legacy.error, 'salary write');

  const lines = await supabase
    .from('salary_income_lines')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);
  throwIfSupabaseError(lines.error, 'salary write');
}
