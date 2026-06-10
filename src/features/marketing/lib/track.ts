import { API_ROUTES } from '@/lib/constants/routes';
import type { MarketingEventType } from '@/lib/constants/telemetry';

/**
 * Fire-and-forget marketing telemetry beacon. Never blocks navigation, never
 * surfaces an error to the visitor — telemetry is best-effort by definition.
 * Uses `keepalive` so the request survives a page unload (e.g. CTA click that
 * navigates away).
 */
export function trackEvent(eventType: MarketingEventType, path: string): void {
  try {
    void fetch(API_ROUTES.TRACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, path }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow — a failed beacon must never affect the page.
  }
}
