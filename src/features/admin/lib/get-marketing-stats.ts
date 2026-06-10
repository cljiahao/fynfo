import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { isAdminEmail } from '@/lib/admin';
import { logger } from '@/lib/logger';
import { notFound } from 'next/navigation';
import type { DailyPoint, MarketingStats } from '../types';
import { computeClickRate } from './compute-click-rate';

interface EventStatRow {
  day: string;
  event_type: string;
  events: number;
}
interface SignupStatRow {
  day: string;
  signups: number;
}

/**
 * Admin-only aggregate telemetry read. Per CONSTITUTION §2.3 carve-out: requires
 * auth + the admin email allowlist, but NOT the vault — it reads only
 * non-encrypted aggregate counts. Non-admins get a 404 (no admin surface leak).
 */
export async function getMarketingStats(): Promise<MarketingStats> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    notFound();
  }

  const [eventsRes, signupsRes] = await Promise.all([
    supabase.rpc('get_marketing_event_stats'),
    supabase.rpc('get_signup_stats'),
  ]);

  if (eventsRes.error || signupsRes.error) {
    logger.error(
      {
        eventsCode: eventsRes.error?.code,
        signupsCode: signupsRes.error?.code,
      },
      'failed to read marketing stats'
    );
    throw new Error('Failed to load telemetry');
  }

  const eventRows = (eventsRes.data ?? []) as EventStatRow[];
  const signupRows = (signupsRes.data ?? []) as SignupStatRow[];

  const byDay = new Map<string, DailyPoint>();
  let pageViews = 0;
  let ctaClicks = 0;

  for (const row of eventRows) {
    const events = Number(row.events);
    const point = byDay.get(row.day) ?? {
      day: row.day,
      pageViews: 0,
      ctaClicks: 0,
    };
    if (row.event_type === 'page_view') {
      point.pageViews += events;
      pageViews += events;
    } else if (row.event_type === 'cta_click') {
      point.ctaClicks += events;
      ctaClicks += events;
    }
    byDay.set(row.day, point);
  }

  const daily = Array.from(byDay.values()).sort((a, b) =>
    a.day.localeCompare(b.day)
  );
  const signups = signupRows.reduce((sum, r) => sum + Number(r.signups), 0);

  return {
    totals: {
      pageViews,
      ctaClicks,
      clickRate: computeClickRate(pageViews, ctaClicks),
      signups,
    },
    daily,
  };
}
