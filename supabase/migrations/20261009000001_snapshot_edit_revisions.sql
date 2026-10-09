-- Spec083: compare parent identity and lossless revision under the owner row lock.
BEGIN;
ALTER TABLE public.monthly_snapshots ADD COLUMN revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.replace_asset_snapshot(
  p_month text, p_original_month text, p_new_id text, p_entries jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_parent text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_month IS NULL OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
    OR (p_original_month IS NOT NULL AND p_original_month !~ '^\d{4}-(0[1-9]|1[0-2])$')
    OR p_new_id IS NULL OR pg_catalog.length(p_new_id) NOT BETWEEN 1 AND 200
    OR pg_catalog.jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid snapshot' USING ERRCODE = '22023'; END IF;
  IF pg_catalog.jsonb_array_length(p_entries) > 5000
    OR pg_catalog.octet_length(p_entries::text) > 1048576
    OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_entries) AS e
      WHERE pg_catalog.jsonb_typeof(e) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(e->'id') IS DISTINCT FROM 'string'
        OR pg_catalog.length(e->>'id') NOT BETWEEN 1 AND 200
        OR pg_catalog.jsonb_typeof(e->'category') IS DISTINCT FROM 'string'
        OR e->>'category' NOT IN ('savings','bonds','stocks','etf','non_equity','crypto','pension')
        OR pg_catalog.jsonb_typeof(e->'account') IS DISTINCT FROM 'string'
        OR pg_catalog.jsonb_typeof(e->'amount') IS DISTINCT FROM 'string'
        OR pg_catalog.length(e->>'amount') = 0
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_entries) AS e
      GROUP BY e->>'id' HAVING pg_catalog.count(*) > 1
    ) THEN RAISE EXCEPTION 'invalid snapshot entries' USING ERRCODE = '22023'; END IF;

  IF p_original_month IS NOT NULL THEN
    SELECT id INTO v_parent FROM public.monthly_snapshots
      WHERE user_id = v_user AND month = p_original_month FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'snapshot unavailable' USING ERRCODE = '22023'; END IF;
    UPDATE public.monthly_snapshots SET month = p_month, updated_at = pg_catalog.now(), revision = revision + 1
      WHERE id = v_parent AND user_id = v_user;
  ELSE
    INSERT INTO public.monthly_snapshots(id, user_id, month, revision)
      VALUES (p_new_id, v_user, p_month, 1)
      ON CONFLICT (user_id, month) DO UPDATE SET updated_at = pg_catalog.now(), revision = public.monthly_snapshots.revision + 1
      RETURNING id INTO v_parent;
  END IF;
  DELETE FROM public.asset_entries WHERE snapshot_id = v_parent;
  INSERT INTO public.asset_entries(id, snapshot_id, category, account, amount)
    SELECT e->>'id', v_parent, e->>'category', e->>'account', e->>'amount'
    FROM pg_catalog.jsonb_array_elements(p_entries) AS e;
END;
$$;


