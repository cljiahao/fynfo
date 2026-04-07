'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { ProfileData } from '../types';

export async function getProfile(): Promise<ProfileData | null> {
  const userId = await requireUserId();

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  return {
    birthYear: profile.birthYear,
    isNsman: profile.isNsman,
    residencyStatus: profile.residencyStatus as ProfileData['residencyStatus'],
  };
}

export async function upsertProfile(data: ProfileData): Promise<void> {
  const userId = await requireUserId();

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      birthYear: data.birthYear,
      isNsman: data.isNsman,
      residencyStatus: data.residencyStatus,
    },
    update: {
      birthYear: data.birthYear,
      isNsman: data.isNsman,
      residencyStatus: data.residencyStatus,
    },
  });
}
