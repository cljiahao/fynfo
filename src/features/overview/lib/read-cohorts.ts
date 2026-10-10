import type {
  OverviewReadData,
  OverviewReadTransport,
  OverviewSource,
} from '@/lib/overview-read-context';
import type {
  OverviewReadAction,
  OverviewReadBundle,
  OverviewReadOutcome,
} from '../types';

interface PendingRead {
  source: OverviewSource;
  signal: AbortSignal;
  finish: (outcome: OverviewReadOutcome<unknown>) => void;
  abort: () => void;
}

export function createOverviewReadCohorts(action: OverviewReadAction) {
  let queued = new Map<OverviewSource, PendingRead>();
  let scheduled = false;

  function flush() {
    scheduled = false;
    const cohort = [...queued.values()].filter((read) => !read.signal.aborted);
    queued = new Map();
    if (!cohort.length) return;
    void Promise.resolve()
      .then(() => {
        const live = cohort.filter((read) => !read.signal.aborted);
        const empty: OverviewReadBundle = {};
        return live.length ? action(live.map((read) => read.source)) : empty;
      })
      .then(
        (bundle) => {
          for (const read of cohort) {
            const outcome = bundle[read.source];
            if (!outcome) read.finish({ ok: false, code: 'UNAVAILABLE' });
            else
              void outcome.then(read.finish, () =>
                read.finish({ ok: false, code: 'UNAVAILABLE' })
              );
          }
        },
        () => {
          for (const read of cohort)
            read.finish({ ok: false, code: 'UNAVAILABLE' });
        }
      );
  }

  const read: OverviewReadTransport['read'] = <K extends OverviewSource>(
    source: K,
    signal: AbortSignal
  ) =>
    new Promise<OverviewReadData[K]>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Overview read cancelled', 'AbortError'));
        return;
      }
      if (queued.has(source)) flush();
      let settled = false;
      const pending: PendingRead = {
        source,
        signal,
        finish(outcome) {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', pending.abort);
          if (outcome.ok) resolve(outcome.data as OverviewReadData[K]);
          else reject(new Error('Could not load overview source'));
        },
        abort() {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', pending.abort);
          if (queued.get(source) === pending) queued.delete(source);
          reject(new DOMException('Overview read cancelled', 'AbortError'));
        },
      };
      queued.set(source, pending);
      signal.addEventListener('abort', pending.abort, { once: true });
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    });

  return { read };
}