CREATE FUNCTION public.get_asset_snapshot_for_edit(p_month text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_month IS NULL OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
  THEN RAISE EXCEPTION 'invalid snapshot month' USING ERRCODE = '22023'; END IF;
  -- One statement binds the parent version to the encrypted child set.
  SELECT pg_catalog.jsonb_build_object(
    'snapshotId', s.id, 'id', s.month, 'revision', s.revision::text,
    'entries', COALESCE((SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('category', e.category, 'account', e.account, 'amount', e.amount)
      ORDER BY e.id) FROM public.asset_entries e WHERE e.snapshot_id = s.id), '[]'::jsonb)
  ) INTO v_result FROM public.monthly_snapshots s
    WHERE s.user_id = v_user AND s.month = p_month;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.replace_asset_snapshot_if_current(
  p_month text, p_original_month text, p_new_id text, p_expected_revision text,
  p_expected_snapshot_id text, p_entries jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_parent text;
  v_revision bigint;
  v_constraint text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_month IS NULL OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
    OR (p_original_month IS NOT NULL AND p_original_month !~ '^\d{4}-(0[1-9]|1[0-2])$')
    OR p_new_id IS NULL OR pg_catalog.length(p_new_id) NOT BETWEEN 1 AND 200
    OR pg_catalog.jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid snapshot' USING ERRCODE = '22023'; END IF;
  IF pg_catalog.jsonb_array_length(p_entries) > 5000
    OR pg_catalog.octet_length(p_entries::text) > 1048576
    OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_entries) AS e
      WHERE pg_catalog.jsonb_typeof(e) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(e->'id') IS DISTINCT FROM 'string'
        OR pg_catalog.length(e->>'id') NOT BETWEEN 1 AND 200
        OR pg_catalog.jsonb_typeof(e->'category') IS DISTINCT FROM 'string'
        OR e->>'category' NOT IN ('savings','bonds','stocks','etf','non_equity','crypto','pension')
        OR pg_catalog.jsonb_typeof(e->'account') IS DISTINCT FROM 'string'
        OR pg_catalog.jsonb_typeof(e->'amount') IS DISTINCT FROM 'string'
        OR pg_catalog.length(e->>'amount') = 0
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_entries) AS e
      GROUP BY e->>'id' HAVING pg_catalog.count(*) > 1
    ) THEN RAISE EXCEPTION 'invalid snapshot entries' USING ERRCODE = '22023'; END IF;


  IF p_original_month IS NULL THEN
    IF p_expected_revision IS NOT NULL OR p_expected_snapshot_id IS NOT NULL
    THEN RAISE EXCEPTION 'invalid create version' USING ERRCODE = '22023'; END IF;
    -- The unique insert arbitrates concurrent creates; never upsert unseen data.
    BEGIN
      INSERT INTO public.monthly_snapshots(id,user_id,month)
        VALUES (p_new_id,v_user,p_month) RETURNING id INTO v_parent;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'snapshot conflict' USING ERRCODE = 'PFS01';
    END;
  ELSE
    IF p_expected_revision IS NULL OR p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$'
      OR pg_catalog.length(p_expected_revision) > 19
      OR (pg_catalog.length(p_expected_revision) = 19 AND p_expected_revision > '9223372036854775807')
      OR p_expected_snapshot_id IS NULL OR pg_catalog.length(p_expected_snapshot_id) NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'invalid edit version' USING ERRCODE = '22023'; END IF;
    SELECT id, revision INTO v_parent,v_revision FROM public.monthly_snapshots
      WHERE user_id=v_user AND month=p_original_month FOR UPDATE;
    IF NOT FOUND OR v_parent <> p_expected_snapshot_id OR v_revision::text <> p_expected_revision
    THEN RAISE EXCEPTION 'snapshot conflict' USING ERRCODE = 'PFS01'; END IF;
  END IF;
  BEGIN
    PERFORM public.replace_asset_snapshot(p_month,COALESCE(p_original_month,p_month),p_new_id,p_entries);
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'monthly_snapshots_user_id_month_key' THEN
      RAISE EXCEPTION 'snapshot conflict' USING ERRCODE = 'PFS01';
    END IF;
    RAISE;
  END;
END;
$$;

CREATE FUNCTION public.delete_asset_snapshot_if_current(
  p_month text, p_expected_revision text, p_expected_snapshot_id text
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_parent text;
  v_revision bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_month IS NULL OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
    OR p_expected_revision IS NULL OR p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$'
    OR pg_catalog.length(p_expected_revision) > 19
    OR (pg_catalog.length(p_expected_revision) = 19 AND p_expected_revision > '9223372036854775807')
    OR p_expected_snapshot_id IS NULL OR pg_catalog.length(p_expected_snapshot_id) NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'invalid delete version' USING ERRCODE = '22023'; END IF;
  SELECT id,revision INTO v_parent,v_revision FROM public.monthly_snapshots
    WHERE user_id=v_user AND month=p_month FOR UPDATE;
  IF NOT FOUND OR v_parent <> p_expected_snapshot_id OR v_revision::text <> p_expected_revision
  THEN RAISE EXCEPTION 'snapshot conflict' USING ERRCODE = 'PFS01'; END IF;
  DELETE FROM public.monthly_snapshots WHERE id=v_parent AND user_id=v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.get_asset_snapshot_for_edit(text) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.replace_asset_snapshot_if_current(text,text,text,text,text,jsonb) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.delete_asset_snapshot_if_current(text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_asset_snapshot_for_edit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_asset_snapshot_if_current(text,text,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_asset_snapshot_if_current(text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
