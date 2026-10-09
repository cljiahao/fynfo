-- Disposable fixture only: direct roles, ownership, validation and rollback.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('79000000-0000-0000-0000-000000000001'),
 ('79000000-0000-0000-0000-000000000002');
CREATE FUNCTION pg_temp.expect_failure(query text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE query;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN RAISE; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'REGRESSION: operation unexpectedly succeeded: %', query;
END $$;
DO $$
DECLARE f regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.replace_asset_snapshot(text,text,text,jsonb)'::regprocedure,
    'public.replace_expense_record(jsonb,jsonb)'::regprocedure,
    'public.replace_tax_relief_year(integer,jsonb)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon',f,'EXECUTE')
      OR has_function_privilege('service_role',f,'EXECUTE')
      OR NOT has_function_privilege('authenticated',f,'EXECUTE')
      OR (SELECT prosecdef FROM pg_proc WHERE oid=f)
      OR (SELECT proconfig FROM pg_proc WHERE oid=f) <> ARRAY['search_path=""']
    THEN RAISE EXCEPTION 'REGRESSION: function privilege/configuration'; END IF;
  END LOOP;
END $$;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-01',NULL,'anon','[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_expense_record('{}','[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,'[]')$q$,'42501');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,'[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-01',NULL,'x','[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_expense_record('{}','[]')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','79000000-0000-0000-0000-000000000001',true);
SELECT public.replace_asset_snapshot('2026-01',NULL,'owner-snapshot',
 '[{"id":"old-asset","category":"savings","account":"fixture-account","amount":"fixture-amount","snapshot_id":"forged","user_id":"forged"}]');
SELECT public.replace_expense_record(
 '{"id":"owner-expense","date":"2026-01-01T00:00:00Z","type":"other","item":"fixture-item","info":"fixture-info","amount":"fixture-amount","split_type":"shared","user_id":"forged"}',
 '[{"id":"old-split","person":"Fixture","amount":"fixture-share","settled":true,"expense_id":"forged"}]');
SELECT public.replace_tax_relief_year(2026,
 '[{"id":"old-relief","relief_key":"cpf","amount":"fixture-amount","year":9999,"user_id":"forged"}]');
DO $$ BEGIN
  IF (SELECT snapshot_id FROM public.asset_entries WHERE id='old-asset') <> 'owner-snapshot'
    OR (SELECT expense_id FROM public.expense_splits WHERE id='old-split') <> 'owner-expense'
    OR NOT (SELECT settled FROM public.expense_splits WHERE id='old-split')
    OR (SELECT year FROM public.tax_relief_entries WHERE id='old-relief') <> 2026
    OR (SELECT user_id FROM public.tax_relief_entries WHERE id='old-relief') <> auth.uid()
  THEN RAISE EXCEPTION 'REGRESSION: database ownership derivation'; END IF;
END $$;
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-13',NULL,'x','[]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-01',NULL,'x',NULL)$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-01',NULL,'x','{}')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-01',NULL,'x','[{}]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_expense_record('{}','[]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,'[null]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,'[{"id":"a","relief_key":"cpf","amount":"x"},{"id":"b","relief_key":"cpf","amount":"x"}]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(0,'[]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,(SELECT jsonb_agg(jsonb_build_object('id',g::text,'relief_key',g::text,'amount','x')) FROM generate_series(1,5001) g))$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,jsonb_build_array(jsonb_build_object('id','x','relief_key','cpf','amount',repeat('x',1048576))))$q$,'22023');
DO $$
DECLARE
  bad jsonb;
  expense jsonb := '{"id":"owner-expense","date":"2026-01-01T00:00:00Z","type":"other","item":"x","info":"x","amount":"x","split_type":"shared"}';
BEGIN
  FOR bad IN SELECT value FROM jsonb_array_elements('[null,{},42,"text",[null],[{}],[{"id":"x","category":"unknown","account":"x","amount":"x"}],[{"id":"x","category":"savings","account":"x","amount":42}],[{"id":"x","category":"savings","account":"x","amount":"x"},{"id":"x","category":"savings","account":"x","amount":"x"}]]') LOOP
    PERFORM pg_temp.expect_failure(format('SELECT public.replace_asset_snapshot(''2026-01'',NULL,''x'',%L::jsonb)',bad::text),'22023');
  END LOOP;
  FOR bad IN SELECT value FROM jsonb_array_elements('[null,{},42,"text",[null],[{}],[{"id":"x","person":"Fixture","amount":"x","settled":"false"}],[{"id":"x","person":"Fixture","amount":42,"settled":false}],[{"id":"x","person":"Fixture","amount":"x","settled":false},{"id":"x","person":"Fixture","amount":"x","settled":false}]]') LOOP
    PERFORM pg_temp.expect_failure(format('SELECT public.replace_expense_record(%L::jsonb,%L::jsonb)',expense::text,bad::text),'22023');
  END LOOP;
  PERFORM pg_temp.expect_failure(format('SELECT public.replace_expense_record(%L::jsonb,''[]'')',(expense || '{"type":"unknown"}')::text),'22023');
  PERFORM pg_temp.expect_failure(format('SELECT public.replace_expense_record(%L::jsonb,''[]'')',(expense || '{"date":"2026-99-99T00:00:00Z"}')::text),'22008');
  PERFORM pg_temp.expect_failure(format('SELECT public.replace_expense_record(%L::jsonb,''[{"id":"x","person":"Fixture","amount":"x","settled":false}]'')',(expense || '{"split_type":"self"}')::text),'22023');
  FOR bad IN SELECT value FROM jsonb_array_elements('[null,{},42,"text",[null],[{}],[{"id":"","relief_key":"cpf","amount":"x"}],[{"id":"x","relief_key":"cpf","amount":42}],[{"id":"x","relief_key":"cpf","amount":"x"},{"id":"x","relief_key":"srs","amount":"x"}]]') LOOP
    PERFORM pg_temp.expect_failure(format('SELECT public.replace_tax_relief_year(2026,%L::jsonb)',bad::text),'22023');
  END LOOP;
END $$;

-- A colliding child ID fails after the parent write and DELETE, exercising rollback.
SELECT public.replace_asset_snapshot('2026-02',NULL,'collision-snapshot',
 '[{"id":"collision-asset","category":"savings","account":"x","amount":"x"}]');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-03','2026-01','unused','[{"id":"first-asset","category":"savings","account":"x","amount":"x"},{"id":"collision-asset","category":"savings","account":"x","amount":"x"}]')$q$,'23505');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-02','2026-01','unused','[]')$q$,'23505');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-03','2025-01','unused','[]')$q$,'22023');
