'use client';

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
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}
