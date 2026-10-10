'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, upsertProfile } from '../actions/profile-actions';
import type { ProfileData } from '../types';

const PROFILE_KEY = ['profile'] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => getProfile(),
  });
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileData) => upsertProfile(data),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, PROFILE_KEY);
    },
  });
}
