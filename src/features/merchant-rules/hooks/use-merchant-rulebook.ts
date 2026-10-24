'use client';

import { useAmountVisibility } from '@/features/privacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMerchantRulebook,
  saveMerchantRulebook,
} from '../actions/rulebook-actions';
import { checkRulebookSave } from '../lib/rulebook-state';
import { saveRulebookSchema } from '../schemas';
import type {
  MerchantRule,
  MerchantRulebook,
  SaveRulebookInput,
} from '../types';

type Stage =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'unconfirmed'
  | 'conflict'
  | 'error';

export function useMerchantRulebook() {
  const privacy = useAmountVisibility();
  const [book, setBook] = useState<MerchantRulebook | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const lifetime = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const loaded = useRef(false);
  const frozen = useRef<SaveRulebookInput | null>(null);
  const { canReveal, getHideEpoch } = privacy;

  useEffect(() => {
    const currentLifetime = lifetime;
    mounted.current = true;
    pending.current = false;
    return () => {
      mounted.current = false;
      currentLifetime.current++;
    };
  }, []);
  useEffect(() => {
    if (!privacy.hidden) return;
    // Dispatched writes may still finish. Release the UI gate for an explicit
    // authoritative check after Show, while rejecting the older callback.
    lifetime.current++;
    pending.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- audit 152 §Phase 3 lint suppressions: intentional sync with the privacy or rulebook signal
    setBusy(false);
    setStage(
      frozen.current ? 'unconfirmed' : loaded.current ? 'ready' : 'idle'
    );
    if (frozen.current)
      setMessage('Save unconfirmed. Check saved rules after showing amounts.');
  }, [privacy.hidden]);
  const valid = useCallback(
    (generation: number, epoch: number) =>
      mounted.current &&
      lifetime.current === generation &&
      canReveal() &&
      getHideEpoch() === epoch,
    [canReveal, getHideEpoch]
  );

  const load = useCallback(async () => {
    if (!canReveal() || pending.current) return;
    pending.current = true;
    setBusy(true);
    const generation = lifetime.current;
    const epoch = getHideEpoch();
    setStage('loading');
    setMessage('');
    try {
      const current = await getMerchantRulebook();
      if (!valid(generation, epoch)) return;
      loaded.current = true;
      setBook(current);
      frozen.current = null;
      setStage('ready');
    } catch {
      if (valid(generation, epoch)) {
        setStage('error');
        setMessage(
          'Merchant rules could not be loaded. Try again before editing.'
        );
      }
    } finally {
      if (lifetime.current === generation) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
      if (
        mounted.current &&
        lifetime.current === generation &&
        !valid(generation, epoch)
      )
        setStage(frozen.current ? 'unconfirmed' : 'idle');
    }
  }, [canReveal, getHideEpoch, valid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- audit 152 §Phase 3 lint suppressions: intentional sync with the privacy or rulebook signal
    if (stage === 'idle' && !privacy.hidden) void load();
  }, [stage, privacy.hidden, load]);

  async function save(rules: MerchantRule[]): Promise<boolean> {
    if (stage !== 'ready' || !canReveal() || pending.current) return false;
    const input = saveRulebookSchema.safeParse({
      id: book?.id ?? crypto.randomUUID(),
      expectedRevision: book?.revision ?? '0',
      payload: { schemaVersion: 1, requestId: crypto.randomUUID(), rules },
    });
    if (!input.success) {
      setMessage('Check rule values and size limits before saving.');
      return false;
    }
    frozen.current = input.data;
    pending.current = true;
    setBusy(true);
    setStage('saving');
    setMessage('');
    const generation = lifetime.current;
    const epoch = getHideEpoch();
    try {
      const result = await saveMerchantRulebook(input.data);
      if (!valid(generation, epoch)) return false;
      if (result.status === 'saved') {
        setBook({
          id: input.data.id,
          revision: result.revision,
          payload: input.data.payload,
        });
        frozen.current = null;
        setStage('ready');
        setMessage('Merchant rules saved. Existing expenses are unchanged.');
        return true;
      }
      setStage(result.status === 'not_saved' ? 'ready' : result.status);
      if (result.status === 'not_saved') frozen.current = null;
      setMessage(
        result.status === 'not_saved'
          ? 'Rules were not saved. Check the draft and try again.'
          : result.status === 'conflict'
            ? 'Rules changed elsewhere. Keep your draft and reload to review the latest rules.'
            : 'Save unconfirmed. Check saved rules before continuing.'
      );
    } catch {
      if (valid(generation, epoch)) {
        setStage('unconfirmed');
        setMessage('Save unconfirmed. Check saved rules before continuing.');
      }
    } finally {
      if (lifetime.current === generation) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
      if (
        mounted.current &&
        lifetime.current === generation &&
        !valid(generation, epoch)
      )
        setStage('unconfirmed');
    }
    return false;
  }

  async function check(): Promise<boolean> {
    const input = frozen.current;
    if (!input || !canReveal() || pending.current) return false;
    pending.current = true;
    setBusy(true);
    const generation = lifetime.current;
    const epoch = getHideEpoch();
    try {
      const current = await getMerchantRulebook();
      if (!valid(generation, epoch)) return false;
      const outcome = checkRulebookSave(input, current);
      if (outcome === 'saved') {
        setBook(current);
        frozen.current = null;
        setStage('ready');
        setMessage('Saved rules confirmed.');
        return true;
      }
      setStage(outcome);
      setMessage(
        outcome === 'conflict'
          ? 'Saved rules differ from this submission. Reload and review before editing.'
          : 'No matching save is confirmed. The frozen submission is retained; it will not be resent.'
      );
    } catch {
      if (valid(generation, epoch))
        setMessage('Saved rules could not be checked. Try checking again.');
    } finally {
      if (lifetime.current === generation) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
    return false;
  }

  return {
    book,
    stage,
    message,
    busy,
    save,
    check,
    load,
    rules: stage === 'ready' ? (book?.payload.rules ?? []) : [],
    canEdit: stage === 'ready' && !privacy.hidden,
  };
}
