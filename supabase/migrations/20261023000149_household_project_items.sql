------------------------------------------
-- Household project breakdown (spec 149).
-- A goal (spec 054) gains budget lines ("items") and payments against them.
-- Item name/budget and payment amount/note are AES-256-GCM encrypted under the
-- household key K_h, like goals and contributions. Payment date is plaintext
-- coarse metadata (§5.4).
--
-- Additive and idempotent: safe to re-run.
------------------------------------------

CREATE TABLE IF NOT EXISTS public.household_goal_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID NOT NULL REFERENCES public.household_goals(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- encrypted under K_h
  budget      TEXT NOT NULL,                 -- encrypted under K_h
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_goal_items_goal ON public.household_goal_items(goal_id);

CREATE TABLE IF NOT EXISTS public.household_goal_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID NOT NULL REFERENCES public.household_goal_items(id) ON DELETE CASCADE,
  payer_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         TEXT NOT NULL,              -- encrypted under K_h
  note           TEXT,                       -- encrypted under K_h, optional
  date           DATE NOT NULL,              -- plaintext
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_goal_payments_item ON public.household_goal_payments(item_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.household_goal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_goal_payments ENABLE ROW LEVEL SECURITY;

-- Items: any member of the parent goal's household reads, inserts and deletes.
DROP POLICY IF EXISTS "Members read goal items" ON public.household_goal_items;
CREATE POLICY "Members read goal items" ON public.household_goal_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );
DROP POLICY IF EXISTS "Members insert goal items" ON public.household_goal_items;
CREATE POLICY "Members insert goal items" ON public.household_goal_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );
DROP POLICY IF EXISTS "Members delete goal items" ON public.household_goal_items;
CREATE POLICY "Members delete goal items" ON public.household_goal_items
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );

-- Payments: gated through item → goal → household; the payer inserts as self.
DROP POLICY IF EXISTS "Members read goal payments" ON public.household_goal_payments;
CREATE POLICY "Members read goal payments" ON public.household_goal_payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id AND public.is_household_member(g.household_id)
    )
  );
DROP POLICY IF EXISTS "Members insert goal payments" ON public.household_goal_payments;
CREATE POLICY "Members insert goal payments" ON public.household_goal_payments
  FOR INSERT TO authenticated WITH CHECK (
    payer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id AND public.is_household_member(g.household_id)
    )
  );
DROP POLICY IF EXISTS "Members delete goal payments" ON public.household_goal_payments;
CREATE POLICY "Members delete goal payments" ON public.household_goal_payments
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.household_goal_items i
      JOIN public.household_goals g ON g.id = i.goal_id
      WHERE i.id = item_id AND public.is_household_member(g.household_id)
    )
  );

-- Rows are immutable once written; edits are delete and re-add.
REVOKE UPDATE ON public.household_goal_items FROM authenticated, anon;
REVOKE UPDATE ON public.household_goal_payments FROM authenticated, anon;
