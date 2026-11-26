'use client';

import { useMemo } from 'react';
import { buildMemberLabels, type MemberLabels } from '../member-labels';
import { useHousehold } from './use-household';

export function useMemberLabels(): MemberLabels {
  const { data } = useHousehold();
  const memberIds = data?.memberIds;
  const userId = data?.userId;
  const memberNames = data?.memberNames;
  return useMemo(
    () => buildMemberLabels(memberIds ?? [], userId, memberNames),
    [memberIds, userId, memberNames]
  );
}
