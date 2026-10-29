'use client';

import {
  EXPENSE_KEY,
  getExpensesInRange,
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
  savedImportMatches,
  statementImportMatches,
} from '../lib/import-selection';
import { withImportDeadline } from '../lib/request-deadline';
import type {
  DuplicateMatch,
  DuplicateResolution,
  StatementBank,
  StatementCandidate,
  StatementPeriod,
} from '../types';

type Attempt = {
  input: ImportedExpenseInput;
  status: ImportExpenseOutcome['status'] | 'not_started' | 'pending';
  reason?: ImportExpenseOutcome['reason'];
};
type SavedMatch = Extract<DuplicateMatch, { kind: 'saved' }>;
export type ImportActivity = 'check' | 'save' | 'verify';
type SaveRun = { keys: string[]; group: number; groups: number };

// Description and splits are not compared for duplicates, so editing them
// needs no recheck.
const signatureOf = ({
  note: _note,
  splits: _splits,
  ...input
}: ImportedExpenseInput) => JSON.stringify(input);

/** Reads only the saved expenses dated within these inputs' dates. */
function readSavedAround(inputs: ImportedExpenseInput[]) {
  const dates = inputs.map((input) => input.date).sort();
  return withImportDeadline(
    getExpensesInRange(dates[0], dates[dates.length - 1])
  );
}

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
  // Input JSON per row at its last successful duplicate check.
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [savedMatches, setSavedMatches] = useState<Record<string, SavedMatch>>(
    {}
  );
  const [resolutions, setResolutions] = useState<
    Record<string, DuplicateResolution>
  >({});
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ImportActivity | null>(null);
  const [checking, setChecking] = useState(0);
  const [run, setRun] = useState<SaveRun | null>(null);
  const [complete, setComplete] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- audit 152 §Phase 3 lint suppressions: intentional sync with the privacy or rulebook signal
    setBusy(false);
    setActivity(null);
    setRun(null);
    setChecks({});
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
  const inputById = new Map(
    // eslint-disable-next-line react-hooks/refs -- audit 152 §Phase 3 lint suppressions: row ids are allocated lazily and stay stable
    rows.map((row) => [row.id, inputFor(row)] as const)
  );
  const entries = selection
    .map((key) => rows.find((row) => row.id === key))
    .filter((row): row is StatementCandidate => !!row)
    .map((row) => ({ row, input: inputById.get(row.id) ?? null }));
  const ready =
    entries.length > 0 &&
    entries.length <= IMPORT_SAVE_LIMIT &&
    entries.every((entry) => entry.input !== null);
  const isChecked = (key: string, input: ImportedExpenseInput | null) =>
    !!input && checks[key] === signatureOf(input);
  const partners = statementImportMatches(
    rows.flatMap((row) => {
      if (resolutions[row.id] === 'skip') return [];
      const input = inputById.get(row.id);
      return input ? [{ key: row.id, input }] : [];
    })
  );
  function matchFor(key: string): DuplicateMatch | null {
    if (!selection.includes(key) && resolutions[key] !== 'skip') return null;
    if (!isChecked(key, inputById.get(key) ?? null)) return null;
    const partner = partners.get(key);
    return (
      savedMatches[key] ??
      (partner ? { kind: 'statement', rowId: partner } : null)
    );
  }
  const pending = entries.filter(
    ({ row, input }) =>
      !isChecked(row.id, input) || resolutions[row.id] === 'amend'
  );
  const recheck = pending.some(({ row }) => row.id in checks);
  const awaitingAmend = pending.filter(
    ({ row, input }) =>
      resolutions[row.id] === 'amend' && isChecked(row.id, input)
  ).length;
  const matched = entries.filter(({ row }) => matchFor(row.id));
  const openDuplicates = matched
    .filter(({ row }) => !resolutions[row.id])
    .map(({ row }) => row.id);
  const reviewed =
    ready &&
    pending.length === 0 &&
    matched.every(({ row }) => resolutions[row.id] === 'keep');

  function toggle(row: StatementCandidate) {
    if (!privacy.canReveal() || running.current || attemptsRef.current[row.id])
      return;
    if (selection.includes(row.id)) {
      setSelection(selection.filter((key) => key !== row.id));
      return;
    }
    setSelection([...selection, row.id]);
    if (resolutions[row.id] === 'skip') {
      const next = { ...resolutions };
      delete next[row.id];
      setResolutions(next);
    }
  }
  function selectExpenses(candidates: StatementCandidate[]) {
    if (!privacy.canReveal() || running.current) return;
    const eligible = candidates.filter(
      (row) =>
        !attemptsRef.current[row.id] &&
        resolutions[row.id] !== 'skip' &&
        inputFor(row) !== null
    );
    setSelection(eligible.slice(0, IMPORT_SAVE_LIMIT).map((row) => row.id));
  }
  function clearSelection() {
    if (!privacy.canReveal() || running.current) return;
    setSelection([]);
  }
  function resolve(key: string, choice: DuplicateResolution) {
    if (!privacy.canReveal() || running.current || attemptsRef.current[key])
      return;
    setResolutions({ ...resolutions, [key]: choice });
    if (choice === 'skip')
      setSelection(selection.filter((selected) => selected !== key));
  }
  function valid(op: number, epoch: number) {
    return (
      alive.current &&
      operation.current === op &&
      privacy.canReveal() &&
      privacy.getHideEpoch() === epoch
    );
  }
  function begin(kind: ImportActivity) {
    running.current = true;
    setBusy(true);
    setActivity(kind);
    setMessage('');
    return { op: ++operation.current, epoch: privacy.getHideEpoch() };
  }
  function finish(op: number) {
    if (operation.current === op) running.current = false;
    if (alive.current && operation.current === op) {
      setBusy(false);
      setActivity(null);
      setRun(null);
    }
  }
  function settle(next: Record<string, Attempt>) {
    const values = Object.values(next);
    if (
      values.length > 0 &&
      values.every((attempt) => attempt.status === 'confirmed')
    )
      setComplete(true);
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
    if (!ready || !pending.length || running.current || !privacy.canReveal())
      return;
    const targets = pending.map(({ row, input }) => ({
      key: row.id,
      input: input as ImportedExpenseInput,
    }));
    setChecking(targets.length);
    const { op, epoch } = begin('check');
    try {
      const saved = await readSavedAround(targets.map(({ input }) => input));
      if (!valid(op, epoch)) return;
      const found = savedImportMatches(
        targets.map(({ input }) => input),
        saved
      );
      const nextChecks = { ...checks };
      const nextMatches = { ...savedMatches };
      const nextResolutions = { ...resolutions };
      let count = 0;
      for (const { key, input } of targets) {
        nextChecks[key] = signatureOf(input);
        delete nextResolutions[key];
        const match = found.get(input.id);
        if (match) nextMatches[key] = match;
        else delete nextMatches[key];
        if (match || partners.has(key)) count++;
      }
      setChecks(nextChecks);
      setSavedMatches(nextMatches);
      setResolutions(nextResolutions);
      // The action bar reports open duplicates live; a stored count goes stale.
      setMessage(
        count
          ? ''
          : 'No possible matches found in this read. Concurrent or overlapping imports can still duplicate purchases.'
      );
    } catch {
      if (valid(op, epoch))
        setMessage(
          'Expenses could not be checked. Try the duplicate check again before saving.'
        );
    } finally {
      finish(op);
    }
  }
  function cancelCheck() {
    if (activity !== 'check') return;
    operation.current++;
    running.current = false;
    setBusy(false);
    setActivity(null);
  }

  async function dispatch(batch: Array<[string, Attempt]>) {
    if (running.current || !privacy.canReveal()) return;
    const groups: Array<Array<[string, Attempt]>> = [];
    for (let offset = 0; offset < batch.length; ) {
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
      groups.push(group);
    }
    const { op, epoch } = begin('save');
    const keys = batch.map(([key]) => key);
    let confirmed = false;
    try {
      for (const [index, group] of groups.entries()) {
        if (!valid(op, epoch)) break;
        setRun({ keys, group: index + 1, groups: groups.length });
        const pendingAttempts = { ...attemptsRef.current };
        for (const [key, attempt] of group)
          pendingAttempts[key] = { ...attempt, status: 'pending' };
        updateAttempts(pendingAttempts);
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
      const current = alive.current && operation.current === op;
      finish(op);
      if (current && confirmed && valid(op, epoch)) {
        refresh();
        settle(attemptsRef.current);
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
    for (const { row, input } of entries) {
      if (input && !next[row.id]) {
        next[row.id] = { input, status: 'not_started' };
        batch.push([row.id, next[row.id]]);
      }
    }
    updateAttempts(next);
    setSelection([]);
    await dispatch(batch);
  }
  async function check() {
    if (running.current || !privacy.canReveal()) return;
    const unconfirmed = Object.values(attemptsRef.current)
      .filter((attempt) => attempt.status === 'unconfirmed')
      .map((attempt) => attempt.input);
    if (!unconfirmed.length) return;
    const { op, epoch } = begin('verify');
    try {
      const saved = await readSavedAround(unconfirmed);
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
      settle(next);
    } catch {
      if (valid(op, epoch))
        setMessage(
          'Saved expenses could not be checked. Frozen submissions are retained.'
        );
    } finally {
      finish(op);
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
    if (running.current) return false;
    // Only unresolved saves risk a duplicate or lost outcome; selections do not.
    const values = Object.values(attemptsRef.current);
    if (
      values.every((attempt) =>
        ['confirmed', 'not_saved', 'not_started'].includes(attempt.status)
      )
    )
      return true;
    return window.confirm(
      'Close the import? Some saves are unconfirmed and may still complete. Their retry identities will be lost.'
    );
  }
  function reset() {
    operation.current++;
    running.current = false;
    ids.current.clear();
    updateAttempts({});
    setSelection([]);
    setChecks({});
    setSavedMatches({});
    setResolutions({});
    setMessage('');
    setBusy(false);
    setActivity(null);
    setRun(null);
    setComplete(false);
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
  const attempted = Object.keys(attempts);
  return {
    selection,
    attempts,
    busy,
    activity,
    message,
    ready,
    reviewed,
    complete,
    checking,
    pendingCount: pending.length,
    recheck,
    awaitingAmend,
    openDuplicates,
    duplicateCount: matched.length,
    kept: attempted.filter((key) => resolutions[key] === 'keep').length,
    skipped: Object.values(resolutions).filter((choice) => choice === 'skip')
      .length,
    progress: run && {
      done: run.keys.filter(
        (key) =>
          attempts[key] &&
          !['pending', 'not_started'].includes(attempts[key].status)
      ).length,
      total: run.keys.length,
      group: run.group,
      groups: run.groups,
    },
    matchFor,
    resolutionFor: (key: string): DuplicateResolution | undefined =>
      resolutions[key],
    isStale: (key: string) => {
      const entry = entries.find(({ row }) => row.id === key);
      return !!entry && key in checks && !isChecked(key, entry.input);
    },
    toggle,
    selectExpenses,
    clearSelection,
    resolve,
    inputFor,
    compare,
    cancelCheck,
    save,
    check,
    allowDiscard,
    cancelRejected,
    reset,
    dismissComplete: () => setComplete(false),
    locked: (key: string) => !!attemptsRef.current[key],
    total:
      entries.reduce((sum, { input }) => sum + (input?.cents ?? 0), 0) / 100,
    savedTotal:
      Object.values(attempts)
        .filter((attempt) => attempt.status === 'confirmed')
        .reduce((sum, attempt) => sum + attempt.input.cents, 0) / 100,
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
