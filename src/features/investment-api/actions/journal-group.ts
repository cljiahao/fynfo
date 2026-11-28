export type TimelineEvent = {
  id: string;
  caller: string;
  eventType: 'plan' | 'sell_flag' | 'verdict';
  occurredAt: string;
  /** Opened plaintext, or null when the event could not be opened. */
  payload: string | null;
};

export type TimelineDay = { date: string; events: TimelineEvent[] };

/** Groups by UTC calendar date, newest day first, newest event first within a day. */
export function groupByDate(events: readonly TimelineEvent[]): TimelineDay[] {
  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0
  );
  const days: TimelineDay[] = [];
  for (const event of sorted) {
    const date = event.occurredAt.slice(0, 10);
    const last = days.at(-1);
    if (last && last.date === date) last.events.push(event);
    else days.push({ date, events: [event] });
  }
  return days;
}
