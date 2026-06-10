-- Anonymous, non-PII marketing telemetry (gov-013 / spec 004).
-- Aggregate counts only: NO user_id, NO IP, NO user-agent, NO identifiers.
-- Forward-only (CONSTITUTION §6.3). Idempotent — safe to re-run.
-- Tracked by specs/feature/004-storefront-moat-telemetry-admin.md.

CREATE TABLE IF NOT EXISTS public.marketing_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'cta_click')),
  path       text NOT NULL CHECK (char_length(path) <= 128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_type_created
  ON public.marketing_events (event_type, created_at);

ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- Ingestion: anyone (anon or authenticated) may INSERT a valid telemetry row,
-- and nothing else. The CHECK re-enforces type + path-length at the policy
-- layer; no row carries identity. Satisfies §5.2 (explicit policy, no GRANT ALL).
DROP POLICY IF EXISTS marketing_events_insert ON public.marketing_events;
CREATE POLICY marketing_events_insert
  ON public.marketing_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type IN ('page_view', 'cta_click')
    AND char_length(path) <= 128
  );

-- No SELECT/UPDATE/DELETE policy: raw rows are unreadable by any session
-- (default-deny). Reads happen only through the SECURITY DEFINER aggregate
-- functions below — same tamper-resistant pattern as vault_unlock_attempts.

-- Aggregate marketing-event counts per day per type (non-PII).
CREATE OR REPLACE FUNCTION public.get_marketing_event_stats()
RETURNS TABLE (day date, event_type text, events bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_at::date AS day, event_type, count(*) AS events
    FROM public.marketing_events
   GROUP BY created_at::date, event_type
   ORDER BY day;
$$;

-- Signup counts per day. users_profile RLS is own-row, so an admin session
-- cannot count all users directly; this definer function bridges that for
-- non-PII aggregate counts only (no emails, no ids returned).
CREATE OR REPLACE FUNCTION public.get_signup_stats()
RETURNS TABLE (day date, signups bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_at::date AS day, count(*) AS signups
    FROM public.users_profile
   GROUP BY created_at::date
   ORDER BY day;
$$;

REVOKE ALL ON FUNCTION public.get_marketing_event_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketing_event_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.get_signup_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signup_stats() TO authenticated;