SELECT public.replace_expense_record(
 '{"id":"collision-expense","date":"2026-01-01T00:00:00Z","type":"other","item":"x","info":"x","amount":"x","split_type":"shared"}',
 '[{"id":"collision-split","person":"Fixture","amount":"x","settled":false}]');
SELECT pg_temp.expect_failure($q$SELECT public.replace_expense_record('{"id":"owner-expense","date":"2026-02-01T00:00:00Z","type":"other","item":"changed","info":"x","amount":"changed","split_type":"shared"}','[{"id":"first-split","person":"Fixture","amount":"x","settled":false},{"id":"collision-split","person":"Fixture","amount":"x","settled":false}]')$q$,'23505');
SELECT public.replace_tax_relief_year(2025,'[{"id":"collision-relief","relief_key":"cpf","amount":"x"}]');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,'[{"id":"first-relief","relief_key":"cpf","amount":"x"},{"id":"collision-relief","relief_key":"srs","amount":"x"}]')$q$,'23505');
DO $$ BEGIN
 IF (SELECT month FROM public.monthly_snapshots WHERE id='owner-snapshot') <> '2026-01'
   OR (SELECT count(*) FROM public.asset_entries WHERE snapshot_id='owner-snapshot') <> 1
   OR NOT EXISTS (SELECT 1 FROM public.asset_entries WHERE id='old-asset')
   OR (SELECT item FROM public.expense_records WHERE id='owner-expense') <> 'fixture-item'
   OR NOT EXISTS (SELECT 1 FROM public.expense_splits WHERE id='old-split' AND settled)
   OR NOT EXISTS (SELECT 1 FROM public.tax_relief_entries WHERE id='old-relief' AND year=2026)
   OR EXISTS (SELECT 1 FROM public.asset_entries WHERE id='first-asset')
   OR EXISTS (SELECT 1 FROM public.expense_splits WHERE id='first-split')
   OR EXISTS (SELECT 1 FROM public.tax_relief_entries WHERE id='first-relief')
 THEN RAISE EXCEPTION 'REGRESSION: partial replacement committed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','79000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.expect_failure($q$SELECT public.replace_expense_record('{"id":"owner-expense","date":"2026-01-01T00:00:00Z","type":"other","item":"x","info":"x","amount":"x","split_type":"self"}','[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-01',NULL,'owner-snapshot','[]')$q$,'23505');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot('2026-03','2026-01','unused','[]')$q$,'22023');
SELECT public.replace_tax_relief_year(2026,'[]');
SELECT public.replace_asset_snapshot('2026-01',NULL,'other-snapshot',
 '[{"id":"other-asset","category":"savings","account":"x","amount":"x","snapshot_id":"owner-snapshot"}]');
SELECT pg_temp.expect_failure($q$SELECT public.replace_tax_relief_year(2026,'[{"id":"old-relief","relief_key":"srs","amount":"x"}]')$q$,'23505');
SELECT set_config('request.jwt.claim.sub','79000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tax_relief_entries WHERE id='old-relief')
  OR (SELECT item FROM public.expense_records WHERE id='owner-expense') <> 'fixture-item'
  OR (SELECT count(*) FROM public.asset_entries WHERE snapshot_id='owner-snapshot') <> 1
 THEN RAISE EXCEPTION 'REGRESSION: cross-owner write'; END IF;
END $$;
SELECT public.replace_asset_snapshot('2026-01',NULL,'replacement-id','[]');
SELECT public.replace_asset_snapshot('2026-03','2026-01','ignored-id','[]');
DO $$ BEGIN
 IF (SELECT month FROM public.monthly_snapshots WHERE id='owner-snapshot') <> '2026-03'
   OR EXISTS (SELECT 1 FROM public.asset_entries WHERE snapshot_id='owner-snapshot')
 THEN RAISE EXCEPTION 'REGRESSION: parent identity or empty replacement'; END IF;
END $$;
SELECT public.replace_expense_record('{"id":"owner-expense","date":"2026-01-01T00:00:00Z","type":"other","item":"x","info":"x","amount":"x","split_type":"self"}','[]');
SELECT public.replace_tax_relief_year(2026,'[]');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.expense_splits WHERE expense_id='owner-expense')
  OR EXISTS (SELECT 1 FROM public.tax_relief_entries WHERE year=2026)
 THEN RAISE EXCEPTION 'REGRESSION: empty replacement'; END IF;
END $$;
ROLLBACK;
