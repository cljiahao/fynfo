-- Spec083: disposable owner fixtures, never production records.
BEGIN;
DO $$ BEGIN
 IF (SELECT revision FROM public.monthly_snapshots WHERE id='pre-revision-parent') <> 0
  OR (SELECT month FROM public.monthly_snapshots WHERE id='pre-revision-parent') <> '2025-01'
  OR (SELECT created_at FROM public.monthly_snapshots WHERE id='pre-revision-parent') <> '2025-01-01T00:00:00Z'::timestamptz
  OR (SELECT updated_at FROM public.monthly_snapshots WHERE id='pre-revision-parent') <> '2025-01-02T00:00:00Z'::timestamptz
  OR (SELECT account FROM public.asset_entries WHERE id='pre-revision-child') <> 'fixture-opaque-account'
  OR (SELECT amount FROM public.asset_entries WHERE id='pre-revision-child') <> 'fixture-opaque-amount'
 THEN RAISE EXCEPTION 'REGRESSION: additive migration changed existing records'; END IF;
END $$;
INSERT INTO auth.users(id) VALUES
 ('83000000-0000-0000-0000-000000000001'),
 ('83000000-0000-0000-0000-000000000002');
CREATE OR REPLACE FUNCTION pg_temp.expect_failure(query text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN EXECUTE query;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> expected_state THEN RAISE; END IF; RETURN; END;
  RAISE EXCEPTION 'REGRESSION: operation unexpectedly succeeded';
END $$;
DO $$ DECLARE f regprocedure; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_asset_snapshot_for_edit(text)'::regprocedure,
    'public.replace_asset_snapshot_if_current(text,text,text,text,text,jsonb)'::regprocedure,
    'public.delete_asset_snapshot_if_current(text,text,text)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE')
      OR NOT has_function_privilege('authenticated',f,'EXECUTE')
      OR (SELECT prosecdef FROM pg_proc WHERE oid=f)
      OR (SELECT proconfig FROM pg_proc WHERE oid=f) <> ARRAY['search_path=""']
    THEN RAISE EXCEPTION 'REGRESSION: revision RPC privilege/configuration'; END IF;
  END LOOP;
END $$;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_failure($q$SELECT public.get_asset_snapshot_for_edit('2026-01')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-01',NULL,'x',NULL,NULL,'[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.delete_asset_snapshot_if_current('2026-01','1','x')$q$,'42501');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.expect_failure($q$SELECT public.get_asset_snapshot_for_edit('2026-01')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-01',NULL,'x',NULL,NULL,'[]')$q$,'42501');
SELECT pg_temp.expect_failure($q$SELECT public.delete_asset_snapshot_if_current('2026-01','1','x')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','83000000-0000-0000-0000-000000000001',true);
SELECT public.replace_asset_snapshot_if_current('2026-01',NULL,'revision-parent',NULL,NULL,
 '[{"id":"revision-child","category":"savings","account":"fixture","amount":"initial"}]');
DO $$ DECLARE s jsonb; BEGIN
 s := public.get_asset_snapshot_for_edit('2026-01');
 IF s->>'revision' <> '1' OR s->>'snapshotId' <> 'revision-parent'
   OR s->'entries'->0->>'amount' <> 'initial' OR jsonb_typeof(s->'revision') <> 'string'
   OR public.get_asset_snapshot_for_edit('2026-12') IS NOT NULL
 THEN RAISE EXCEPTION 'REGRESSION: coherent edit read'; END IF;
END $$;
SELECT pg_temp.expect_failure($q$SELECT public.get_asset_snapshot_for_edit('2026-13')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.get_asset_snapshot_for_edit(NULL)$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-01',NULL,'unseen',NULL,NULL,'[]')$q$,'PFS01');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-01','2026-01','unused',NULL,'revision-parent','[]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-01','2026-01','unused','1',NULL,'[]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-02',NULL,'x','1',NULL,'[]')$q$,'22023');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-02',NULL,'x',NULL,'x','[]')$q$,'22023');
DO $$ DECLARE bad text; BEGIN
 FOREACH bad IN ARRAY ARRAY['-1','01','1.0','','9223372036854775808','99999999999999999999999999'] LOOP
  PERFORM pg_temp.expect_failure(format('SELECT public.replace_asset_snapshot_if_current(''2026-01'',''2026-01'',''x'',%L,''revision-parent'',''[]'')',bad),'22023');
  PERFORM pg_temp.expect_failure(format('SELECT public.delete_asset_snapshot_if_current(''2026-01'',%L,''revision-parent'')',bad),'22023');
 END LOOP;
END $$;
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-01','2026-01','unused','0','revision-parent','[]')$q$,'PFS01');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03','2026-03','unused','1','revision-parent','[]')$q$,'PFS01');
SELECT pg_temp.expect_failure($q$SELECT public.delete_asset_snapshot_if_current('2026-03','1','revision-parent')$q$,'PFS01');
SELECT public.replace_asset_snapshot_if_current('2026-02',NULL,'collision-parent',NULL,NULL,
 '[{"id":"collision-revision-child","category":"savings","account":"fixture","amount":"collision"}]');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-02','2026-01','unused','1','revision-parent','[]')$q$,'PFS01');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03','2026-01','unused','1','revision-parent','[{"id":"new-child","category":"savings","account":"x","amount":"x"},{"id":"collision-revision-child","category":"savings","account":"x","amount":"x"}]')$q$,'23505');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03',NULL,'failed-create',NULL,NULL,'[{"id":"collision-revision-child","category":"savings","account":"x","amount":"x"}]')$q$,'23505');
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03',NULL,'invalid-create',NULL,NULL,'[{}]')$q$,'22023');
DO $$ BEGIN
 IF (SELECT revision FROM public.monthly_snapshots WHERE id='revision-parent') <> 1
  OR (SELECT month FROM public.monthly_snapshots WHERE id='revision-parent') <> '2026-01'
  OR (SELECT amount FROM public.asset_entries WHERE id='revision-child') <> 'initial'
  OR EXISTS(SELECT 1 FROM public.monthly_snapshots WHERE month='2026-03')
 THEN RAISE EXCEPTION 'REGRESSION: revision/data rollback'; END IF;
