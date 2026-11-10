------------------------------------------
-- Household time-phased planner (spec 183, slice S2).
-- Adds an optional due date per goal item so a deposit and its balance can
-- fall on different dates. due_date is plaintext coarse metadata like the goal
-- target_date and payment date; nothing here filters or sorts on it (§5.4).
--
-- Additive and idempotent: safe to re-run. NULL means the item falls on the
-- goal's target date. Existing item RLS and the UPDATE grant already cover it.
------------------------------------------

ALTER TABLE public.household_goal_items ADD COLUMN IF NOT EXISTS due_date DATE;
