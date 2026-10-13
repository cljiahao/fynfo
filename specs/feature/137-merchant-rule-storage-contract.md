# 137 exact merchant-rule storage proposal

Status: owner approved schema and implementation, 2026-10-13.
Exact owner response: “Approve this storage contract and implementation”.
The approval covers this table, restricted function, encrypted rulebook contract
and export v4. Production application remains a separate owner action.
Feature direction is approved. This document proposes the exact new database
privilege and persistence boundary; no production migration has been applied.

## Selected contract

One `personal_merchant_rulebooks` row per authenticated account, retaining the row
even when all rules are removed. Columns: `user_id` UUID primary key referencing
`auth.users` with account-delete cascade; `id` random UUID incarnation; positive
BIGINT `revision`; `payload` AES-GCM ciphertext; `updated_at` timestamp. No merchant,
category, bank, enabled state, match token or plaintext equality hash is stored
outside ciphertext. Metadata exposes presence, ciphertext length, revision and
update time. The app reads its own one row through RLS, decrypts in process after
identity/vault guards and validates the complete envelope.

Plaintext payload: strict `{schemaVersion:1, requestId:UUID, rules:Rule[]}`.
Rule: strict `{id:UUID, label, enabled, matchMode:'exact'|'phrase', matchText,
bank:null|'uob'|'dbs'|'hsbc'|'citibank', displayName:null|string,
category:null|existingExpenseCategory}`. At least one suggested field is required.
100 rules maximum; label/match/name each 1–256 characters with nonblank content;
unique rule IDs; 131072 UTF-8 bytes maximum for the complete payload. Ciphertext
maximum 262144 bytes accommodates the existing nested base64 encoding. IDs and
request identity are generated once, retained for the attempt, never bank IDs.

One atomic compare-save RPC. Expected revision 0 inserts an absent book with
caller-generated incarnation; expected revision >=1 updates only matching owner,
incarnation and revision. Concurrent edits have one winner. Revision is returned
as decimal text and never converted through a JavaScript number. No direct table
insert/update/delete grants for authenticated clients; mutation function uses
SECURITY DEFINER, fixed empty search_path, fully qualified relations, explicit
auth.uid owner predicate and authenticated-role check. Read-only SELECT uses RLS.
The definer bypasses table-owner RLS, so its explicit owner guard is independently
tested. No service-role application client. No generic SQL/dynamic SQL functions.

Lost acknowledgement freezes the request. Explicit Check reads the current book:
same incarnation, expected next revision, requestId and complete payload confirms;
newer or different content is a conflict; missing or unchanged revision remains
unconfirmed. No automatic resend. Reload after a conflict starts a new reviewed
edit from latest state and discards no local draft without confirmation. Removed
rules cannot return through replay of a stale revision. Empty book remains, so
creation replay cannot recreate a deleted book. Account deletion is terminal.

Export v4 adds required `merchantRules: Rule[]` (not concurrency/request metadata).
Its read failure prevents the whole download. Local v4 review validates the same
strict rule shape and duplicates; v1–v3 visibly lack this domain. Existing 1 MiB
review bounds remain; an unsupported larger export is not truncated. Export is
plaintext, across-domain reads remain non-atomic, and restore remains unavailable.
There is currently no supported PIN-change/rekey UI/action. No crypto primitive,
derivation or session changes are proposed. Future rekey/recovery must include
the complete rulebook and regenerate operational tokens rather than silently
omitting it. Do not claim recovery or forgotten-PIN access.

## Exact proposed SQL

Implementation path after approval:
`supabase/migrations/20261013000137_personal_merchant_rulebooks.sql`.
The following approved text is the implementation baseline for the migration.

```sql
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
```

## Implementation paths after schema approval

New merchant-rules actions/rulebook-actions.ts, hooks/use-merchant-rulebook.ts,
components/merchant-rule-manager.tsx and merchant-suggestion.tsx; previously
recorded pure domain files. Import-review types/parser retain originalDescription;
statement-review integrates explicit suggestion/apply, tracks manual fields and
invalidates duplicate review. Profile export-data.ts, use-export-data.ts,
export-data-card.tsx, export-validation.ts and export-review-constants.ts add v4.
Focused merchant action/hook/component and existing export/parser/UI tests;
synthetic SQL replay under test/security; README and 137 records. No dependency,
protected tooling, existing expense action, crypto helper or governance edit.

## Verification and rollout

Fresh disposable local SQL replay: two synthetic owners, anon and service-role
denial, direct writes denied, cross-owner reads/updates denied, same-revision
concurrency, create race, empty-book retention, overflow/null/oversized inputs,
rollback and exact JSON BIGINT handling. Source/action tests prove identity then
vault ordering, ciphertext-only writes and opaque failures. UI verifies conflicts,
unknown acknowledgement, manual overrides, Unicode matching, source access,
desktop/mobile/keyboard and hide/owner/close stale-callback rejection.

Normal hooks/full gates, independent review and exact published-head green CI
remain required. Parent owns LOCAL slot until release. Production migration is
owner-applied and confirmed before application merge; neither merge nor deployment
is requested here. Backout disables application callers and retains ciphertext;
no destructive down migration or silent data deletion.

The privileged function design follows PostgreSQL's guidance on restricted
search_path and selective EXECUTE grants:
https://www.postgresql.org/docs/17/sql-createfunction.html . Local replay is still
required; documentation is not database execution evidence.
