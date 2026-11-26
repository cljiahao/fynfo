-- Spec 201: per-member display name, sealed under K_h so the server never reads it.
-- Additive and nullable; no backfill (names are seeded client-side on first household load).
--
-- Rollback:
--   DROP FUNCTION public.set_household_member_name(text);
--   ALTER TABLE public.household_members DROP COLUMN display_name;
BEGIN;

ALTER TABLE public.household_members ADD COLUMN display_name text;

-- UPDATE on household_members stays revoked from authenticated (spec 197 hardening); this
-- definer function is the only write path and touches nothing but the caller's own row.
CREATE FUNCTION public.set_household_member_name(p_display_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_display_name IS NOT NULL AND length(p_display_name) > 1024 THEN
    RAISE EXCEPTION 'display name too long';
  END IF;
  UPDATE public.household_members SET display_name = p_display_name WHERE user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.set_household_member_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_household_member_name(text) TO authenticated;

COMMIT;
