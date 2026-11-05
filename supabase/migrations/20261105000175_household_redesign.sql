------------------------------------------
-- Household redesign (spec 175, slice A).
-- Adds the optional final quote on goal items, a monthly budget per spending
-- category, and the UPDATE access that editing items and payments needs.
-- quote, category and monthly_amount are AES-256-GCM encrypted under the
-- household key K_h; nothing here filters or sorts on them (§5.4).
--
-- Additive and idempotent: safe to re-run.
------------------------------------------

-- NULL means no final quote yet; the existing budget column is the estimate.
ALTER TABLE public.household_goal_items ADD COLUMN IF NOT EXISTS quote TEXT; -- encrypted under K_h

CREATE TABLE IF NOT EXISTS public.household_spending_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,               -- encrypted under K_h
  monthly_amount  TEXT NOT NULL,               -- encrypted under K_h
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_spending_budgets_household
  ON public.household_spending_budgets(household_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.household_spending_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read spending budgets" ON public.household_spending_budgets;
CREATE POLICY "Members read spending budgets" ON public.household_spending_budgets
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Members insert spending budgets" ON public.household_spending_budgets;
CREATE POLICY "Members insert spending budgets" ON public.household_spending_budgets
  FOR INSERT TO authenticated WITH CHECK (
    public.is_household_member(household_id) AND created_by = auth.uid()
  );
DROP POLICY IF EXISTS "Members update spending budgets" ON public.household_spending_budgets;
CREATE POLICY "Members update spending budgets" ON public.household_spending_budgets
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Members delete spending budgets" ON public.household_spending_budgets;
CREATE POLICY "Members delete spending budgets" ON public.household_spending_budgets
  FOR DELETE TO authenticated USING (public.is_household_member(household_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_spending_budgets TO authenticated;

-- ── Edit support for existing tables ────────────────────────────────────────
-- Migration 149 revoked UPDATE and 160 re-granted only SELECT, INSERT, DELETE.

GRANT UPDATE ON TABLE public.household_goal_items TO authenticated;
GRANT UPDATE ON TABLE public.household_goal_payments TO authenticated;

DROP POLICY IF EXISTS "Members update goal items" ON public.household_goal_items;
CREATE POLICY "Members update goal items" ON public.household_goal_items
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
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );

-- The payer stays fixed: the new row must still be the caller's own payment,
-- the same rule as INSERT, so a payment cannot be reassigned to the partner.
DROP POLICY IF EXISTS "Members update goal payments" ON public.household_goal_payments;
CREATE POLICY "Members update goal payments" ON public.household_goal_payments
  FOR UPDATE TO authenticated
  USING (
    payer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id AND public.is_household_member(g.household_id)
    )
  )
  WITH CHECK (
    payer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id AND public.is_household_member(g.household_id)
    )
  );

-- Contributions already have the UPDATE grant (20260627000000) but no UPDATE
-- policy, so an edit would match zero rows. Same rule as payments: only the
-- contributor edits their own entry and the contributor cannot change.
DROP POLICY IF EXISTS "Members update contributions" ON public.household_goal_contributions;
CREATE POLICY "Members update contributions" ON public.household_goal_contributions
  FOR UPDATE TO authenticated
  USING (
    contributor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  )
  WITH CHECK (
    contributor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );
