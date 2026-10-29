------------------------------------------
-- Insert-only statement import with splits (spec 155).
-- Inserts a group of imported expense records and their splits in one
-- transaction. An existing id raises 23505 and rolls back the whole group;
-- nothing is ever updated. Values are ciphertext except date, type and
-- split_type, as in replace_expense_record.
--
-- Additive: rollback is DROP FUNCTION public.insert_imported_expenses(jsonb, jsonb);
------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.insert_imported_expenses(p_records jsonb, p_splits jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF pg_catalog.jsonb_typeof(p_records) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(p_splits) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(p_records) NOT BETWEEN 1 AND 100
    OR pg_catalog.jsonb_array_length(p_splits) > 5000
    OR pg_catalog.octet_length(p_records::text) > 4194304
    OR pg_catalog.octet_length(p_splits::text) > 4194304
  THEN RAISE EXCEPTION 'invalid import' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_records) AS r
    WHERE pg_catalog.jsonb_typeof(r) IS DISTINCT FROM 'object'
      OR EXISTS (
        SELECT 1 FROM (VALUES ('id'),('date'),('type'),('item'),('info'),('amount'),('split_type')) AS k(name)
        WHERE pg_catalog.jsonb_typeof(r->k.name) IS DISTINCT FROM 'string'
      )
      OR pg_catalog.length(r->>'id') NOT BETWEEN 1 AND 200
      OR pg_catalog.length(r->>'amount') = 0
      OR r->>'date' !~ '^\d{4}-\d{2}-\d{2}T'
      OR r->>'type' NOT IN ('bills','charity','electronics','entertainment','food_drink','gift','groceries','health','insurance','other','shopping','subscriptions','transport','travel')
      OR r->>'split_type' NOT IN ('self','shared')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_records) AS r
    GROUP BY r->>'id' HAVING pg_catalog.count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_splits) AS s
    WHERE pg_catalog.jsonb_typeof(s) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(s->'id') IS DISTINCT FROM 'string'
      OR pg_catalog.length(s->>'id') NOT BETWEEN 1 AND 200
      OR pg_catalog.jsonb_typeof(s->'expense_id') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(s->'person') IS DISTINCT FROM 'string'
      OR pg_catalog.length(s->>'person') = 0
      OR pg_catalog.jsonb_typeof(s->'amount') IS DISTINCT FROM 'string'
      OR pg_catalog.length(s->>'amount') = 0
      OR pg_catalog.jsonb_typeof(s->'settled') IS DISTINCT FROM 'boolean'
      -- Each split belongs to a shared record in this group.
      OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_records) AS r
        WHERE r->>'id' = s->>'expense_id' AND r->>'split_type' = 'shared'
      )
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_splits) AS s
    GROUP BY s->>'id' HAVING pg_catalog.count(*) > 1
  ) OR EXISTS (
    -- Each shared record has at least one split.
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_records) AS r
    WHERE r->>'split_type' = 'shared' AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_splits) AS s
      WHERE s->>'expense_id' = r->>'id'
    )
  ) THEN RAISE EXCEPTION 'invalid import fields' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.expense_records(id, user_id, date, type, item, info, amount, split_type)
    SELECT r->>'id', v_user, (r->>'date')::timestamptz, r->>'type', r->>'item',
      r->>'info', r->>'amount', r->>'split_type'
    FROM pg_catalog.jsonb_array_elements(p_records) AS r;
  INSERT INTO public.expense_splits(id, expense_id, person, amount, settled)
    SELECT s->>'id', s->>'expense_id', s->>'person', s->>'amount', (s->>'settled')::boolean
    FROM pg_catalog.jsonb_array_elements(p_splits) AS s;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_imported_expenses(jsonb,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.insert_imported_expenses(jsonb,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
