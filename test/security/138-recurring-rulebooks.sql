-- Execute only in the disposable 138 fixture. No production connection.
begin;
insert into auth.users(id) values
  ('13800000-0000-4000-8000-000000000001'),
  ('13800000-0000-4000-8000-000000000002');
create function pg_temp.expect_denied(query text) returns void language plpgsql as $$
begin
  begin execute query;
  exception when insufficient_privilege then return;
  end;
  raise exception 'REGRESSION: expected privilege denial';
end $$;
create function pg_temp.expect_invalid(query text) returns void language plpgsql as $$
begin
  begin execute query;
  exception when raise_exception then return;
  end;
  raise exception 'REGRESSION: expected rejected input';
end $$;
do $$ begin
  if has_function_privilege('anon','public.compare_save_personal_recurring_rulebook(uuid,bigint,text,jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.compare_save_personal_recurring_rulebook(uuid,bigint,text,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','public.personal_recurring_rulebooks','INSERT,UPDATE,DELETE')
    or not (select relrowsecurity from pg_class where oid='public.personal_recurring_rulebooks'::regclass)
  then raise exception 'REGRESSION: privileges or RLS'; end if;
end $$;
set local role anon;
select pg_temp.expect_denied($q$select * from public.personal_recurring_rulebooks$q$);
select pg_temp.expect_denied($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',0,'synthetic')$q$);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',0,'synthetic')$q$);
select set_config('request.jwt.claim.sub','13800000-0000-4000-8000-000000000001',true);
do $$ declare result record; begin
  select * into result from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',0,'synthetic-ciphertext');
  if result.status <> 'SAVED' or result.revision <> '1' then raise exception 'REGRESSION: create'; end if;
  select * into result from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',0,'replayed');
  if result.status <> 'CONFLICT' then raise exception 'REGRESSION: create replay'; end if;
end $$;
select pg_temp.expect_denied($q$update public.personal_recurring_rulebooks set payload='forged'$q$);
select pg_temp.expect_denied($q$delete from public.personal_recurring_rulebooks$q$);
select pg_temp.expect_denied($q$insert into public.personal_recurring_rulebooks(user_id,id,payload) values(auth.uid(),'13800000-0000-4000-8000-000000000010','forged')$q$);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',null,'x')$q$);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook(null,1,'x')$q$);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',1,null)$q$);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',1,'')$q$);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',1,repeat('x',1048577))$q$);
select pg_temp.expect_invalid($q$select * from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',9223372036854775807,'x')$q$);
select set_config('request.jwt.claim.sub','13800000-0000-4000-8000-000000000002',true);
do $$ declare result record; begin
  if (select count(*) from public.personal_recurring_rulebooks) <> 0 then raise exception 'REGRESSION: cross-owner read'; end if;
  select * into result from public.compare_save_personal_recurring_rulebook('13800000-0000-4000-8000-000000000010',1,'forged');
  if result.status <> 'CONFLICT' then raise exception 'REGRESSION: cross-owner update'; end if;
end $$;
reset role;
do $$ begin
  if (select payload from public.personal_recurring_rulebooks where user_id='13800000-0000-4000-8000-000000000001') <> 'synthetic-ciphertext'
    or (select revision from public.personal_recurring_rulebooks where user_id='13800000-0000-4000-8000-000000000001') <> 1
  then raise exception 'REGRESSION: denied operation changed data'; end if;
end $$;
rollback;
