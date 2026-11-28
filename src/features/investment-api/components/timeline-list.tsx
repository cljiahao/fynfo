import { groupByDate, type TimelineEvent } from '../actions/journal-group';

const EVENT_LABELS: Record<TimelineEvent['eventType'], string> = {
  plan: 'Plan',
  sell_flag: 'Sell flag',
  verdict: 'Verdict',
};

interface Props {
  events: readonly TimelineEvent[];
}

export function TimelineList({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No journal events yet. Events from your investment tools appear here
        once they write to your journal.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {groupByDate(events).map((day) => (
        <section key={day.date} aria-label={day.date}>
          <h3 className="mb-2 text-sm font-medium">{day.date}</h3>
          <ul className="space-y-2">
            {day.events.map((event) => (
              <li key={event.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{event.caller}</span>
                  <span>{EVENT_LABELS[event.eventType]}</span>
                  <time
                    dateTime={event.occurredAt}
                    className="text-muted-foreground"
                  >
                    {event.occurredAt}
                  </time>
                </div>
                {event.payload === null ? (
                  <p className="text-muted-foreground mt-2">could not open</p>
                ) : (
                  <pre className="mt-2 text-xs break-words whitespace-pre-wrap">
                    {event.payload}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
