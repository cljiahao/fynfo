'use client';
import {
  EXPENSE_KEY,
  getExpenses,
  type ExpenseData,
} from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getRecurringRulebook,
  mutateRecurringRulebook,
} from '../actions/recurring-actions';
import { recurringRequestRecorded } from '../lib/commands';
import { recurringMutationSchema } from '../schemas';
import type { RecurringBook, RecurringMutation } from '../types';
type Stage =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'unconfirmed'
  | 'conflict'
  | 'error';

export function useRecurringExpenseLinks() {
  const { canReveal, getHideEpoch, hidden } = useAmountVisibility();
  const [rows, setRows] = useState<ExpenseData[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const currentGeneration = generation;
    alive.current = true;
    return () => {
      alive.current = false;
      currentGeneration.current++;
    };
  }, []);
  useEffect(() => {
    if (hidden) {
      generation.current++;
      pending.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with the privacy or rulebook signal
      setBusy(false);
      setRows(null);
      setMessage('');
    }
  }, [hidden]);
  async function check() {
    if (!canReveal() || pending.current) return;
    pending.current = true;
    setBusy(true);
    const op = generation.current;
    const epoch = getHideEpoch();
    const valid = () =>
      alive.current &&
      generation.current === op &&
      canReveal() &&
      getHideEpoch() === epoch;
    try {
      const records = await getExpenses();
      if (valid()) {
        setRows(records);
        setMessage(
          'Linked expenses checked. Results describe this read; receipts are retained even after an expense changes or is deleted.'
        );
      }
    } catch {
      if (valid()) {
        setRows(null);
        setMessage('Linked expenses could not be checked. Try again.');
      }
    } finally {
      if (generation.current === op) {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    }
  }
  return { rows, message, busy, check };
}

