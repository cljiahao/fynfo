'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { SalaryData } from '../types';

export async function getSalaryRecords(): Promise<SalaryData[]> {
  const userId = await requireUserId();

  const records = await prisma.salaryRecord.findMany({
    where: { userId },
    orderBy: { month: 'asc' },
  });

  return records.map((r) => ({
    id: r.month,
    salary: Number(r.salary),
    bonus: Number(r.bonus),
  }));
}

export async function getSalaryRecord(id: string): Promise<SalaryData | null> {
  const userId = await requireUserId();

  const record = await prisma.salaryRecord.findUnique({
    where: { userId_month: { userId, month: id } },
  });

  if (!record) return null;

  return {
    id: record.month,
    salary: Number(record.salary),
    bonus: Number(record.bonus),
  };
}

export async function upsertSalaryRecord(data: SalaryData): Promise<void> {
  const userId = await requireUserId();

  await prisma.salaryRecord.upsert({
    where: { userId_month: { userId, month: data.id } },
    create: {
      month: data.id,
      userId,
      salary: data.salary,
      bonus: data.bonus,
    },
    update: {
      salary: data.salary,
      bonus: data.bonus,
    },
  });
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.salaryRecord.delete({
    where: { userId_month: { userId, month: id } },
  });
}
