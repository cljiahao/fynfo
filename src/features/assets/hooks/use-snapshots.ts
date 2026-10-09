'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSnapshot,
  getSnapshot,
  getSnapshots,
  upsertSnapshot,
} from '../actions/snapshot-actions';
import type { SnapshotData, SnapshotVersion } from '../types';

export const SNAPSHOTS_KEY = ['snapshots'] as const;

export function useSnapshots() {
  return useQuery({
    queryKey: SNAPSHOTS_KEY,
    queryFn: () => getSnapshots(),
  });
}

export function useSnapshot(id: string) {
  return useQuery({
    queryKey: [...SNAPSHOTS_KEY, id],
    queryFn: () => getSnapshot(id),
    enabled: !!id,
  });
}

export function useUpsertSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      originalId,
      expectedVersion,
    }: {
      data: SnapshotData;
      originalId?: string;
      expectedVersion?: SnapshotVersion;
    }) => upsertSnapshot(data, originalId, expectedVersion),
    retry: false,
    onSuccess: (result) => {
      if (result.ok) queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
    },
  });
}

export function useDeleteSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: string;
      expectedVersion: SnapshotVersion;
    }) => deleteSnapshot(id, expectedVersion),
    retry: false,
    onSuccess: (result) => {
      if (result.ok) queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
    },
  });
}

export function useReviewSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await queryClient.cancelQueries({ queryKey: SNAPSHOTS_KEY, exact: true });
      return queryClient.fetchQuery({
        queryKey: SNAPSHOTS_KEY,
        queryFn: () => getSnapshots(),
        staleTime: 0,
        retry: false,
      });
    },
    retry: false,
  });
}
