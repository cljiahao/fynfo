'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { TaxReliefData } from '../types';

export async function getTaxReliefs(year: number): Promise<TaxReliefData[]> {
  const userId = await requireUserId();

  const entries = await prisma.taxReliefEntry.findMany({
    where: { userId, year },
  });

  return entries.map((e) => ({
    reliefKey: e.reliefKey,
    amount: Number(e.amount),
  }));
}

export async function upsertTaxReliefs(
  year: number,
  reliefs: TaxReliefData[]
): Promise<void> {
  const userId = await requireUserId();

  // Delete all existing reliefs for this year, then recreate
  await prisma.$transaction([
    prisma.taxReliefEntry.deleteMany({
      where: { userId, year },
    }),
    ...reliefs.map((r) =>
      prisma.taxReliefEntry.create({
        data: {
          userId,
          year,
          reliefKey: r.reliefKey,
          amount: r.amount,
        },
      })
    ),
  ]);
}
