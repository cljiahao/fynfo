import {
  consumeRateLimit,
  recordMarketingEvent,
} from '@/integrations/services/security-rpc';
import { TRACK_BODY_MAX_BYTES } from '@/lib/constants/telemetry';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { clientRateKey } from '@/lib/rate-limit';
import { readBoundedJson, rejectUnsafeRequest } from '@/lib/request-guard';
import { withLogging } from '@/lib/utils/with-logging';
import { TrackEventSchema } from '@/lib/validation/track-event';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const TRACK_MAX_PER_WINDOW = 60;
const TRACK_WINDOW_SECONDS = 60;

// Anonymous, non-PII marketing telemetry (constitution §2.2 carve-out): stores
// only event_type + path, never identity or financial data. Only the trusted
// RPC may insert; direct Data API ingestion is denied.
export const POST = withLogging('api.track', async (req: Request) => {
  const rejected = rejectUnsafeRequest(req, {
    json: true,
    maxBodyBytes: TRACK_BODY_MAX_BYTES,
  });
  if (rejected) return rejected;
  try {
    const raw = await readBoundedJson(req, TRACK_BODY_MAX_BYTES);
    const parsed = TrackEventSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    // A limiter outage fails open: the insert shares the same backend, and
    // telemetry must never block the page.
    const allowed = await consumeRateLimit(
      `track:${clientRateKey(req)}`,
      TRACK_MAX_PER_WINDOW,
      TRACK_WINDOW_SECONDS
    ).catch(() => true);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
      await recordMarketingEvent(parsed.data.eventType, parsed.data.path);
    } catch {
      // Telemetry is best-effort: log server-side, never leak Postgres detail,
      // never fail the caller in a way that could affect the page.
      logger.warn('marketing event insert failed');
      return NextResponse.json({ ok: false }, { status: 202 });
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return handleApiError('api.track', error);
  }
});
