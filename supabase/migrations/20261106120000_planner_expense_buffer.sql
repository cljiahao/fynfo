------------------------------------------
-- Planner expense buffer (spec 176 amendment, A4).
-- Optional cushion over expenses, as a percent of expenses, stored with the
-- other planner settings. Non-sensitive number like tithe_pct.
--
-- Additive, idempotent and forward-only: safe to re-run.
------------------------------------------

ALTER TABLE public.planner_settings
  ADD COLUMN IF NOT EXISTS expense_buffer_pct NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_expense_buffer_pct_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_expense_buffer_pct_check
      CHECK (expense_buffer_pct BETWEEN 0 AND 100);
  END IF;
END $$;
