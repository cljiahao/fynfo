'use client';

import {
  EXPENSE_KEY,
  getExpenses,
  IMPORT_SAVE_GROUP_SIZE,
  IMPORT_SAVE_LIMIT,
  IMPORT_SAVE_MAX_BYTES,
  insertImportedExpenses,
  type ImportedExpenseInput,
  type ImportExpenseOutcome,
} from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { QueryClientContext } from '@tanstack/react-query';
import { useContext, useEffect, useRef, useState } from 'react';
import { checkImportOutcome } from '../lib/import-outcomes';
import {
  createImportInput,
  hasSourceDuplicate,
  possibleImportDuplicates,
} from '../lib/import-selection';
import { withImportDeadline } from '../lib/request-deadline';
import type {
  StatementBank,
  StatementCandidate,
  StatementPeriod,
} from '../types';

type Attempt = {
  input: ImportedExpenseInput;
  status: ImportExpenseOutcome['status'] | 'not_started' | 'pending';
  reason?: ImportExpenseOutcome['reason'];
};

export function useStatementSave(
  rows: StatementCandidate[],
  bank: StatementBank,
  period: StatementPeriod
) {
  const privacy = useAmountVisibility();
  const { canReveal, hidden } = privacy;
  const client = useContext(QueryClientContext);
  const ids = useRef(new Map<string, string>());
  const alive = useRef(true);
  const operation = useRef(0);
  const running = useRef(false);
  const attemptsRef = useRef<Record<string, Attempt>>({});
  const deferredRefresh = useRef<{ query: object } | null>(null);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [checked, setChecked] = useState('');
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function updateAttempts(next: Record<string, Attempt>) {
    attemptsRef.current = next;
    setAttempts(next);
  }
  useEffect(() => {
    const currentOperation = operation;
    const refreshQueue = deferredRefresh;
    alive.current = true;
    return () => {
      alive.current = false;
      currentOperation.current++;
      refreshQueue.current = null;
    };
  }, []);
  useEffect(() => {
    const queryClient = client;
    if (!queryClient) return;
    const flushDeferredRefresh = () => {
      const pending = deferredRefresh.current;
      if (
        !pending ||
        !alive.current ||
        queryClient.isMutating() ||
        !canReveal()
      )
        return;
      deferredRefresh.current = null;
      if (
        queryClient
          .getQueryCache()
          .find({ queryKey: EXPENSE_KEY, exact: true }) !== pending.query
      )
        return;
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_KEY,
        refetchType: 'active',
      });
    };
    const unsubscribe = queryClient
      .getMutationCache()
      .subscribe(flushDeferredRefresh);
    flushDeferredRefresh();
    return unsubscribe;
  }, [client, canReveal, hidden]);
  useEffect(() => {
    if (!privacy.hidden) return;
    operation.current++;
    running.current = false;
    setBusy(false);
    setChecked('');
    setAcknowledged(false);
    const next = { ...attemptsRef.current };
    for (const key of Object.keys(next)) {
      if (next[key].status === 'pending')
        next[key] = { ...next[key], status: 'unconfirmed' };
    }
    updateAttempts(next);
  }, [privacy.hidden]);

  function inputFor(row: StatementCandidate) {
    let id = ids.current.get(row.id);
    if (!id) {
      id = crypto.randomUUID();
      ids.current.set(row.id, id);
    }
    return createImportInput(row, bank, period, id);
  }
  const inputs = selection
    .map((key) => rows.find((row) => row.id === key))
    .filter((row): row is StatementCandidate => !!row)
    .map(inputFor);
  const signature = JSON.stringify(inputs);
  const ready =
    inputs.length > 0 &&
    inputs.length <= IMPORT_SAVE_LIMIT &&
    inputs.every((input) => input !== null);
  const duplicateIds = duplicates.filter((id) =>
    inputs.some((input) => input?.id === id)
  );
  const reviewed =
    ready && checked === signature && (!duplicateIds.length || acknowledged);

  function toggle(row: StatementCandidate) {
    if (!privacy.canReveal() || running.current || attemptsRef.current[row.id])
      return;
    setSelection((current) =>
      current.includes(row.id)
        ? current.filter((key) => key !== row.id)
        : [...current, row.id]
    );
    setChecked('');
    setAcknowledged(false);
  }
  function selectExpenses(candidates: StatementCandidate[]) {
    if (!privacy.canReveal() || running.current) return;
    const eligible = candidates.filter(
      (row) => !attemptsRef.current[row.id] && inputFor(row) !== null
    );
    setSelection(eligible.slice(0, IMPORT_SAVE_LIMIT).map((row) => row.id));
    setChecked('');
    setAcknowledged(false);
  }
  function clearSelection() {
    if (!privacy.canReveal() || running.current) return;
    setSelection([]);
    setChecked('');
    setAcknowledged(false);
  }
  function invalidateReview() {
    setChecked('');
    setAcknowledged(false);
  }
  function valid(op: number, epoch: number) {
    return (
      alive.current &&
      operation.current === op &&
      privacy.canReveal() &&
      privacy.getHideEpoch() === epoch
    );
  }
  function refresh() {
    if (!privacy.canReveal() || !client) return;
    if (client.isMutating()) {
      const query = client
        .getQueryCache()
        .find({ queryKey: EXPENSE_KEY, exact: true });
      if (query) deferredRefresh.current = { query };
      void client.invalidateQueries({
        queryKey: EXPENSE_KEY,
        refetchType: 'none',
      });
    } else {
      deferredRefresh.current = null;
      void client.invalidateQueries({
        queryKey: EXPENSE_KEY,
        refetchType: 'active',
      });
    }
  }
  async function compare() {
    if (!ready || running.current || !privacy.canReveal()) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    const op = ++operation.current;
    const epoch = privacy.getHideEpoch();
    try {
      const saved = await withImportDeadline(getExpenses());
      if (!valid(op, epoch)) return;
      const chosen = inputs.filter(
        (input): input is ImportedExpenseInput => input !== null
      );
      const matches = possibleImportDuplicates(chosen, saved);
      selection.forEach((key) => {
        const row = rows.find((entry) => entry.id === key);
        if (row && hasSourceDuplicate(row)) {
          const input = inputFor(row);
          if (input) matches.add(input.id);
        }
      });
      setDuplicates([...matches]);
      setChecked(signature);
      setAcknowledged(false);
      setMessage(
        matches.size
          ? 'Possible duplicates need source comparison and acknowledgement.'
          : 'No possible matches found in this read. Concurrent or overlapping imports can still duplicate purchases.'
      );
    } catch {
      if (valid(op, epoch)) {
        setChecked('');
        setMessage(
          'Expenses could not be checked. Try the duplicate check again before saving.'
        );
      }
    } finally {
      if (operation.current === op) running.current = false;
      if (alive.current && operation.current === op) {
        setBusy(false);
        if (!valid(op, epoch)) {
          setChecked('');
          setAcknowledged(false);
        }
      }
    }
  }

  async function dispatch(batch: Array<[string, Attempt]>) {
    if (running.current || !privacy.canReveal()) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    const op = ++operation.current;
    const epoch = privacy.getHideEpoch();
    let confirmed = false;
    try {
      for (let offset = 0; offset < batch.length; ) {
        if (!valid(op, epoch)) break;
        const group: Array<[string, Attempt]> = [];
        let bytes = 2;
        while (offset < batch.length && group.length < IMPORT_SAVE_GROUP_SIZE) {
          const next = batch[offset];
          const size =
            new TextEncoder().encode(JSON.stringify(next[1].input)).length + 1;
          if (group.length && bytes + size > IMPORT_SAVE_MAX_BYTES) break;
          group.push(next);
          bytes += size;
          offset++;
        }
        const pending = { ...attemptsRef.current };
        for (const [key, attempt] of group)
          pending[key] = { ...attempt, status: 'pending' };
        updateAttempts(pending);
        let results: ImportExpenseOutcome[] = [];
        try {
          results = await withImportDeadline(
            insertImportedExpenses(group.map(([, attempt]) => attempt.input))
          );
        } catch {
          // Timeout or transport failure never establishes rollback.
        }
        if (!valid(op, epoch)) {
          if (alive.current && operation.current === op) {
            const next = { ...attemptsRef.current };
            for (const [key, attempt] of group)
              next[key] = { ...attempt, status: 'unconfirmed' };
            updateAttempts(next);
          }
          break;
        }
        const next = { ...attemptsRef.current };
        let stopped = false;
        for (const [key, attempt] of group) {
          const matches = Array.isArray(results)
            ? results.filter((result) => result?.id === attempt.input.id)
            : [];
          const result = matches.length === 1 ? matches[0] : undefined;
          const status =
            result &&
            ['confirmed', 'not_saved', 'unconfirmed', 'conflict'].includes(
              result.status
            )
              ? result.status
              : 'unconfirmed';
          next[key] = { ...attempt, status, reason: result?.reason };
          if (status === 'confirmed') confirmed = true;
          if (status === 'unconfirmed' || status === 'conflict') stopped = true;
        }
        updateAttempts(next);
        if (stopped) {
          setMessage(
            'Import paused. Check saved expenses before continuing; do not start the same import again.'
          );
          break;
        }
        if (group.some(([key]) => next[key].status === 'not_saved')) {
          setMessage(
            group.some(([key]) => next[key].reason === 'access')
              ? 'Saving was blocked. Check that you are signed in and your vault is unlocked, then retry the same expenses.'
              : 'This group was not saved. Retry the same expenses, or cancel rejected attempts to correct their details.'
          );
          break;
        }
      }
    } finally {
      if (operation.current === op) running.current = false;
      if (alive.current && operation.current === op) {
        setBusy(false);
        setChecked('');
        setAcknowledged(false);
        if (confirmed && valid(op, epoch)) refresh();
      }
    }
  }

  async function save() {
    if (
      !reviewed ||
      running.current ||
      !privacy.canReveal() ||
      Object.values(attemptsRef.current).some((attempt) =>
        ['pending', 'unconfirmed', 'conflict'].includes(attempt.status)
      )
    )
      return;
    const next = { ...attemptsRef.current };
    const batch: Array<[string, Attempt]> = [];
    selection.forEach((key, index) => {
      const input = inputs[index];
      if (input && !next[key]) {
        next[key] = { input, status: 'not_started' };
        batch.push([key, next[key]]);
      }
    });
    updateAttempts(next);
    setSelection([]);
    await dispatch(batch);
  }
  async function check() {
    if (running.current || !privacy.canReveal()) return;
    running.current = true;
    setBusy(true);
    const op = ++operation.current;
    const epoch = privacy.getHideEpoch();
    try {
      const saved = await withImportDeadline(getExpenses());
      if (!valid(op, epoch)) return;
      const next = { ...attemptsRef.current };
      for (const key of Object.keys(next)) {
        if (next[key].status === 'unconfirmed')
          next[key] = {
            ...next[key],
            status: checkImportOutcome(next[key].input, saved),
          };
      }
      updateAttempts(next);
      if (Object.values(next).some((attempt) => attempt.status === 'confirmed'))
        refresh();
      setMessage(
        'Checked saved expenses. Missing records remain unconfirmed; retry could recreate an expense deleted elsewhere.'
      );
    } catch {
      if (valid(op, epoch))
        setMessage(
          'Saved expenses could not be checked. Frozen submissions are retained.'
        );
    } finally {
      if (operation.current === op) running.current = false;
      if (alive.current && operation.current === op) setBusy(false);
    }
  }
  function cancelRejected(key: string) {
    if (
      !privacy.canReveal() ||
      running.current ||
      attemptsRef.current[key]?.status !== 'not_saved'
    )
      return;
    const next = { ...attemptsRef.current };
    delete next[key];
    updateAttempts(next);
  }
  function allowDiscard() {
    if (!selection.length && !Object.keys(attemptsRef.current).length)
      return true;
    return window.confirm(
      'Discard this review? Dispatched saves may still complete. Unsaved drafts and retained retry identities will be lost.'
    );
  }
  function reset() {
    operation.current++;
    running.current = false;
    ids.current.clear();
    updateAttempts({});
    setSelection([]);
    setChecked('');
    setDuplicates([]);
    setAcknowledged(false);
    setMessage('');
    setBusy(false);
  }
  const unresolved = Object.values(attempts).some((attempt) =>
    ['unconfirmed', 'conflict', 'pending'].includes(attempt.status)
  );
  useEffect(() => {
    if (!busy && !unresolved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, unresolved]);
  return {
    selection,
    attempts,
    busy,
    message,
    ready,
    reviewed,
    duplicateIds,
    duplicateSources: inputs
      .filter(
        (input): input is ImportedExpenseInput =>
          input !== null && duplicateIds.includes(input.id)
      )
      .map((input) => input.source[0]),
    acknowledged,
    setAcknowledged,
    toggle,
    selectExpenses,
    clearSelection,
    inputFor,
    compare,
    save,
    check,
    allowDiscard,
    invalidateReview,
    cancelRejected,
    reset,
    locked: (key: string) => !!attemptsRef.current[key],
    total: inputs.reduce((sum, input) => sum + (input?.cents ?? 0), 0) / 100,
    retry: (key: string) => {
      const attempt = attemptsRef.current[key];
      if (attempt?.status === 'not_saved') void dispatch([[key, attempt]]);
    },
    continueBatch: () => {
      if (!unresolved)
        void dispatch(
          Object.entries(attemptsRef.current).filter(
            ([, attempt]) => attempt.status === 'not_started'
          )
        );
    },
    unresolved,
  };
}
