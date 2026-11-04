import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { loadLocal, saveLocal } from '@/lib/utils/local-store';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { autoScanDividends } from '../actions/dividend-actions';
import { DIVIDENDS_KEY } from '../hooks/use-dividends';

const AUTO_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Guards against overlapping runs (e.g. rapid re-unlock) that would both pass the throttle before either saves it. */
const inFlight = new Set<string>();

const lastScanKey = (userId: string) => `fynfo:divscan:last:${userId}`;

/** A missing or unreadable timestamp scans; the dedupe rule makes a repeat harmless. */
export function shouldAutoScan(lastIso: string | null, nowMs: number): boolean {
  if (!lastIso) return true;
  const last = Date.parse(lastIso);
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= AUTO_SCAN_INTERVAL_MS;
}

/**
 * Background dividend scan after unlock. Never throws and callers must not
 * await it on the unlock path: a failure only means the next unlock retries.
 */
export async function runDividendAutoScan(
  userId: string,
  queryClient: QueryClient
): Promise<void> {
  if (!userId || inFlight.has(userId)) return;
  inFlight.add(userId);
  try {
    const key = lastScanKey(userId);
    const last = loadLocal<string | null>(key, null);
    if (!shouldAutoScan(typeof last === 'string' ? last : null, Date.now()))
      return;
    const { added } = await autoScanDividends();
    saveLocal(key, new Date().toISOString());
    if (added > 0) {
      toast.success(`Added ${added} ${added === 1 ? 'dividend' : 'dividends'}`);
      void refreshQueriesAfterMutation(queryClient, DIVIDENDS_KEY);
    }
  } catch {
    // Opaque by design; the server logged the cause and the next unlock retries.
  } finally {
    inFlight.delete(userId);
  }
}
