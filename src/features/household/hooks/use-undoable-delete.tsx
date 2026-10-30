'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { UNDO_DELAY_MS } from '../constants';

interface UndoRequest {
  id: string;
  label: string;
  commit: () => Promise<void>;
  errorMessage: string;
}

interface UndoableDeleteValue {
  pendingIds: ReadonlySet<string>;
  request: (request: UndoRequest) => void;
}

interface PendingEntry {
  timeout: ReturnType<typeof setTimeout>;
  toastId: string;
  commit: () => Promise<void>;
  errorMessage: string;
}

const UndoableDeleteContext = createContext<UndoableDeleteValue | null>(null);

/**
 * Owns every undo timer above the tab panels: Radix unmounts an inactive
 * panel, so a timer owned by a row would flush early on a tab switch.
 */
export function UndoableDeleteProvider({
  children,
  delayMs = UNDO_DELAY_MS,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [entries] = useState(() => new Map<string, PendingEntry>());
  const [inFlight] = useState(() => new Set<string>());
  const unmounting = useRef(false);

  const release = useCallback((id: string) => {
    if (unmounting.current) return;
    setPendingIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  // The row stays hidden until the commit settles so it cannot flash back
  // between the server write and the refetch.
  const settle = useCallback(
    (id: string, entry: PendingEntry) => {
      inFlight.add(id);
      entry
        .commit()
        .catch(() => {
          toast.error(entry.errorMessage);
        })
        .finally(() => {
          inFlight.delete(id);
          release(id);
        });
    },
    [inFlight, release]
  );

  const request = useCallback(
    ({ id, label, commit, errorMessage }: UndoRequest) => {
      if (entries.has(id) || inFlight.has(id)) return;
      const toastId = `undo-delete-${id}`;
      const timeout = setTimeout(() => {
        const entry = entries.get(id);
        if (!entry) return;
        entries.delete(id);
        // Sonner pauses its own timer on hover or a hidden tab, so the toast
        // can outlive this one; an Undo shown after the commit would lie.
        toast.dismiss(entry.toastId);
        settle(id, entry);
      }, delayMs);
      entries.set(id, { timeout, toastId, commit, errorMessage });
      setPendingIds((current) => new Set(current).add(id));
      toast(label, {
        id: toastId,
        duration: delayMs,
        action: {
          label: 'Undo',
          onClick: () => {
            const entry = entries.get(id);
            if (!entry) return;
            clearTimeout(entry.timeout);
            entries.delete(id);
            release(id);
          },
        },
      });
    },
    [delayMs, entries, inFlight, release, settle]
  );

  useEffect(() => {
    // Strict Mode re-runs effects; re-arm after its simulated unmount.
    unmounting.current = false;
    return () => {
      unmounting.current = true;
      entries.forEach((entry, id) => {
        clearTimeout(entry.timeout);
        toast.dismiss(entry.toastId);
        settle(id, entry);
      });
      entries.clear();
    };
  }, [entries, settle]);

  const value = useMemo(() => ({ pendingIds, request }), [pendingIds, request]);

  return (
    <UndoableDeleteContext.Provider value={value}>
      {children}
    </UndoableDeleteContext.Provider>
  );
}

export function useUndoableDelete(): UndoableDeleteValue {
  const value = useContext(UndoableDeleteContext);
  if (!value) {
    throw new Error('useUndoableDelete needs an UndoableDeleteProvider');
  }
  return value;
}
