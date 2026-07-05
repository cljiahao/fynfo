------------------------------------------
-- Fix: owner cannot create a household — RLS visibility deadlock (spec 066).
--
-- The household_members "Owner self-inserts member" INSERT policy checks
--   EXISTS (SELECT 1 FROM households h
--           WHERE h.id = household_id AND h.created_by = auth.uid())
-- but households' only SELECT policy is is_household_member(id). At creation
-- time the owner is not yet a member, so that EXISTS is RLS-filtered to empty
-- and the owner's member insert fails with 42501 (row-level security). Give the
-- creator SELECT visibility on their own household so the ownership check
-- resolves. Permissive policies OR together, so this only widens the creator's
-- view to households they created (created_by = auth.uid()).
--
-- Idempotent — safe to re-run.
------------------------------------------

DROP POLICY IF EXISTS "Creator reads own household" ON public.households;
CREATE POLICY "Creator reads own household" ON public.households
  FOR SELECT USING (created_by = auth.uid());
