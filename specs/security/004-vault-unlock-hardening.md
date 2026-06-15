---
id: 004
slug: vault-unlock-hardening
area: security
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved Phase 1 security (audit roadmap)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # protects the zero-knowledge vault from accidental key/data orphaning
  - '§4.2' # ships route tests for the fail-closed read-error and cookie paths
constitution_overrides:
---

# Spec 004 (security): Vault unlock hardening — fail-closed first-unlock + strict cookie

## Problem

Two residual gaps in `/api/vault` from the audit (Phase 1 tail):

1. **Silent re-init on read error (data-loss class).** The unlock route reads the profile with
   `const { data: profile } = await supabase.from('users_profile').select('vault_check_v2')...` and
   **drops the `error`**. If that SELECT errors transiently (or returns null for any non-absence
   reason), `profile?.vault_check_v2` is falsy and the route falls through to the _first-unlock_
   branch, which `upsert`s a **fresh canary derived from whatever PIN was just typed**. For a user who
   already has an initialized vault and encrypted data, that silently replaces the canary — the DEK no
   longer matches the data, orphaning everything. A read blip must never trigger vault re-init.

2. **DEK cookie is `sameSite: 'lax'`.** The `fynfo_vault_dek` cookie is the crown jewel; `lax` lets it
   ride top-level cross-site GET navigations. It is only ever needed on same-site requests, so it
   should be `'strict'`.

## Constitution check

- Satisfies `§2.1` — both changes harden the zero-knowledge vault (no accidental key/data orphaning;
  tighter cookie scope). No plaintext/secret exposed. Satisfies `§4.2` — adds route tests for the
  fail-closed read-error path.
- Overrides: none. No migration, no new dependency. Single file edit + tests.

## Solution shape

`src/app/api/vault/route.ts` only:

- **Fail-closed read.** Capture the SELECT error. If `profileError` is set, throw
  `AppError('INTERNAL', 'Vault unavailable')` (→ 500 via `handleApiError`) — do **not** fall through to
  first-unlock. Only a clean read with a genuinely absent/uninitialized profile may take the
  first-unlock branch. Log the error code server-side (no PII).
- **Strict cookie.** `COOKIE_OPTS.sameSite: 'lax'` → `'strict'`.

No change to the returning-user verify path, the rate-limit RPCs, or the canary value.

## Out of scope

- Re-keying / migrating orphaned vaults (this prevents the orphaning; it does not repair an
  already-orphaned profile — none exist for the single owner).
- The client-side-work-factor redesign (audit HIGH #2 tail).
- Log-redaction allow-list and trust-proxy allow-list (separate Phase 1 specs).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New route test: profile SELECT error → 500, **no upsert**, no cookie set (does not re-init).
- [ ] Existing tests still green (first-unlock with clean null read still initializes; returning-user
      verify/wrong-PIN/rate-limit paths unchanged).
- [ ] Cookie is set with `sameSite: 'strict'`.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: vault unlock for the single owner. Strict cookie could in theory require a
  re-unlock if arriving via an external top-level link, but the app is an authenticated SPA — not a
  real flow. Fail-closed read turns a (rare) transient DB error from silent data-loss into a visible
  500 the user retries.
- **Reversibility**: single `git revert` of the route+spec commit.
- **Backout plan**: revert the commit.

## Open questions

- None.
