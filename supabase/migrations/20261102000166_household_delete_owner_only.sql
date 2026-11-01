-- Deleting a household cascades the partner's household data, so only the
-- creator may do it. Members still leave by deleting their own roster row.
DROP POLICY IF EXISTS "Members delete own household" ON public.households;
DROP POLICY IF EXISTS "Owner deletes own household" ON public.households;
CREATE POLICY "Owner deletes own household" ON public.households
  FOR DELETE USING (created_by = auth.uid());
