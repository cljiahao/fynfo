import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/utils/with-logging';
import { TrackEventSchema } from '@/lib/validation/track-event';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Anonymous, non-PII marketing telemetry ingestion (gov-013 §2.2 carve-out).
// Stores only event_type + path — never identity, never financial data. The
// (anon) Supabase session inserts via the marketing_events INSERT policy.
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

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('marketing_events').insert({
      event_type: parsed.data.eventType,
      path: parsed.data.path,
    });

    if (error) {
      // Telemetry is best-effort: log server-side, never leak Postgres detail,
      // never fail the caller in a way that could affect the page.
      logger.warn({ code: error.code }, 'marketing event insert failed');
      return NextResponse.json({ ok: false }, { status: 202 });
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return handleApiError('api.track', error);
  }
});
