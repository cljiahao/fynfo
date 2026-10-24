# 138 recurring template and atomic occurrence contract

Status: owner approved recurring scope and this storage contract, 2026-10-13.
Delivered: shipped 2026-10-13 via spec 138 (PR #58).
Exact response: “Approve recurring scope and this storage contract”.
Recommendation: monthly SGD self-expense templates with explicit Confirm/Skip.
The owner requested recommendation and implementation; new SQL still requires
the separately scoped approval specified by AGENTS §5/Constitution §7.4.

## Product behavior and bounded encrypted state

Use Singapore calendar dates. Preferred day 1–31 clamps to month end without
changing that preference. Selected months outside inclusive start/end are inactive.
Disabled/archived templates create no suggestions. A future month or a preferred
day after today is planned and cannot be confirmed/skipped in the first version.
Navigate earlier months explicitly; never create missed records automatically.
Confirm opens an editable self-expense draft and freezes actual submitted values.
The intended month stays fixed even if actual expense date changes to another month.
Expected default values are not treated as actual payment evidence.

One permanently retained owner rulebook row in `personal_recurring_rulebooks`,
with user_id primary key, random UUID incarnation, BIGINT revision, AES-GCM payload
and updated_at. Schedules, template IDs, dates, amounts, month keys, skip outcomes
and request/expense links are inside ciphertext. Metadata leaks presence, length,
revision and update time. No plaintext recurrence token, HMAC or new key derivation.
Book CAS serializes edits/confirm/skip across all templates, accepting conservative
conflicts between unrelated templates. No table DELETE grant; archive is encrypted
state and permanently retains receipts. Account deletion cascades the whole row.

Payload version1: requestId plus templates. Each template has random ID, name,
enabled, archived, preferredDay, startMonth, nullable endMonth, positive integer
SGD default cents, existing category, item/notes, and occurrence receipts. Receipt
contains intended YYYY-MM, terminal confirmed/skipped outcome, request UUID,
linked expense UUID or null and frozen saved expense values or null. Receipt
identity is template ID plus intended month. Receipts are append-only through
the public server-command surface, never removed or reset. Editing a saved expense
does not edit its receipt, and deleting it shows a missing link without making
the occurrence due. Cloning is explicit and makes a different series/identity.

Initial bounded proposal: 50 templates, 1,200 receipts across the rulebook,
512 KiB plaintext/1 MiB ciphertext, 80-character template name, 256-character
merchant item, 4,096-character notes and 10^12 maximum positive cents. Receipt
capacity can stop future confirmations; report that explicitly and never silently
purge history or reset identities. Receipt rows store frozen values, so long notes
can reach the byte limit earlier than the count limit. New limits need review;
these bounds are not a lifetime storage guarantee.

## Server boundary and atomicity

Server commands: create/edit/enable/archive template, Confirm occurrence, Skip
occurrence. Each accepts strict validated identities plus expected book revision;
Confirm includes one frozen expense. Identity and vault guards run before reading
the current ciphertext. Decrypt/validate current book, check template schedule,
month due date and absence of its occurrence, apply exactly one command preserving
every prior receipt, validate resulting count/byte bounds, encrypt full next book.
The original input/request/expense identities remain frozen after dispatch.

One SQL transaction checks owner/incarnation/revision, changes the encrypted book,
and inserts one self expense for Confirm. Skip/other template edits pass no expense.
Insert-only expense ID conflicts roll back book changes. Confirm-versus-Skip and
two Confirm calls from the same revision have one winner. The loser reloads and
checks the intended occurrence; it never overwrites or blindly retries a stale
book. PostgREST revision inputs/outputs use decimal strings, preserving BIGINT.

Unknown acknowledgement: authoritative decrypted receipt lookup by intended
month and retained request ID confirms the saved/skipped outcome even if later
commands advanced the book revision. Changed/deleted linked expense is distinct
from successful occurrence recording. Absent receipt remains unconfirmed; no
automatic resend. Closing warns of lost in-memory submission identity and possible
completion of dispatched work. Hide/owner teardown invalidate late callbacks and
cache updates; Show offers explicit checking.

## Exact proposed SQL

Proposed migration after approval:
`supabase/migrations/20261013000138_personal_recurring_rulebooks.sql`.
Approved SQL implementation baseline; production application remains owner-only.

```sql
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
```

This restricted definer has explicit owner predicates and inserts only that owner;
it does bypass table-owner RLS internally, so fresh SQL tests must separately prove
owner/anon/service/direct-write denial, insert collision rollback, atomicity and
observed real confirm/skip/CAS races. Existing expense table grants/RLS remain.
Receipt semantics are validated by authenticated/vault-gated server commands;
the DB cannot inspect encrypted months. An authenticated client sabotaging its
own encrypted book is not prevented by pretending SQL can authenticate ciphertext.

## Export, recovery, paths and release

Export v5 adds required recurringTemplates containing schedules and complete
receipt history with linked expense IDs/frozen values. Omit operational book
revision/incarnation/request metadata from its outer envelope; receipt identity
needed for faithful inspection is retained. v1–v4 visibly omit recurring templates.
Any domain read failure prevents download. Local review retains its current
1 MiB/10,000-row bounds and labels oversized files unsupported rather than truncating.
No restore or PIN-change/rekey workflow exists; future atomic recovery must include
the book, preserve receipts, remap expense links coherently and forbid history loss.

After approval, record exact files in new recurring-expenses feature actions,
schemas/types/constants/calendar/commands/hooks/components/index, Expenses feature
composition, Profile export/review v5 and tests/README/spec. No new crypto helper,
dependency, protected tooling or unattended scheduler. Synthetic UI/SQL/action and
calendar tests, full normal gates/hooks, independent review and exact-head CI are
required. Parent LOCAL exclusivity remains until release. Production migration
must be owner-applied and confirmed before application merge; code revert retains
encrypted book/receipts and recorded expenses, with no destructive rollback.