export function useRecurringRulebook() {
  const privacy = useAmountVisibility();
  const client = useContext(QueryClientContext);
  const [book, setBook] = useState<RecurringBook | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const loaded = useRef(false);
  const frozen = useRef<RecurringMutation | null>(null);
  const refreshQueue = useRef<{ query: object } | null>(null);
  const { canReveal, getHideEpoch, hidden } = privacy;
  useEffect(() => {
    const currentGeneration = generation;
    alive.current = true;
    pending.current = false;
    const queue = refreshQueue;
    return () => {
      alive.current = false;
      currentGeneration.current++;
      queue.current = null;
    };
  }, []);
  useEffect(() => {
    if (!hidden) return;
    generation.current++;
    pending.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with the privacy or rulebook signal
    setBusy(false);
    setStage(
      frozen.current ? 'unconfirmed' : loaded.current ? 'ready' : 'idle'
    );
    if (frozen.current)
      setMessage(
        'Save unconfirmed. Show amounts and check the saved occurrence before continuing.'
      );
  }, [hidden]);
  const valid = useCallback(
    (op: number, epoch: number) =>
      alive.current &&
      generation.current === op &&
      canReveal() &&
      getHideEpoch() === epoch,
    [canReveal, getHideEpoch]
  );
  useEffect(() => {
    if (!client) return;
    const flush = () => {
      const queued = refreshQueue.current;
      if (!queued || !alive.current || !canReveal() || client.isMutating())
        return;
      refreshQueue.current = null;
      if (
        client.getQueryCache().find({ queryKey: EXPENSE_KEY, exact: true }) ===
        queued.query
      )
        void client.invalidateQueries({
          queryKey: EXPENSE_KEY,
          refetchType: 'active',
        });
    };
    const unsubscribe = client.getMutationCache().subscribe(flush);
    flush();
    return unsubscribe;
  }, [client, canReveal, hidden]);
  function refreshExpenses(input: RecurringMutation) {
    if (input.command.kind !== 'confirm' || !canReveal() || !client) return;
    const query = client
      .getQueryCache()
      .find({ queryKey: EXPENSE_KEY, exact: true });
    if (query && client.isMutating()) refreshQueue.current = { query };
    void client.invalidateQueries({
      queryKey: EXPENSE_KEY,
      refetchType: client.isMutating() ? 'none' : 'active',
    });
  }
  const load = useCallback(async () => {
    if (!canReveal() || pending.current) return;
    pending.current = true;
    setBusy(true);
    setStage('loading');
    setMessage('');
    const op = generation.current;
    const epoch = getHideEpoch();
    try {
      const current = await getRecurringRulebook();
      if (!valid(op, epoch)) return;
      loaded.current = true;
      setBook(current);
      frozen.current = null;
      setStage('ready');
    } catch {
      if (valid(op, epoch)) {
        setStage('error');
        setMessage(
          'Recurring templates could not be loaded. Try again before editing.'
        );
      }
    } finally {
      if (generation.current === op) {
        pending.current = false;
        if (alive.current) {
          setBusy(false);
          if (!valid(op, epoch))
            setStage(frozen.current ? 'unconfirmed' : 'idle');
        }
      }
    }
  }, [canReveal, getHideEpoch, valid]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with the privacy or rulebook signal
    if (stage === 'idle' && !hidden) void load();
  }, [stage, hidden, load]);

  async function execute(
    command: RecurringMutation['command']
  ): Promise<boolean> {
    if (stage !== 'ready' || pending.current || !canReveal()) return false;
    const parsed = recurringMutationSchema.safeParse({
      bookId: book?.id ?? crypto.randomUUID(),
      expectedRevision: book?.revision ?? '0',
      requestId: crypto.randomUUID(),
      command,
    });
    if (!parsed.success) {
      setMessage('Check the template or actual expense fields before saving.');
      return false;
    }
    const input = parsed.data;
    frozen.current = input;
    pending.current = true;
    setBusy(true);
    setStage('saving');
    setMessage('');
    const op = generation.current;
    const epoch = getHideEpoch();
    try {
      const result = await mutateRecurringRulebook(input);
      if (!valid(op, epoch)) return false;
      if (result.status === 'saved') {
        refreshExpenses(input);
        try {
          const latest = await getRecurringRulebook();
          if (!valid(op, epoch)) return false;
          frozen.current = null;
          setBook(latest);
          setStage('ready');
          setMessage(
            input.command.kind === 'confirm'
              ? 'Occurrence recorded as a self expense.'
              : input.command.kind === 'skip'
                ? 'Occurrence skipped for this month.'
                : 'Template saved. Existing occurrences are unchanged.'
          );
        } catch {
          if (valid(op, epoch)) {
            frozen.current = null;
            setStage('error');
            setMessage(
              'Save confirmed, but templates could not be reloaded. Reload before continuing.'
            );
          }
        }
        return valid(op, epoch);
      }
      setStage(result.status === 'not_saved' ? 'ready' : result.status);
      if (result.status === 'not_saved') frozen.current = null;
      setMessage(
        result.status === 'conflict'
          ? 'Templates or this occurrence changed elsewhere. Reload and review before continuing.'
          : result.status === 'not_saved'
            ? 'Nothing was dispatched or saved. Check dates, values and storage limits.'
            : 'Save unconfirmed. Check the saved occurrence before continuing.'
      );
    } catch {
      if (valid(op, epoch)) {
        setStage('unconfirmed');
        setMessage(
          'Save unconfirmed. Check the saved occurrence before continuing.'
        );
      }
    } finally {
      if (generation.current === op) {
        pending.current = false;
        if (alive.current) {
          setBusy(false);
          if (!valid(op, epoch) && frozen.current) setStage('unconfirmed');
        }
      }
    }
    return false;
  }
  async function check(): Promise<boolean> {
    const input = frozen.current;
    if (!input || pending.current || !canReveal()) return false;
    pending.current = true;
    setBusy(true);
    const op = generation.current;
    const epoch = getHideEpoch();
    try {
      const current = await getRecurringRulebook();
      if (!valid(op, epoch)) return false;
      if (
        current?.id === input.bookId &&
        recurringRequestRecorded(input, current.payload)
      ) {
        setBook(current);
        frozen.current = null;
        setStage('ready');
        setMessage('Saved occurrence or template confirmed.');
        refreshExpenses(input);
        return true;
      }
      const changed =
        current &&
        (current.id !== input.bookId ||
          current.revision !== input.expectedRevision);
      setStage(changed ? 'conflict' : 'unconfirmed');
      setMessage(
        changed
          ? 'Saved templates differ from this submission. Reload and review before continuing.'
          : 'No matching receipt is confirmed. The submission stays frozen and will not be resent.'
      );
    } catch {
      if (valid(op, epoch))
        setMessage(
          'Saved occurrence could not be checked. Try checking again.'
        );
    } finally {
      if (generation.current === op) {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    }
    return false;
  }
  return {
    book,
    stage,
    message,
    busy,
    execute,
    check,
    load,
    canEdit: stage === 'ready' && !hidden,
  };
}
