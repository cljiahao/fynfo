------------------------------------------
-- Household shared spending and trips (spec 150).
-- A space groups shared spending: one ongoing "Household" space for day-to-day
-- costs, plus one per trip. Space name and each entry's category, amount and
-- note are AES-256-GCM encrypted under the household key K_h. Space kind, trip
-- dates and entry date are plaintext coarse metadata (§5.4).
--
-- Additive and idempotent: safe to re-run.
------------------------------------------

CREATE TABLE IF NOT EXISTS public.household_spaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('ongoing', 'trip')),
  name          TEXT NOT NULL,                 -- encrypted under K_h
  start_date    DATE,                          -- plaintext, trips only
  end_date      DATE,                          -- plaintext, trips only
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_spaces_household ON public.household_spaces(household_id);

CREATE TABLE IF NOT EXISTS public.household_spending (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       UUID NOT NULL REFERENCES public.household_spaces(id) ON DELETE CASCADE,
  payer_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,                -- plaintext
  category       TEXT NOT NULL,                -- encrypted under K_h
  amount         TEXT NOT NULL,                -- encrypted under K_h
  note           TEXT,                         -- encrypted under K_h, optional
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_spending_space ON public.household_spending(space_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.household_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_spending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read spaces" ON public.household_spaces;
CREATE POLICY "Members read spaces" ON public.household_spaces
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));
DROP POLICY IF EXISTS "Members insert spaces" ON public.household_spaces;
CREATE POLICY "Members insert spaces" ON public.household_spaces
  FOR INSERT TO authenticated WITH CHECK (
    public.is_household_member(household_id) AND created_by = auth.uid()
  );
DROP POLICY IF EXISTS "Members delete spaces" ON public.household_spaces;
CREATE POLICY "Members delete spaces" ON public.household_spaces
  FOR DELETE TO authenticated USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members read spending" ON public.household_spending;
CREATE POLICY "Members read spending" ON public.household_spending
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.household_spaces s
      WHERE s.id = space_id AND public.is_household_member(s.household_id)
    )
  );
DROP POLICY IF EXISTS "Members insert spending" ON public.household_spending;
CREATE POLICY "Members insert spending" ON public.household_spending
  FOR INSERT TO authenticated WITH CHECK (
    payer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_spaces s
      WHERE s.id = space_id AND public.is_household_member(s.household_id)
    )
  );
DROP POLICY IF EXISTS "Members delete spending" ON public.household_spending;
CREATE POLICY "Members delete spending" ON public.household_spending
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.household_spaces s
      WHERE s.id = space_id AND public.is_household_member(s.household_id)
    )
  );

-- Rows are immutable once written; edits are delete and re-add.
REVOKE UPDATE ON public.household_spaces FROM authenticated, anon;
REVOKE UPDATE ON public.household_spending FROM authenticated, anon;
