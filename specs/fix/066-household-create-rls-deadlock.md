---
id: 066
slug: household-create-rls-deadlock
area: fix
status: shipped
author: Claude (Opus 4.8)
created: 2026-07-05
approved: 2026-07-05
shipped: 2026-07-06
impl_pr: (direct to main)
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§5.1a'
constitution_overrides:
---

# Spec 066: Household creation fails — RLS visibility deadlock

## Problem

Creating a household 500s. Server log:

```
context: "household member create"
code: 42501
message: new row violates row-level security policy for table "household_members"
```

`createHousehold` (household-actions.ts) does two inserts:

1. `households` (created_by = userId) — **succeeds** (proves `auth.uid()` is valid
   and equals `userId`; the `"Creator inserts household"` check passed).
2. `household_members` (the owner's own row) — **fails 42501**.

The failing policy is `"Owner self-inserts member"`:

```sql
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.households h
              WHERE h.id = household_id AND h.created_by = auth.uid())
)
```

`user_id = auth.uid()` passes. The `EXISTS` subquery reads `households`, so
`households`' **own SELECT RLS applies** to it. The only households SELECT policy
is `"Members read own household" USING (is_household_member(id))`. At creation
time the owner is **not yet a member**, so the just-created household is invisible
to the SELECT → `EXISTS` returns false → `WITH CHECK` fails.

**Chicken-and-egg:** to insert the member row you must see the household; to see
the household you must already be a member. Unit tests mock Supabase, so RLS was
never exercised — household creation has never worked against real Postgres.

The second-member (invite) path is unaffected: it inserts via the
`consume_household_invite` SECURITY DEFINER RPC, which bypasses RLS. Only the
owner's direct self-insert in `createHousehold` hits the deadlock.

## Constitution check

- Satisfies `§1.1` (the household feature must actually function) and `§5.1a`
  (household key-wrapping model is unchanged — this is purely an RLS visibility
  fix; no key, DEK, or ciphertext handling is touched).
- Overrides: none. No `HARD` rule touched. The fix does not weaken isolation:
  it only lets a user SELECT a household **they themselves created**
  (`created_by = auth.uid()`), which they are about to join anyway.

## Solution shape

New idempotent migration adding one permissive SELECT policy on `households`:

```sql
CREATE POLICY "Creator reads own household" ON public.households
  FOR SELECT USING (created_by = auth.uid());
```

Postgres OR-combines permissive policies, so the creator can now see their own
household → the `EXISTS` ownership check in the member-insert policy resolves →
the owner's `household_members` row inserts. No application code changes.

Considered alternatives:

- **SECURITY DEFINER `is_household_creator(id)`** rewriting the member-insert
  check to avoid the RLS-filtered read (mirrors `is_household_member`). Also
  correct, but adds a function; widening creator SELECT is simpler and a
  capability the creator should have regardless.
- **Atomic create RPC** (SECURITY DEFINER, insert both rows) — most robust
  (also removes the orphan-row risk below), but a larger change. Deferred.

## Out of scope (noted, not fixed here)

- **Orphaned `households` rows** from prior failed attempts (each failed create
  left a household row with no members). Harmless — invisible in the UI (which
  reads only via membership) — and after this fix a fresh create succeeds. A
  destructive cleanup DELETE is human-only; left to Clarence if he wants tidy.
- **Non-atomic create** (two separate inserts can orphan a household row on any
  future member-insert failure). A create RPC would fix this; deferred.

## Acceptance

- [ ] `pnpm check` / `pnpm test:ci` / `pnpm build` green (no code change; JS gates
      unaffected — this is SQL only)
- [ ] After applying the migration (`supabase db push`), creating a household
      succeeds: `households` + owner `household_members` rows both insert, the
      household session opens, and `/dashboard/household` shows the unlocked
      overview instead of the setup form.
- [ ] The invite/accept second-member path still works (unchanged).

## Risk & reversibility

- **Blast radius**: one additive SELECT policy on `households`. No data mutated,
  no code changed, no key/crypto path touched.
- **Reversibility**: `DROP POLICY "Creator reads own household" ON public.households;`
- **Apply**: migration must be run against Supabase by Clarence (`supabase db
push`) — `supabase/migrations/**` application is a human action.

## Open questions

- none.
