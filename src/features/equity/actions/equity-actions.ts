'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { EquityTradeData } from '../types';

export async function getTrades(): Promise<EquityTradeData[]> {
  const userId = await requireUserId();

  const trades = await prisma.equityTrade.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  return trades.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    broker: t.broker,
    ticker: t.ticker,
    action: t.action as EquityTradeData['action'],
    shares: Number(t.shares),
    price: Number(t.price),
    fees: Number(t.fees),
  }));
}

export async function createTrade(
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  const userId = await requireUserId();

  await prisma.equityTrade.create({
    data: {
      userId,
      date: new Date(data.date),
      broker: data.broker,
      ticker: data.ticker.toUpperCase(),
      action: data.action,
      shares: data.shares,
      price: data.price,
      fees: data.fees,
    },
  });
}

export async function updateTrade(
  id: string,
  data: Omit<EquityTradeData, 'id'>
): Promise<void> {
  const userId = await requireUserId();

  await prisma.equityTrade.update({
    where: { id, userId },
    data: {
      date: new Date(data.date),
      broker: data.broker,
      ticker: data.ticker.toUpperCase(),
      action: data.action,
      shares: data.shares,
      price: data.price,
      fees: data.fees,
    },
  });
}

export async function deleteTrade(id: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.equityTrade.delete({
    where: { id, userId },
  });
}
