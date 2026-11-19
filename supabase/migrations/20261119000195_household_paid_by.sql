------------------------------------------
-- Household goal paid-by (spec 195).
-- Either household member may record, edit and delete a goal payment or
-- contribution on behalf of the other. The payer / contributor must still be a
-- member of the goal's own household, so an entry can never name an outsider.
-- No data or columns change.
--
-- Forward-only and idempotent: safe to re-run.
------------------------------------------

-- is_household_member only tests auth.uid(); this variant tests an arbitrary
-- user. SECURITY DEFINER reads household_members as owner to avoid the policy
-- recursion described in 20260626000000_add_household.sql.
CREATE OR REPLACE FUNCTION public.is_household_user(p_household_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_user(UUID, UUID) TO authenticated;

-- ── household_goal_payments ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members insert goal payments" ON public.household_goal_payments;
CREATE POLICY "Members insert goal payments" ON public.household_goal_payments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id
        AND public.is_household_member(g.household_id)
        AND public.is_household_user(g.household_id, payer_user_id)
    )
  );

DROP POLICY IF EXISTS "Members update goal payments" ON public.household_goal_payments;
CREATE POLICY "Members update goal payments" ON public.household_goal_payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id AND public.is_household_member(g.household_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id
        AND public.is_household_member(g.household_id)
        AND public.is_household_user(g.household_id, payer_user_id)
    )
  );

-- ── household_goal_contributions ────────────────────────────────────────────

DROP POLICY IF EXISTS "Members insert contributions" ON public.household_goal_contributions;
CREATE POLICY "Members insert contributions" ON public.household_goal_contributions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id
        AND public.is_household_member(g.household_id)
        AND public.is_household_user(g.household_id, contributor_user_id)
    )
  );

DROP POLICY IF EXISTS "Members update contributions" ON public.household_goal_contributions;
CREATE POLICY "Members update contributions" ON public.household_goal_contributions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id
        AND public.is_household_member(g.household_id)
        AND public.is_household_user(g.household_id, contributor_user_id)
    )
  );
