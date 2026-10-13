begin;
create table public.personal_merchant_rulebooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null,
  revision bigint not null default 1 check (revision > 0),
  payload text not null check (octet_length(payload) between 1 and 262144),
  updated_at timestamptz not null default now()
);
alter table public.personal_merchant_rulebooks enable row level security;
revoke all on public.personal_merchant_rulebooks from public, anon, authenticated, service_role;
grant select on public.personal_merchant_rulebooks to authenticated;
create policy merchant_rulebook_select on public.personal_merchant_rulebooks
  for select to authenticated using (auth.uid() = user_id);

create function public.compare_save_personal_merchant_rulebook(
  p_id uuid, p_expected_revision bigint, p_payload text
) returns table (status text, revision text)
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  next_revision bigint;
begin
  if owner_id is null or auth.role() is distinct from 'authenticated'
     or p_id is null or p_expected_revision is null
     or p_expected_revision < 0 or p_expected_revision >= 9223372036854775807
     or p_payload is null or octet_length(p_payload) not between 1 and 262144 then
    raise exception 'Merchant rules unavailable';
  end if;
  if p_expected_revision = 0 then
    insert into public.personal_merchant_rulebooks as b (user_id, id, payload)
      values (owner_id, p_id, p_payload)
      on conflict (user_id) do nothing returning b.revision into next_revision;
  else
    update public.personal_merchant_rulebooks as b
      set payload = p_payload, revision = b.revision + 1, updated_at = clock_timestamp()
      where b.user_id = owner_id and b.id = p_id
        and b.revision = p_expected_revision and b.revision < 9223372036854775807
      returning b.revision into next_revision;
  end if;
  if next_revision is null then
    return query select 'CONFLICT'::text, null::text;
  else
    return query select 'SAVED'::text, next_revision::text;
  end if;
end;
$$;
revoke all on function public.compare_save_personal_merchant_rulebook(uuid,bigint,text)
  from public, anon, service_role;
grant execute on function public.compare_save_personal_merchant_rulebook(uuid,bigint,text)
  to authenticated;
commit;
