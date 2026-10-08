import { recordMarketingEvent } from '@/integrations/services/security-rpc';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/utils/with-logging';
import { TrackEventSchema } from '@/lib/validation/track-event';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Anonymous, non-PII marketing telemetry ingestion (gov-013 §2.2 carve-out).
// Stores only event_type + path — never identity, never financial data. The
// Only the trusted RPC may insert; direct Data API ingestion is denied.
export const POST = withLogging('api.track', async (req: Request) => {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = TrackEventSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: z.flattenError(parsed.error) },
        { status: 400 }
      );
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
