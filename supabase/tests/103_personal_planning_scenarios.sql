-- Spec103 isolated fixture only. Run after the migration with synthetic
-- auth.users A/B provisioned by the test harness. Never target production.
-- Concurrent sessions additionally need the harness race cases; this script
-- proves sequential role/constraint/incarnation behavior, not concurrency.
begin;
create function pg_temp.scenario_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', label; end if; end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
create temporary table scenario_fixture (id uuid, request_id uuid, revision text);
insert into scenario_fixture select r.id, '22222222-2222-4222-8222-222222222222', r.revision from public.create_personal_planning_scenario('22222222-2222-4222-8222-222222222222', 'synthetic-ciphertext-A') r where r.status = 'CREATED';
select pg_temp.scenario_assert((select count(*) = 1 from scenario_fixture), 'A creates');
select pg_temp.scenario_assert((select count(*) = 1 from public.get_personal_planning_scenarios()), 'A reads own');
select pg_temp.scenario_assert((select status = 'EXISTING' and id = (select id from scenario_fixture) from public.create_personal_planning_scenario('22222222-2222-4222-8222-222222222222', 'different-retry-ciphertext')), 'same request correlates existing incarnation');
select pg_temp.scenario_assert((select payload = 'synthetic-ciphertext-A' from public.get_personal_planning_scenarios()), 'existing request never overwrites');
select pg_temp.scenario_assert((select status = 'SAVED' and revision = '2' from public.compare_save_personal_planning_scenario((select id from scenario_fixture), 1, 'synthetic-ciphertext-A2')), 'CAS update');
select pg_temp.scenario_assert((select status = 'CONFLICT' from public.compare_save_personal_planning_scenario((select id from scenario_fixture), 1, 'stale')), 'stale save conflicts');
select pg_temp.scenario_assert((select status = 'CONFLICT' from public.compare_delete_personal_planning_scenario((select id from scenario_fixture), 1)), 'stale delete conflicts');
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select pg_temp.scenario_assert((select count(*) = 0 from public.get_personal_planning_scenarios()), 'B cannot read A');
select pg_temp.scenario_assert((select status = 'CONFLICT' from public.compare_save_personal_planning_scenario((select id from scenario_fixture), 2, 'forged')), 'B cannot save A');
select pg_temp.scenario_assert((select status = 'CONFLICT' from public.compare_delete_personal_planning_scenario((select id from scenario_fixture), 2)), 'B cannot delete A');
do $$ begin
  begin
    insert into public.personal_planning_scenarios(creation_request_id, user_id, slot, payload) values(gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 2, 'forged');
    raise exception 'Expected ownership denial';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ begin
  begin
    update public.personal_planning_scenarios set user_id = '33333333-3333-4333-8333-333333333333' where id = (select id from scenario_fixture);
    raise exception 'Expected WITH CHECK denial';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_personal_planning_scenario(gen_random_uuid(), repeat('x',32769));
    raise exception 'Expected ciphertext bound denial';
  exception when raise_exception then
    if sqlerrm <> 'Scenario unavailable' then raise; end if;
  end;
end; $$;
select pg_temp.scenario_assert((select status = 'DELETED' from public.compare_delete_personal_planning_scenario((select id from scenario_fixture), 2)), 'A delete current revision');
select pg_temp.scenario_assert((select status = 'CREATED' and id <> (select id from scenario_fixture) from public.create_personal_planning_scenario('22222222-2222-4222-8222-222222222222', 'synthetic-replayed-after-delete')), 'same request post-delete creates new incarnation');
select pg_temp.scenario_assert((select status = 'CONFLICT' from public.compare_save_personal_planning_scenario((select id from scenario_fixture), 1, 'stale-old-incarnation')), 'old incarnation cannot save replacement');
select pg_temp.scenario_assert((select status = 'CONFLICT' from public.compare_delete_personal_planning_scenario((select id from scenario_fixture), 1)), 'old incarnation cannot delete replacement');
do $$ declare i integer; begin
  for i in 1..9 loop
    perform pg_temp.scenario_assert((select status = 'CREATED' from public.create_personal_planning_scenario(gen_random_uuid(), 'synthetic-capacity')), 'free slot creation');
  end loop;
end; $$;
select pg_temp.scenario_assert((select status = 'CAPACITY' from public.create_personal_planning_scenario(gen_random_uuid(), 'synthetic-eleventh')), 'ten slot capacity');
select pg_temp.scenario_assert((select count(*) = 10 from public.get_personal_planning_scenarios()), 'bounded ten-row read');
set local role anon;
do $$ begin
  begin
    perform public.get_personal_planning_scenarios(); raise exception 'Expected anon RPC denial';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.personal_planning_scenarios; raise exception 'Expected anon table denial';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
