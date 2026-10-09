'use client';

import { PAGE_ROUTES } from '@/lib/constants/routes';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { getSnapshot } from '../actions/snapshot-actions';
import { CATEGORIES } from '../constants';
import { snapshotFormSchema, type SnapshotFormValues } from '../schemas';
import type { SnapshotData, SnapshotRecord, SnapshotVersion } from '../types';
import {
  SNAPSHOTS_KEY,
  useSnapshot,
  useSnapshots,
  useUpsertSnapshot,
} from './use-snapshots';

type SaveIssue = {
  context: string;
  month: string;
  kind: 'conflict' | 'uncertain' | 'missing' | 'read-failed';
};
type Baseline = SnapshotVersion & { id: string };

function initialValues(
  month: string,
  snapshot?: SnapshotData,
  editing = false
): SnapshotFormValues {
  const blank = '' as unknown as number;
  const entries = (snapshot?.entries ?? []).map(
    ({ category, account, amount }) => ({
      category,
      account,
      amount: editing ? amount : blank,
    })
  );
  for (const category of CATEGORIES) {
    if (!entries.some((entry) => entry.category === category))
      entries.push({ category, account: '', amount: blank });
  }
  return { id: month, entries };
}

export function useSnapshotEditor(editId?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const snapshot = useSnapshot(editId ?? '');
  const history = useSnapshots();
  const upsert = useUpsertSnapshot();
  const context = editId ?? 'new';
  const activeContext = useRef<string | null>(context);
  const defaultMonth = format(new Date(), 'yyyy-MM');
  const initializedFor = useRef<string | null>(null);
  const baseline = useRef<Baseline | null>(null);
  const saveLock = useRef(false);
  const [issue, setIssue] = useState<SaveIssue | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const activeIssue = issue?.context === context ? issue : null;
  const form = useForm<SnapshotFormValues>({
    resolver: zodResolver(snapshotFormSchema),
    defaultValues: initialValues(editId ?? defaultMonth),
  });
  const { isDirty, isSubmitting } = form.formState;
  const rows = useFieldArray({ control: form.control, name: 'entries' });
  const selectedMonth = useWatch({ control: form.control, name: 'id' });
  const currentEntries = useWatch({ control: form.control, name: 'entries' });

  useEffect(() => {
    activeContext.current = context;
    return () => {
      activeContext.current = null;
    };
  }, [context]);

  // Capture identity/version with the values; dirty or unresolved drafts keep that baseline.
  useEffect(() => {
    if ((editId && !snapshot.data) || (!editId && !history.data)) return;
    if (
      initializedFor.current === context &&
      (isDirty || isSubmitting || activeIssue)
    )
      return;
    const record = editId ? snapshot.data : history.data?.at(-1);
    initializedFor.current = context;
    baseline.current =
      editId && snapshot.data
        ? {
            id: snapshot.data.id,
            snapshotId: snapshot.data.snapshotId,
            revision: snapshot.data.revision,
          }
        : null;
    form.reset(
      initialValues(editId ?? defaultMonth, record ?? undefined, !!editId)
    );
  }, [
    editId,
    snapshot.data,
    history.data,
    context,
    isDirty,
    isSubmitting,
    activeIssue,
    defaultMonth,
    form,
  ]);

  async function submit(values: SnapshotFormValues) {
    if (saveLock.current || activeIssue) return;
    if (
      history.data?.some(
        (record) => record.id === values.id && record.id !== editId
      )
    ) {
      toast.error('A snapshot for this month already exists.');
      return;
    }
    if (editId && (!baseline.current || baseline.current.id !== editId)) {
      setIssue({ context, month: editId, kind: 'read-failed' });
      return;
    }
    saveLock.current = true;
    try {
      const result = await upsert.mutateAsync({
        data: {
          id: values.id,
          entries: values.entries
            .filter((entry) => entry.amount > 0 || entry.account.trim() !== '')
            .map((entry) => ({
              ...entry,
              account: entry.account.trim() || entry.category,
            })),
        },
        originalId: editId,
        expectedVersion: baseline.current
          ? {
              snapshotId: baseline.current.snapshotId,
              revision: baseline.current.revision,
            }
          : undefined,
      });
      if (activeContext.current !== context) return;
      if (!result.ok) {
        setIssue({ context, month: editId ?? values.id, kind: 'conflict' });
        return;
      }
      toast.success(`Snapshot ${values.id} saved`);
      router.push(PAGE_ROUTES.ASSETS);
    } catch {
      if (activeContext.current !== context) return;
      setIssue({ context, month: values.id, kind: 'uncertain' });
      toast.error(
        'Save outcome is uncertain. Check the latest snapshot before saving again.'
      );
    } finally {
      saveLock.current = false;
    }
  }

  async function reviewLatest() {
    if (!activeIssue || isReviewing) return;
    setIsReviewing(true);
    const originalSnapshotId = baseline.current?.snapshotId;
    const read = async (month: string) => {
      const queryKey = [...SNAPSHOTS_KEY, month];
      await queryClient.cancelQueries({ queryKey, exact: true });
      return queryClient.fetchQuery({
        queryKey,
        queryFn: () => getSnapshot(month),
        staleTime: 0,
        retry: false,
      });
    };
    try {
      let latest: SnapshotRecord | null = await read(activeIssue.month);
      if (
        editId &&
        editId !== activeIssue.month &&
        (!latest || latest.snapshotId !== originalSnapshotId)
      )
        latest = await read(editId);
      await queryClient.invalidateQueries({
        queryKey: SNAPSHOTS_KEY,
        exact: true,
      });
      if (activeContext.current !== context) return;
      if (latest) {
        if (latest.id !== editId) {
          router.push(
            `${PAGE_ROUTES.ENTRY}?edit=${encodeURIComponent(latest.id)}`
          );
          return;
        }
        baseline.current = {
          id: latest.id,
          snapshotId: latest.snapshotId,
          revision: latest.revision,
        };
        form.reset(initialValues(latest.id, latest, true));
        setIssue(null);
      } else if (editId) {
        setIssue({ ...activeIssue, kind: 'missing' });
      } else {
        // A subsequent create still uses the unique insert if another writer wins this race.
        setIssue(null);
        toast.info(
          'No saved snapshot found. Your draft is ready to save again.'
        );
      }
    } catch {
      if (activeContext.current === context)
        setIssue({ ...activeIssue, kind: 'read-failed' });
    } finally {
      setIsReviewing(false);
    }
  }

  return {
    form,
    ...rows,
    selectedMonth,
    currentEntries,
    history,
    snapshot,
    submit,
    reviewLatest,
    issue: activeIssue,
    isReviewing,
    isSaving: isSubmitting || upsert.isPending,
    loading: (editId && snapshot.isLoading) || history.isLoading,
    loadError:
      (history.isError && !isDirty && !activeIssue) ||
      (editId &&
        !isDirty &&
        !activeIssue &&
        (snapshot.isError || !snapshot.data)),
    backgroundError:
      (history.isError && !!history.data) || (snapshot.isError && isDirty),
    retryLoads: () => {
      void history.refetch();
      if (editId) void snapshot.refetch();
    },
  };
}
