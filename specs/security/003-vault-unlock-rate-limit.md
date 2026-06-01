---
id: 003
slug: vault-unlock-rate-limit
area: security
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence approved Phase 1; policy 5/15min + Postgres table chosen
shipped: 2026-06-02 # code merged; migration must be applied (supabase db push) to activate
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # compensating control for the small PIN space; no plaintext/secret exposure
  - '§4.2' # ships route tests for the locked / failure / success paths
constitution_overrides:
---

# Spec 003 (security): Rate-limit + lockout on vault PIN unlock

## Problem

Audit HIGH #1: `/api/vault` has no rate-limiting. The DEK derives from a 6-digit PIN (~1M space) and
the 600k PBKDF2 work factor is client-side, so the server only does an AES-GCM decrypt per attempt —
an attacker holding the Supabase session can brute-force the vault unboundedly. This is the single
most important gap.

## Constitution check

- Satisfies `§2.1` — a server-enforced attempt throttle is the compensating control for the small PIN
  space (the audit's core finding). No plaintext, key, or secret is exposed. Satisfies `§4.2` — adds
  route tests for the locked / failure / success paths.
- Overrides: none. **Touches `supabase/migrations/`** — but ADD-only (new table + functions), not a
  destructive op, so not a §0.3 hard stop. No new dependency.

## Decisions (Clarence, 2026-06-02)

- **Policy:** 5 failed unlocks within a 15-minute window → lock unlocking for 15 minutes. Counter
  resets on a successful unlock.
- **Storage:** dedicated Postgres table + RLS (not a `users_profile` column).

## Solution shape

**Tamper-proofing:** the route uses the user's RLS-scoped session (no service-role key in this stack).
If the user could write the counter directly they could reset it, defeating the limit. So the table
has **no direct RLS grant** (default-deny) and is mutated only through `SECURITY DEFINER` RPCs scoped
to `auth.uid()` — the same pattern as `rekey_user_data`.

- **Migration** `supabase/migrations/20260602000000_add_vault_unlock_throttle.sql` (idempotent):
  - `public.vault_unlock_attempts(user_id uuid PK → auth.users, fail_count smallint, window_start
timestamptz, locked_until timestamptz, updated_at timestamptz)`, RLS enabled, **no policies**.
  - `public.vault_unlock_locked() returns boolean` — true iff `locked_until > now()` for `auth.uid()`.
  - `public.vault_unlock_record(p_success boolean) returns boolean` — resets on success; on failure
    increments within the window (or starts a new window), sets `locked_until = now()+15min` once
    `fail_count >= 5`, returns whether now locked. `FOR UPDATE` row lock for atomicity.
  - `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`.
- **`src/app/api/vault/route.ts`** (returning-user path only — first-unlock is TOFU, no PIN to guess):
  - Before `verifyCanary`: `rpc('vault_unlock_locked')`; if locked → `429 { error: 'Too many
attempts. Try again later.' }`.
  - On `VAULT_REJECTED`: `rpc('vault_unlock_record', { p_success: false })`, then return `429` if the
    attempt tripped the lock, else `401 Incorrect PIN`.
  - On success: `rpc('vault_unlock_record', { p_success: true })` before setting the cookie.
  - **Fail-open on RPC error** (function not yet deployed): log a warning and proceed, so an
    un-applied migration cannot brick unlock. The control activates once the migration is applied.

## Deployment note (required)

The migration must be applied (`supabase db push` / dashboard) for the throttle to take effect. Until
then the route fails open (logs `rate-limit unavailable`) and behaves as today. **No code path breaks
if the migration is missing.**

## Out of scope

- Progressive/exponential backoff (chose fixed window+lockout).
- Throttling unauthenticated requests (the route already 401s before the PIN check; attempts are keyed
  to the authenticated user id).
- The deeper client-side-work-factor redesign (audit HIGH #2 tail) — separate, larger effort.
- IP-based limiting (no trusted proxy allow-list yet; see the trust-proxy spec).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] Route tests: locked → 429 (no canary check); wrong PIN records a failure → 401; the failure that
      trips the lock → 429; success records a reset; RPC error → fail-open (still unlocks).
- [ ] Migration is idempotent and self-contained; functions are `SECURITY DEFINER` + `auth.uid()`
      guarded + `REVOKE/GRANT`.
- [ ] No new dependency. No `any`, no `console.log`.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: vault unlock for the (single) user. Mitigated by fail-open on RPC error and route
  tests. Worst case a self-lockout for 15 min after 5 wrong PINs (intended).
- **Reversibility**: `git revert` the route+spec commit; optionally drop the table/functions. The
  fail-open design means reverting code while leaving the migration in place is also safe.
- **Backout plan**: revert the commit; `DROP FUNCTION`/`DROP TABLE` if removing the schema.

## Open questions

- None.
