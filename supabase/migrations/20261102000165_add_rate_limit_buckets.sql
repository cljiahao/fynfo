-- Generic fixed-window rate limiter for server routes (vault reset, anonymous
-- telemetry). Additive and non-destructive. Reachable only through the trusted
-- service-role RPC; the table itself is closed to every API role.
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL
);
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM PUBLIC, anon, authenticated, service_role;

-- Returns true while the caller is within p_max hits per p_window_seconds.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_hits integer;
BEGIN
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 200
    OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 10000
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;

  INSERT INTO public.rate_limit_buckets AS b(key, window_start, hits)
    VALUES (p_key, clock_timestamp(), 1)
    ON CONFLICT (key) DO UPDATE SET
      window_start = CASE
        WHEN b.window_start + make_interval(secs => p_window_seconds) <= clock_timestamp()
        THEN clock_timestamp() ELSE b.window_start END,
      hits = CASE
        WHEN b.window_start + make_interval(secs => p_window_seconds) <= clock_timestamp()
        THEN 1 ELSE b.hits + 1 END
    RETURNING b.hits INTO v_hits;

  -- Bounds table growth from one-off keys without a scheduled job.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_buckets AS stale WHERE stale.window_start < clock_timestamp() - interval '1 day';
  END IF;

  RETURN v_hits <= p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
