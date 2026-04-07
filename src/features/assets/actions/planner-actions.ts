'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { PlannerSettingsData } from '../types';

export async function getPlannerSettings(): Promise<PlannerSettingsData | null> {
  const userId = await requireUserId();

  const settings = await prisma.plannerSettings.findUnique({
    where: { userId },
  });

  if (!settings) return null;

  return {
    emergencyMonths: settings.emergencyMonths,
    warChestMonths: settings.warChestMonths,
    titheEnabled: settings.titheEnabled,
    tithePct: settings.tithePct,
    allowanceEnabled: settings.allowanceEnabled,
    allowancePct: settings.allowancePct,
  };
}

export async function upsertPlannerSettings(
  data: PlannerSettingsData
): Promise<void> {
  const userId = await requireUserId();

  await prisma.plannerSettings.upsert({
    where: { userId },
    create: {
      userId,
      emergencyMonths: data.emergencyMonths,
      warChestMonths: data.warChestMonths,
      titheEnabled: data.titheEnabled,
      tithePct: data.tithePct,
      allowanceEnabled: data.allowanceEnabled,
      allowancePct: data.allowancePct,
    },
    update: {
      emergencyMonths: data.emergencyMonths,
      warChestMonths: data.warChestMonths,
      titheEnabled: data.titheEnabled,
      tithePct: data.tithePct,
      allowanceEnabled: data.allowanceEnabled,
      allowancePct: data.allowancePct,
    },
  });
}
