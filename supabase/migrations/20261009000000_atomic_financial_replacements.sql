-- Spec077: invoker transactions preserve RLS and encrypted payloads.
BEGIN;

CREATE FUNCTION public.replace_asset_snapshot(
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
    UPDATE public.monthly_snapshots SET month = p_month, updated_at = pg_catalog.now()
      WHERE id = v_parent AND user_id = v_user;
  ELSE
    INSERT INTO public.monthly_snapshots(id, user_id, month)
      VALUES (p_new_id, v_user, p_month)
      ON CONFLICT (user_id, month) DO UPDATE SET updated_at = pg_catalog.now()
      RETURNING id INTO v_parent;
  END IF;
  DELETE FROM public.asset_entries WHERE snapshot_id = v_parent;
  INSERT INTO public.asset_entries(id, snapshot_id, category, account, amount)
    SELECT e->>'id', v_parent, e->>'category', e->>'account', e->>'amount'
    FROM pg_catalog.jsonb_array_elements(p_entries) AS e;
END;
$$;

CREATE FUNCTION public.replace_expense_record(p_record jsonb, p_splits jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_parent text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF pg_catalog.jsonb_typeof(p_record) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(p_splits) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid expense' USING ERRCODE = '22023'; END IF;
  IF pg_catalog.octet_length(p_record::text) > 1048576
    OR EXISTS (
      SELECT 1 FROM (VALUES ('id'),('date'),('type'),('item'),('info'),('amount'),('split_type')) AS k(name)
      WHERE pg_catalog.jsonb_typeof(p_record->k.name) IS DISTINCT FROM 'string'
    ) OR pg_catalog.length(p_record->>'id') NOT BETWEEN 1 AND 200
    OR pg_catalog.length(p_record->>'amount') = 0
    OR p_record->>'date' !~ '^\d{4}-\d{2}-\d{2}T'
    OR p_record->>'type' NOT IN ('bills','charity','electronics','entertainment','food_drink','gift','groceries','health','insurance','other','shopping','subscriptions','transport','travel')
    OR p_record->>'split_type' NOT IN ('self','shared')
    OR pg_catalog.jsonb_array_length(p_splits) > 5000
    OR pg_catalog.octet_length(p_splits::text) > 1048576
    OR (p_record->>'split_type' = 'self' AND pg_catalog.jsonb_array_length(p_splits) <> 0)
    OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_splits) AS s
      WHERE pg_catalog.jsonb_typeof(s) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(s->'id') IS DISTINCT FROM 'string'
        OR pg_catalog.length(s->>'id') NOT BETWEEN 1 AND 200
        OR pg_catalog.jsonb_typeof(s->'person') IS DISTINCT FROM 'string'
        OR pg_catalog.length(s->>'person') = 0
        OR pg_catalog.jsonb_typeof(s->'amount') IS DISTINCT FROM 'string'
        OR pg_catalog.length(s->>'amount') = 0
        OR pg_catalog.jsonb_typeof(s->'settled') IS DISTINCT FROM 'boolean'
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_splits) AS s
      GROUP BY s->>'id' HAVING pg_catalog.count(*) > 1
    ) THEN RAISE EXCEPTION 'invalid expense fields' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.expense_records(id, user_id, date, type, item, info, amount, split_type)
    VALUES (p_record->>'id', v_user, (p_record->>'date')::timestamptz,
      p_record->>'type', p_record->>'item', p_record->>'info', p_record->>'amount', p_record->>'split_type')
    ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, type = EXCLUDED.type,
      item = EXCLUDED.item, info = EXCLUDED.info, amount = EXCLUDED.amount,
      split_type = EXCLUDED.split_type, updated_at = pg_catalog.now()
    RETURNING id INTO v_parent;
  DELETE FROM public.expense_splits WHERE expense_id = v_parent;
  INSERT INTO public.expense_splits(id, expense_id, person, amount, settled)
    SELECT s->>'id', v_parent, s->>'person', s->>'amount', (s->>'settled')::boolean
    FROM pg_catalog.jsonb_array_elements(p_splits) AS s;
END;
$$;

CREATE FUNCTION public.replace_tax_relief_year(p_year integer, p_reliefs jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_year IS NULL OR p_year <= 0
    OR pg_catalog.jsonb_typeof(p_reliefs) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid relief year' USING ERRCODE = '22023'; END IF;
  IF pg_catalog.jsonb_array_length(p_reliefs) > 5000
    OR pg_catalog.octet_length(p_reliefs::text) > 1048576
    OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_reliefs) AS r
      WHERE pg_catalog.jsonb_typeof(r) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(r->'id') IS DISTINCT FROM 'string'
        OR pg_catalog.length(r->>'id') NOT BETWEEN 1 AND 200
        OR pg_catalog.jsonb_typeof(r->'relief_key') IS DISTINCT FROM 'string'
        OR pg_catalog.length(r->>'relief_key') NOT BETWEEN 1 AND 200
        OR pg_catalog.jsonb_typeof(r->'amount') IS DISTINCT FROM 'string'
        OR pg_catalog.length(r->>'amount') = 0
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_reliefs) AS r
      GROUP BY r->>'id' HAVING pg_catalog.count(*) > 1
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_reliefs) AS r
      GROUP BY r->>'relief_key' HAVING pg_catalog.count(*) > 1
    ) THEN RAISE EXCEPTION 'invalid relief entries' USING ERRCODE = '22023'; END IF;

  -- Waiting must refresh the subsequent DELETE snapshot, including an empty year.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'relief replacement requires read committed' USING ERRCODE = '25000';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fynfo:reliefs:' || v_user::text || ':' || p_year::text, 0)
  );
  DELETE FROM public.tax_relief_entries WHERE user_id = v_user AND year = p_year;
  INSERT INTO public.tax_relief_entries(id, user_id, year, relief_key, amount)
    SELECT r->>'id', v_user, p_year, r->>'relief_key', r->>'amount'
    FROM pg_catalog.jsonb_array_elements(p_reliefs) AS r;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_asset_snapshot(text,text,text,jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.replace_expense_record(jsonb,jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.replace_tax_relief_year(integer,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.replace_asset_snapshot(text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_expense_record(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_tax_relief_year(integer,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
