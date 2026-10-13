'use client';

import {
  EXPENSE_KEY,
  getExpenses,
  insertImportedExpense,
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
import type {
  StatementBank,
  StatementCandidate,
  StatementPeriod,
} from '../types';

type Attempt = {
  input: ImportedExpenseInput;
  status: ImportExpenseOutcome['status'] | 'not_started' | 'pending';
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
    inputs.length <= 20 &&
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
      const saved = await getExpenses();
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
    try {
      for (const [key, attempt] of batch) {
        if (!valid(op, epoch)) break;
        updateAttempts({
          ...attemptsRef.current,
          [key]: { ...attempt, status: 'pending' },
        });
        let status: ImportExpenseOutcome['status'] = 'unconfirmed';
        try {
          const result = await insertImportedExpense(attempt.input);
          if (
            result?.id === attempt.input.id &&
            ['confirmed', 'not_saved', 'unconfirmed', 'conflict'].includes(
              result.status
            )
          )
            status = result.status;
        } catch {
          /* A transport error is not evidence of rollback. */
        }
        if (!valid(op, epoch)) {
          if (alive.current && operation.current === op) {
            updateAttempts({
              ...attemptsRef.current,
              [key]: { ...attempt, status: 'unconfirmed' },
            });
            setBusy(false);
            setChecked('');
            setAcknowledged(false);
          }
          break;
        }
        updateAttempts({
          ...attemptsRef.current,
          [key]: { ...attempt, status },
        });
        if (status === 'confirmed') refresh();
        if (status === 'unconfirmed' || status === 'conflict') break;
      }
    } finally {
      if (operation.current === op) running.current = false;
      if (valid(op, epoch)) {
        setBusy(false);
        setChecked('');
        setAcknowledged(false);
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
      const saved = await getExpenses();
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
