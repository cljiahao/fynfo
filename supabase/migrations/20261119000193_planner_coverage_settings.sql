------------------------------------------
-- Planner coverage settings (spec 193, S3).
-- Insurance premiums as a percent of salary, plus the dividend coverage
-- threshold and share the allowance draws on. Non-sensitive numbers like
-- tithe_pct; NULL means "unset" and the app falls back to its defaults
-- (5, 25, 50). Existing own-row RLS on planner_settings covers the columns.
--
-- Additive, idempotent and forward-only: safe to re-run.
------------------------------------------

ALTER TABLE public.planner_settings
  ADD COLUMN IF NOT EXISTS insurance_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS dividend_spend_threshold_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS dividend_spend_share_pct NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_insurance_pct_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_insurance_pct_check
      CHECK (insurance_pct BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_dividend_spend_threshold_pct_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_dividend_spend_threshold_pct_check
      CHECK (dividend_spend_threshold_pct BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_dividend_spend_share_pct_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_dividend_spend_share_pct_check
      CHECK (dividend_spend_share_pct BETWEEN 0 AND 100);
  END IF;
END $$;
