------------------------------------------
-- Planner freedom-projection assumptions (spec 184, S2).
-- The owner's real return, withdrawal rate and optional target year, stored
-- with the other planner settings. Non-sensitive numbers like tithe_pct; NULL
-- means "unset". Existing own-row RLS on planner_settings covers the columns.
--
-- Additive, idempotent and forward-only: safe to re-run.
------------------------------------------

ALTER TABLE public.planner_settings
  ADD COLUMN IF NOT EXISTS freedom_real_return_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS freedom_withdrawal_rate_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS freedom_target_year INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_freedom_real_return_pct_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_freedom_real_return_pct_check
      CHECK (freedom_real_return_pct BETWEEN 0 AND 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_freedom_withdrawal_rate_pct_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_freedom_withdrawal_rate_pct_check
      CHECK (freedom_withdrawal_rate_pct BETWEEN 1 AND 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_freedom_target_year_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_freedom_target_year_check
      CHECK (freedom_target_year BETWEEN 2000 AND 2200);
  END IF;
END $$;
