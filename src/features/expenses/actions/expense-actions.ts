'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { ExpenseData } from '../types';

export async function getExpenses(): Promise<ExpenseData[]> {
  const userId = await requireUserId();

  const records = await prisma.expenseRecord.findMany({
    where: { userId },
    include: { splits: true },
    orderBy: { date: 'desc' },
  });

  return records.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    type: r.type as ExpenseData['type'],
    item: r.item,
    info: r.info,
    amount: Number(r.amount),
    splitType: r.splitType as 'self' | 'shared',
    splits: r.splits.map((s) => ({
      person: s.person,
      amount: Number(s.amount),
      settled: s.settled,
    })),
  }));
}

export async function upsertExpense(
  data: ExpenseData
): Promise<void> {
  const userId = await requireUserId();

  await prisma.$transaction(async (tx) => {
    // Upsert the expense record
    await tx.expenseRecord.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        userId,
        date: new Date(data.date),
        type: data.type,
        item: data.item,
        info: data.info,
        amount: data.amount,
        splitType: data.splitType,
      },
      update: {
        date: new Date(data.date),
        type: data.type,
        item: data.item,
        info: data.info,
        amount: data.amount,
        splitType: data.splitType,
      },
    });

    // Replace splits
    await tx.expenseSplit.deleteMany({ where: { expenseId: data.id } });

    if (data.splitType === 'shared' && data.splits.length > 0) {
      await tx.expenseSplit.createMany({
        data: data.splits.map((s) => ({
          expenseId: data.id,
          person: s.person,
          amount: s.amount,
          settled: s.settled,
        })),
      });
    }
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.expenseRecord.delete({
    where: { id, userId },
  });
}

export async function settleSplit(
  expenseId: string,
  person: string,
  settled: boolean
): Promise<void> {
  const userId = await requireUserId();

  // Verify ownership
  const expense = await prisma.expenseRecord.findFirst({
    where: { id: expenseId, userId },
  });
  if (!expense) throw new Error('Expense not found');

  await prisma.expenseSplit.updateMany({
    where: { expenseId, person },
    data: { settled },
  });
}

export async function settleMonthSplits(
  expenseIds: string[],
  person: string,
  settled: boolean
): Promise<void> {
  const userId = await requireUserId();

  // Verify ownership of all expense IDs
  const count = await prisma.expenseRecord.count({
    where: { id: { in: expenseIds }, userId },
  });
  if (count !== expenseIds.length) throw new Error('Expense not found');

  await prisma.expenseSplit.updateMany({
    where: { expenseId: { in: expenseIds }, person },
    data: { settled },
  });
}

export async function getDistinctPeople(): Promise<string[]> {
  const userId = await requireUserId();

  const results = await prisma.expenseSplit.findMany({
    where: { expense: { userId } },
    select: { person: true },
    distinct: ['person'],
    orderBy: { person: 'asc' },
  });

  return results.map((r) => r.person);
}