END $$;
SELECT public.replace_asset_snapshot_if_current('2026-03','2026-01','unused','1','revision-parent','[]');
SELECT pg_temp.expect_failure($q$SELECT public.delete_asset_snapshot_if_current('2026-03','1','revision-parent')$q$,'PFS01');
SELECT public.replace_asset_snapshot('2026-03',NULL,'legacy-unused','[]');
DO $$ BEGIN
 IF (public.get_asset_snapshot_for_edit('2026-03')->>'revision') <> '3'
  OR (public.get_asset_snapshot_for_edit('2026-03')->>'snapshotId') <> 'revision-parent'
 THEN RAISE EXCEPTION 'REGRESSION: legacy advancement/parent preservation'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','83000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN IF public.get_asset_snapshot_for_edit('2026-03') IS NOT NULL
 THEN RAISE EXCEPTION 'REGRESSION: cross-owner read'; END IF; END $$;
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03','2026-03','x','3','revision-parent','[]')$q$,'PFS01');
SELECT pg_temp.expect_failure($q$SELECT public.delete_asset_snapshot_if_current('2026-03','3','revision-parent')$q$,'PFS01');
SELECT public.replace_asset_snapshot_if_current('2026-03',NULL,'other-owner',NULL,NULL,'[]');
SELECT set_config('request.jwt.claim.sub','83000000-0000-0000-0000-000000000001',true);
SELECT public.delete_asset_snapshot_if_current('2026-03','3','revision-parent');
SELECT public.replace_asset_snapshot_if_current('2026-03',NULL,'replacement-parent',NULL,NULL,'[]');
-- Recreated month has revision1; the old identity must still conflict.
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03','2026-03','x','1','revision-parent','[]')$q$,'PFS01');
SELECT pg_temp.expect_failure($q$SELECT public.delete_asset_snapshot_if_current('2026-03','1','revision-parent')$q$,'PFS01');
UPDATE public.monthly_snapshots SET revision=9223372036854775807 WHERE id='replacement-parent';
SELECT pg_temp.expect_failure($q$SELECT public.replace_asset_snapshot_if_current('2026-03','2026-03','x','9223372036854775807','replacement-parent','[]')$q$,'22003');
DO $$ BEGIN IF public.get_asset_snapshot_for_edit('2026-03')->>'revision' <> '9223372036854775807'
 THEN RAISE EXCEPTION 'REGRESSION: counter precision/overflow'; END IF; END $$;
SELECT public.replace_asset_snapshot_if_current('2026-04',NULL,'large-parent',NULL,NULL,
 (SELECT jsonb_agg(jsonb_build_object('id','large-'||g,'category','savings','account','x','amount','x')) FROM generate_series(1,1501) g));
DO $$ BEGIN IF jsonb_array_length(public.get_asset_snapshot_for_edit('2026-04')->'entries') <> 1501
 THEN RAISE EXCEPTION 'REGRESSION: embedded child truncation'; END IF; END $$;
ROLLBACK;
