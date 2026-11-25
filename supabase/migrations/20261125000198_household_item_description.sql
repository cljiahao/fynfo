------------------------------------------
-- Household goal item description (spec 198b).
-- Adds an optional short description per budget item. The value is sealed
-- under the household key exactly like name, so it is stored as ciphertext and
-- nothing filters or sorts on it (constitution 5.4).
--
-- Additive and idempotent: safe to re-run. NULL means no description, which is
-- how every existing row reads. Existing item RLS and the UPDATE grant already
-- cover the new column.
------------------------------------------

ALTER TABLE public.household_goal_items ADD COLUMN IF NOT EXISTS description TEXT;
