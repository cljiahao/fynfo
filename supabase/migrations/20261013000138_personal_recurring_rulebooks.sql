begin;
create table public.personal_recurring_rulebooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null,
  revision bigint not null default 1 check (revision > 0),
  payload text not null check (octet_length(payload) between 1 and 1048576),
  updated_at timestamptz not null default now()
);
alter table public.personal_recurring_rulebooks enable row level security;
revoke all on public.personal_recurring_rulebooks from public, anon, authenticated, service_role;
grant select on public.personal_recurring_rulebooks to authenticated;
create policy recurring_rulebook_select on public.personal_recurring_rulebooks
  for select to authenticated using (auth.uid() = user_id);

create function public.compare_save_personal_recurring_rulebook(
  p_id uuid, p_expected_revision bigint, p_payload text, p_expense jsonb default null
) returns table (status text, revision text)
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  next_revision bigint;
  expense_id text;
  expense_date timestamptz;
begin
  if owner_id is null or auth.role() is distinct from 'authenticated'
    or p_id is null or p_expected_revision is null
    or p_expected_revision < 0 or p_expected_revision >= 9223372036854775807
    or p_payload is null or octet_length(p_payload) not between 1 and 1048576 then
    raise exception 'Recurring expense unavailable';
  end if;
  if p_expense is not null then
    if p_expected_revision = 0 or jsonb_typeof(p_expense) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(p_expense)) <> 6
      or exists (select 1 from jsonb_object_keys(p_expense) k where k not in ('id','date','type','item','info','amount'))
      or jsonb_typeof(p_expense->'id') is distinct from 'string'
      or jsonb_typeof(p_expense->'date') is distinct from 'string'
      or jsonb_typeof(p_expense->'type') is distinct from 'string'
      or jsonb_typeof(p_expense->'item') is distinct from 'string'
      or jsonb_typeof(p_expense->'info') is distinct from 'string'
      or jsonb_typeof(p_expense->'amount') is distinct from 'string'
      or (p_expense->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
      or (p_expense->>'type') not in ('bills','charity','electronics','entertainment','food_drink','gift','groceries','health','insurance','other','shopping','subscriptions','transport','travel')
      or octet_length(p_expense->>'item') not between 1 and 32768
      or octet_length(p_expense->>'info') not between 1 and 32768
      or octet_length(p_expense->>'amount') not between 1 and 32768 then
      raise exception 'Recurring expense unavailable';
    end if;
    expense_id := (p_expense->>'id')::uuid::text;
    expense_date := ((p_expense->>'date') || 'T00:00:00.000Z')::timestamptz;
  end if;
  if p_expected_revision = 0 then
    insert into public.personal_recurring_rulebooks as b (user_id,id,payload)
      values (owner_id,p_id,p_payload) on conflict (user_id) do nothing
      returning b.revision into next_revision;
  else
    update public.personal_recurring_rulebooks as b
      set payload=p_payload,revision=b.revision+1,updated_at=clock_timestamp()
      where b.user_id=owner_id and b.id=p_id and b.revision=p_expected_revision
        and b.revision < 9223372036854775807
      returning b.revision into next_revision;
  end if;
  if next_revision is null then
    return query select 'CONFLICT'::text,null::text;
    return;
  end if;
  if p_expense is not null then
    insert into public.expense_records(id,user_id,date,type,item,info,amount,split_type)
      values(expense_id,owner_id,expense_date,p_expense->>'type',p_expense->>'item',
        p_expense->>'info',p_expense->>'amount','self');
  end if;
  return query select 'SAVED'::text,next_revision::text;
end;
$$;
revoke all on function public.compare_save_personal_recurring_rulebook(uuid,bigint,text,jsonb)
  from public,anon,service_role;
grant execute on function public.compare_save_personal_recurring_rulebook(uuid,bigint,text,jsonb)
  to authenticated;
commit;
