'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSnapshot,
  getSnapshot,
  getSnapshots,
  upsertSnapshot,
} from '../actions/snapshot-actions';
import type { SnapshotData } from '../types';

const SNAPSHOTS_KEY = ['snapshots'] as const;

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
    mutationFn: (data: SnapshotData) => upsertSnapshot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
    },
  });
}

export function useDeleteSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSnapshot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
    },
  });
}
