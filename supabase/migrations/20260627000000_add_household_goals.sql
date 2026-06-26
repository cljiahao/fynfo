------------------------------------------
-- Household MVP: big-item purchase goals (spec 054).
-- Builds on spec 053 (households + is_household_member()). Goal name/amount and
-- contribution amount/note are AES-256-GCM encrypted under the household key K_h
-- (zero-knowledge, §2.1/§5.1a). target_date / date are plaintext coarse metadata
-- (non-sensitive, never filtered or sorted on per §5.4).
--
-- Idempotent — safe to re-run.
------------------------------------------

CREATE TABLE IF NOT EXISTS public.household_goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                 -- encrypted under K_h
  target_amount TEXT NOT NULL,                 -- encrypted under K_h
  target_date   DATE,                          -- plaintext, optional
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_goals_household ON public.household_goals(household_id);

CREATE TABLE IF NOT EXISTS public.household_goal_contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id             UUID NOT NULL REFERENCES public.household_goals(id) ON DELETE CASCADE,
  contributor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              TEXT NOT NULL,           -- encrypted under K_h
  note                TEXT,                    -- encrypted under K_h, optional
  date                DATE NOT NULL,           -- plaintext
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_goal_contributions_goal ON public.household_goal_contributions(goal_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.household_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_goal_contributions ENABLE ROW LEVEL SECURITY;

-- household_goals: any household member reads/updates/deletes; the creator inserts.
DROP POLICY IF EXISTS "Members read goals" ON public.household_goals;
CREATE POLICY "Members read goals" ON public.household_goals
  FOR SELECT USING (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Members insert goals" ON public.household_goals;
CREATE POLICY "Members insert goals" ON public.household_goals
  FOR INSERT WITH CHECK (
    public.is_household_member(household_id) AND created_by = auth.uid()
  );
DROP POLICY IF EXISTS "Members update goals" ON public.household_goals;
CREATE POLICY "Members update goals" ON public.household_goals
  FOR UPDATE USING (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Members delete goals" ON public.household_goals;
CREATE POLICY "Members delete goals" ON public.household_goals
  FOR DELETE USING (public.is_household_member(household_id));

-- household_goal_contributions: gated through the parent goal's household.
DROP POLICY IF EXISTS "Members read contributions" ON public.household_goal_contributions;
CREATE POLICY "Members read contributions" ON public.household_goal_contributions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );
DROP POLICY IF EXISTS "Members insert contributions" ON public.household_goal_contributions;
CREATE POLICY "Members insert contributions" ON public.household_goal_contributions
  FOR INSERT WITH CHECK (
    contributor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );
DROP POLICY IF EXISTS "Members delete contributions" ON public.household_goal_contributions;
CREATE POLICY "Members delete contributions" ON public.household_goal_contributions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND public.is_household_member(g.household_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_goal_contributions TO authenticated;
