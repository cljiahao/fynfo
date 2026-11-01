-- Additive and idempotent. Migrations 149 and 150 enabled RLS but granted
-- nothing, so authenticated hit 42501 before any policy ran. No UPDATE: these
-- tables have no UPDATE policy.
GRANT SELECT, INSERT, DELETE ON TABLE public.household_goal_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.household_goal_payments TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.household_spaces TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.household_spending TO authenticated;
