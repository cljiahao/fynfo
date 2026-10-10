-- Spec103: encrypted private scenarios; row IDs identify a fresh incarnation.
create table public.personal_planning_scenarios (
  id uuid primary key default gen_random_uuid(),
  creation_request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 10),
  payload text not null check (octet_length(payload) between 1 and 32768),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, creation_request_id),
  unique (user_id, slot)
);
alter table public.personal_planning_scenarios enable row level security;
revoke all on public.personal_planning_scenarios from public, anon;
grant select, insert, update, delete on public.personal_planning_scenarios to authenticated;
create policy scenario_select on public.personal_planning_scenarios for select to authenticated using (auth.uid() = user_id);
create policy scenario_insert on public.personal_planning_scenarios for insert to authenticated with check (auth.uid() = user_id);
create policy scenario_update on public.personal_planning_scenarios for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy scenario_delete on public.personal_planning_scenarios for delete to authenticated using (auth.uid() = user_id);

create function public.get_personal_planning_scenarios()
returns table (id uuid, creation_request_id uuid, payload text, revision text, created_at timestamptz, updated_at timestamptz)
language sql security invoker set search_path = public, pg_temp as $$
  select s.id, s.creation_request_id, s.payload, s.revision::text, s.created_at, s.updated_at
  from public.personal_planning_scenarios s where s.user_id = auth.uid()
  order by s.created_at, s.id limit 10;
$$;

create function public.create_personal_planning_scenario(p_creation_request_id uuid, p_payload text)
returns table (status text, id uuid, revision text)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  owner_id uuid := auth.uid();
  candidate_slot smallint;
  result_id uuid;
  result_revision bigint;
begin
  if owner_id is null or p_creation_request_id is null or p_payload is null or octet_length(p_payload) not between 1 and 32768 then
    raise exception 'Scenario unavailable';
  end if;
  select s.id, s.revision into result_id, result_revision from public.personal_planning_scenarios s
    where s.user_id = owner_id and s.creation_request_id = p_creation_request_id;
  if found then return query select 'EXISTING'::text, result_id, result_revision::text; return; end if;
  for candidate_slot in 1..10 loop
    insert into public.personal_planning_scenarios as s (creation_request_id, user_id, slot, payload)
      values (p_creation_request_id, owner_id, candidate_slot, p_payload)
      on conflict do nothing returning s.id, s.revision into result_id, result_revision;
    if found then return query select 'CREATED'::text, result_id, result_revision::text; return; end if;
    select s.id, s.revision into result_id, result_revision from public.personal_planning_scenarios s
      where s.user_id = owner_id and s.creation_request_id = p_creation_request_id;
    if found then return query select 'EXISTING'::text, result_id, result_revision::text; return; end if;
  end loop;
  return query select 'CAPACITY'::text, null::uuid, null::text;
end;
$$;

create function public.compare_save_personal_planning_scenario(p_id uuid, p_expected_revision bigint, p_payload text)
returns table (status text, revision text)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare result_revision bigint;
begin
  if auth.uid() is null or p_payload is null or octet_length(p_payload) not between 1 and 32768 then raise exception 'Scenario unavailable'; end if;
  update public.personal_planning_scenarios s set payload = p_payload, revision = s.revision + 1, updated_at = clock_timestamp()
    where s.user_id = auth.uid() and s.id = p_id and s.revision = p_expected_revision and s.revision < 9223372036854775807
    returning s.revision into result_revision;
  if found then return query select 'SAVED'::text, result_revision::text;
  else return query select 'CONFLICT'::text, null::text; end if;
end;
$$;

create function public.compare_delete_personal_planning_scenario(p_id uuid, p_expected_revision bigint)
returns table (status text)
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Scenario unavailable'; end if;
  delete from public.personal_planning_scenarios s where s.user_id = auth.uid() and s.id = p_id and s.revision = p_expected_revision;
  if found then return query select 'DELETED'::text;
  else return query select 'CONFLICT'::text; end if;
end;
$$;

revoke all on function public.get_personal_planning_scenarios() from public, anon;
revoke all on function public.create_personal_planning_scenario(uuid,text) from public, anon;
revoke all on function public.compare_save_personal_planning_scenario(uuid,bigint,text) from public, anon;
revoke all on function public.compare_delete_personal_planning_scenario(uuid,bigint) from public, anon;
grant execute on function public.get_personal_planning_scenarios() to authenticated;
grant execute on function public.create_personal_planning_scenario(uuid,text) to authenticated;
grant execute on function public.compare_save_personal_planning_scenario(uuid,bigint,text) to authenticated;
grant execute on function public.compare_delete_personal_planning_scenario(uuid,bigint) to authenticated;
