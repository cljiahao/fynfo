'use server';

import { requireActionContext } from '@/lib/action-guard';
import { open } from '@/lib/sealed-box';
import { z } from 'zod';
import type { TimelineEvent } from './journal-group';
import { readJournalPrivateKey } from './journal-keys';

const MAX_EVENTS = 500;

const JOURNAL_ROWS = z.array(
  z.object({
    id: z.uuid(),
    caller_id: z.uuid(),
    event_type: z.enum(['plan', 'sell_flag', 'verdict']),
    occurred_at: z.iso.datetime({ offset: true }),
    sealed: z.string(),
  })
);
const CALLER_NAMES = z.array(z.object({ id: z.uuid(), name: z.string() }));

function unavailable(): never {
  throw new Error('Journal unavailable');
}

function openOrNull(privateKey: Buffer, sealed: string): string | null {
  try {
    return open(privateKey, sealed).toString('utf8');
  } catch {
    return null;
  }
}

/** Opens every event in this session; an event that fails to open is returned with a null payload. */
export async function getJournalTimeline(): Promise<TimelineEvent[]> {
  const { userId, dek, supabase } = await requireActionContext();
  // Reading never creates the keypair: without one no caller could have appended anything.
  const privateKey = await readJournalPrivateKey(supabase, userId, dek);
  if (!privateKey) return [];

  const [journal, callers] = await Promise.all([
    supabase
      .from('invest_journal')
      .select('id, caller_id, event_type, occurred_at, sealed')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(MAX_EVENTS),
    supabase
      .from('invest_api_callers')
      .select('id, name')
      .eq('user_id', userId),
  ]);
  if (journal.error || callers.error) return unavailable();
  const rows = JOURNAL_ROWS.safeParse(journal.data);
  const names = CALLER_NAMES.safeParse(callers.data);
  if (!rows.success || !names.success) return unavailable();
  const nameById = new Map(names.data.map((c) => [c.id, c.name]));

  return rows.data.map((row) => ({
    id: row.id,
    caller: nameById.get(row.caller_id) ?? 'unknown',
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    payload: openOrNull(privateKey, row.sealed),
  }));
}
