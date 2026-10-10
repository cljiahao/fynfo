'use client';

import { useOverviewReadTransport } from '@/lib/overview-read-context';
import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSnapshot,
  getSnapshot,
  getSnapshots,
  upsertSnapshot,
} from '../actions/snapshot-actions';
import { SNAPSHOTS_KEY } from '../constants';
import type { SnapshotData, SnapshotVersion } from '../types';

export { SNAPSHOTS_KEY } from '../constants';

export function useSnapshots() {
  const transport = useOverviewReadTransport();
  return useQuery({
    queryKey: SNAPSHOTS_KEY,
    queryFn: transport
      ? ({ signal }) => transport.read('snapshots', signal)
      : () => getSnapshots(),
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
      if (result.ok)
        void refreshQueriesAfterMutation(queryClient, SNAPSHOTS_KEY);
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
      if (result.ok)
        void refreshQueriesAfterMutation(queryClient, SNAPSHOTS_KEY);
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
