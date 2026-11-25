-- Spec 200 slice A: households of up to four members and per-goal membership.
--
-- Rollback (manual, in this order):
--   1. Drop public.household_goal_members (lossless for goal data).
--   2. Restore the cap: re-run enforce_household_member_cap() below with ">= 2", only if no
--      household has more than two members.
--   3. Recreate the leave policy:
--        CREATE POLICY "Member leaves own row" ON public.household_members
--          FOR DELETE USING (user_id = auth.uid());
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_household_member_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  -- A row version also makes stale REPEATABLE READ writers fail safely.
  UPDATE public.households SET name = name WHERE id = NEW.household_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'household not valid'; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT count(*) INTO v_count FROM public.household_members
      WHERE household_id = NEW.household_id AND id <> OLD.id;
  ELSE
    SELECT count(*) INTO v_count FROM public.household_members WHERE household_id = NEW.household_id;
  END IF;
  IF v_count >= 4 THEN RAISE EXCEPTION 'household is full'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_household_member_cap() FROM PUBLIC, authenticated, anon;

-- Leaving a household needs K_h rotation (not built yet), so members cannot delete their own row.
DROP POLICY IF EXISTS "Member leaves own row" ON public.household_members;

CREATE TABLE public.household_goal_members (
  goal_id  uuid NOT NULL REFERENCES public.household_goals(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, user_id)
);
CREATE INDEX idx_household_goal_members_user ON public.household_goal_members(user_id);

CREATE FUNCTION public.enforce_goal_member_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_household uuid;
  v_count integer;
BEGIN
  -- Locking the goal row serializes concurrent joins so the cap cannot be overshot.
  SELECT household_id INTO v_household FROM public.household_goals WHERE id = NEW.goal_id FOR UPDATE;
  IF v_household IS NULL THEN RAISE EXCEPTION 'goal not valid'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = v_household AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'user is not a household member';
  END IF;
  SELECT count(*) INTO v_count FROM public.household_goal_members WHERE goal_id = NEW.goal_id;
  IF v_count >= 4 THEN RAISE EXCEPTION 'goal is full'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_goal_member_rules() FROM PUBLIC, authenticated, anon;
CREATE TRIGGER trg_goal_member_rules BEFORE INSERT ON public.household_goal_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_goal_member_rules();

CREATE FUNCTION public.is_goal_household_member(p_goal_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_goals g
    JOIN public.household_members m ON m.household_id = g.household_id
    WHERE g.id = p_goal_id AND m.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_goal_household_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_goal_household_member(uuid) TO authenticated;

ALTER TABLE public.household_goal_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read goal members" ON public.household_goal_members
  FOR SELECT USING (public.is_goal_household_member(goal_id));
CREATE POLICY "Member joins goal as self" ON public.household_goal_members
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_goal_household_member(goal_id));
CREATE POLICY "Member leaves goal as self" ON public.household_goal_members
  FOR DELETE USING (user_id = auth.uid());

INSERT INTO public.household_goal_members (goal_id, user_id)
SELECT g.id, m.user_id
FROM public.household_goals g
JOIN public.household_members m ON m.household_id = g.household_id
ON CONFLICT DO NOTHING;

COMMIT;
