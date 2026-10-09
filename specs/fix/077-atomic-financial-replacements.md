---
id: '077'
slug: atomic-financial-replacements
area: fix
status: draft
author: Codex
created: 2026-10-09
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§3.1'
  - '§4'
  - '§5.2'
  - '§5.4'
  - '§6.3'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec 077: Atomic snapshot, expense and tax-relief replacement

## Problem

Current saves update a parent or delete old child rows in one request, then insert
replacement rows in another. A failed later insert can leave an empty or partial
record. Concurrent replacements can combine children from different saves.
Spec076 fixes preparation failures only; it cannot roll back database requests.
Roadmap072 requests atomic saves, but explicitly reserves migration approval.

## Constitution check

Keep existing encrypted columns and client PIN derivation unchanged (§2.1/§5).
Server actions still validate, authenticate and unlock before touching financial
data (§2.2/§2.3). RLS remains enabled and the functions execute with the caller's
privileges. No service-role financial client or SECURITY DEFINER is proposed.
No dependencies, protected paths, new tables or destructive migration. Explicit
owner permission under §7.4/§8.2 is required before implementation.

## Solution shape and scoped approval requested

Add `supabase/migrations/20261009000000_atomic_financial_replacements.sql`
containing three uniquely named PL/pgSQL functions, all SECURITY INVOKER with
empty search_path and fully qualified objects. Revoke PUBLIC/anon execution;
grant authenticated execution only. Each rejects null auth.uid(), derives
ownership from auth.uid() rather than a supplied user_id, and accepts only
already encrypted financial payloads. Validate JSON structure, required fields,
duplicate IDs/relief keys and bounded request size before writes. Existing RLS
policies and table grants remain unchanged.

- `replace_asset_snapshot(p_month text, p_original_month text,
p_new_id text, p_entries jsonb) returns void`: lock/verify the owner parent;
  preserve its ID while renaming. For ordinary upsert, retain the existing ID on
  UNIQUE(user_id, month) conflict. Parent write and full entry replacement occur
  in one transaction. Reject absent original month or a rename collision before
  changing children. Derive child snapshot_id from the locked parent, ignoring
  any caller-supplied child parent or owner field.
- `replace_expense_record(p_record jsonb, p_splits jsonb) returns void`:
  insert/update the owner parent, keeping its ID and obtaining its row lock;
  replace splits in the same transaction. Cross-owner ID collision must fail
  under RLS without modifying either owner's data. Derive child expense_id from
  the verified parent. Preserve current self/shared and settlement fields.
- `replace_tax_relief_year(p_year integer, p_reliefs jsonb) returns void`:
  serialize replacements for the same auth.uid()/year using a transaction-scoped
  advisory lock, including when the year is empty. Reject duplicate relief keys;
  delete and insert in the same transaction. The database supplies user_id/year.

Use the existing authenticated Supabase server client for all three RPCs.
Update `src/features/{assets,expenses,salary}/actions/` replacement actions;
keep their signatures/DTOs, validation and pre-encryption ordering. Replace
multi-request writes with one RPC; report only opaque errors. Keep hooks/forms,
financial encryption, read queries and direct table delete/settlement contracts.
Add meaningful action regressions plus direct-role/failure/concurrency SQL tests
in `test/security/atomic-financial-replacements.sql` and an isolated fixture
runner under `scripts/`. Update README and audit progress. Do not change CI/hooks.

An authenticated owner can call these RPCs directly, just as the existing RLS
financial tables are accessible to that owner. SQL cannot verify an unlocked
DEK or validate ciphertext authenticity without receiving a key. Application
actions enforce the vault gate; SQL must enforce identity, ownership, input
shape and rollback independently. Direct RPC tests must prove cross-owner and
anonymous denial. This proposal does not claim a database vault-unlock gate.

[PostgREST transactions](https://docs.postgrest.org/en/v14/references/transactions.html)
place each request in a transaction and roll back on database failure.
[Supabase function security](https://supabase.com/docs/guides/database/functions)
supports invoker functions and scoped execution grants.
[PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
provide transaction-scoped application serialization; hashed-key collisions can
cause extra serialization, never permission to access another owner's rows.

## Out of scope

No production migration execution, confidential records, secret reads, financial
service-role access, new cryptographic fingerprint scheme or encrypted revision
history. No optimistic revision tokens, retry-operation ledger or overwrite
confirmation flow in this first transaction batch. Successful whole-record saves
still have last-writer-wins semantics. Direct table writers can bypass advisory
serialization for their own data; grants are not silently tightened here.
Tax-relief eligibility, expense allocation validation and data recovery remain
separate contracts. Existing delete/settlement actions are not revised.

## Acceptance

- [ ] Local PostgreSQL fixture replay uses only synthetic roles/rows and relevant
      historical schema; no production connection or real env is read.
- [ ] Each successful RPC yields one complete replacement, including empty lists.
- [ ] Induced final-child insertion failure preserves the old parent and children
      and, for rename, the old month. No partial replacement is committed.
- [ ] Anonymous execution denied; another owner cannot replace a parent, attach
      children to it or delete its relief year, including guessed/colliding IDs.
- [ ] Concurrent same-parent/year RPCs produce one complete submitted set,
      including simultaneous first saves and empty-year replacements.
- [ ] Existing snapshot IDs survive upsert/retry/rename. Repeating an identical
      logical save does not duplicate children; new child IDs are not described
      as a durable retry identity.
- [ ] Action regressions retain identity/key gates, encrypt before RPC, omit
      caller-controlled ownership, reject failed RPC and expose opaque errors.
- [ ] `pnpm check`, `pnpm test:ci`, `pnpm build` pass in the isolated fixture; >80% in every aggregate metric and stricter security floors retained.
- [ ] Second review covers grants, SQL rollback, locking, RLS and README/comments.
      All CI checks green before owner-authorized merge.

## Risk and reversibility

Blast radius is replacement writes for snapshots, expenses and annual reliefs.
A function bug could reject saves, mis-scope rows or mishandle concurrent writes;
negative-role and induced-failure tests are mandatory. The additive migration
creates functions only, without rewriting ciphertext, keys, tables or historical
migrations. A source revert remains schema-compatible; functions can remain
unused. Use a separately reviewed corrective forward migration for SQL defects,
never destructive rollback or permissive grants.

Rollout: provide exact reviewed SQL and fixture results, then owner applies the
additive migration before application merge. Production execution is outside
this approval request. Application must fail closed if the RPC is absent; never
silently fall back to non-atomic replacement. Only merge application callers once
the owner confirms migration readiness. No database credentials are requested.

## Open questions and owner decision

- [ ] Clarence: approve creating/testing this specific additive migration and
      integrating these three RPCs within the paths above? General roadmap
      authorization has not approved this schema operation. Production execution,
      optimistic conflicts and full retry-idempotency remain separately scoped.

Status remains draft until explicit owner approval is recorded. No executable
migration or RPC caller change has been made under this proposal.
