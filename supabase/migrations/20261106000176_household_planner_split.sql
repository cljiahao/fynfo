------------------------------------------
-- Household-aware planner (spec 176, slice S1).
-- Stores the agreed percentage split between the two household members (and
-- per-goal overrides) as one row per household, encrypted under the household
-- key K_h. Also adds the personal household planning horizon to
-- planner_settings.
--
-- Additive, idempotent and forward-only: safe to re-run.
------------------------------------------

CREATE TABLE IF NOT EXISTS public.household_planner_settings (
  household_id  UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  split         TEXT NOT NULL,                 -- encrypted under K_h
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.household_planner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read planner settings" ON public.household_planner_settings;
CREATE POLICY "Members read planner settings" ON public.household_planner_settings
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Members insert planner settings" ON public.household_planner_settings;
CREATE POLICY "Members insert planner settings" ON public.household_planner_settings
  FOR INSERT TO authenticated WITH CHECK (
    public.is_household_member(household_id) AND created_by = auth.uid()
  );
DROP POLICY IF EXISTS "Members update planner settings" ON public.household_planner_settings;
CREATE POLICY "Members update planner settings" ON public.household_planner_settings
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

-- The row is replaced, never removed; it cascades with the household.
GRANT SELECT, INSERT, UPDATE ON TABLE public.household_planner_settings TO authenticated;

-- Personal preference, non-sensitive integer like emergency_months.
ALTER TABLE public.planner_settings
  ADD COLUMN IF NOT EXISTS household_horizon_months INTEGER NOT NULL DEFAULT 24;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planner_settings_household_horizon_months_check'
  ) THEN
    ALTER TABLE public.planner_settings
      ADD CONSTRAINT planner_settings_household_horizon_months_check
      CHECK (household_horizon_months BETWEEN 1 AND 120);
  END IF;
END $$;
