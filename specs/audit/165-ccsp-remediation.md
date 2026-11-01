---
id: 165
slug: ccsp-remediation
area: audit
status: draft # owner-authorized remediation record (CONSTITUTION §7.4)
author: Claude (Sonnet builder)
created: 2026-11-02
approved:
shipped:
impl_pr:
constitution_satisfies: ['§2.1', '§2.2', '§2.3', '§2.6', '§4.2', '§7.4']
constitution_overrides: []
---

# Audit 165: ISC2 CCSP audit, MED code fixes

## Owner request and authorization

Clarence ran an ISC2 CCSP-style audit of Fynfo and, in chat on 2026-11-02,
approved the "MED code fixes". This record covers exactly three findings. It
runs under CONSTITUTION §7.4 and AGENTS §1.5 as owner-authorized remediation.
It does not claim owner approval of any finding outside these three.

## Findings, evidence and proposed change

### D4 – Vault reset needs only a session

Evidence: `DELETE /api/vault` in `src/app/api/vault/route.ts` clears
`users_profile.vault_check_v2` after `supabase.auth.getUser()` alone. A stolen
session could wipe access to all encrypted data and re-initialize the vault
under an attacker PIN. No in-app caller of the `DELETE` exists today, so the
route is reachable only by direct requests.

Change:

- Reject unless `user.last_sign_in_at` is within 10 minutes (opaque 403,
  code `REAUTH_REQUIRED`, message "Please sign in again to reset your vault").
  The PIN is not required, so a forgotten PIN stays recoverable.
  A missing, unparsable or future timestamp is rejected.
- Rate-limit to 3 resets per 15 minutes per user (429 `RATE_LIMITED`). The
  limiter failing closes the route (opaque 500).
- Trade-off: `last_sign_in_at` moves on sign-in, not on token refresh, so a
  stolen session older than 10 minutes cannot reset, but an attacker who
  captures a session within 10 minutes of sign-in still can. Accepted: the
  window is short and the budget is small.

### D5 – Anonymous telemetry has no rate limit

Evidence: `POST /api/track` writes `marketing_events` with no throttle, so
spam can grow storage without bound.

Change: fixed-window limit of 60 events per 60 seconds per client. The key is
`track:` plus a truncated SHA-256 of the first `x-forwarded-for` hop (Vercel
overwrites that header), so no raw address is stored. The endpoint stays
anonymous and vault-free (§2.2/§2.3 carve-out).

Trade-off: no in-process counter works on serverless instances, so the counter
is DB-backed through a new service-role-only RPC `consume_rate_limit` and table
`rate_limit_buckets` (RLS on, all API roles revoked, hashed keys only). Cost is
one extra RPC per event. If the limiter errors, telemetry fails open, since the
insert uses the same backend and telemetry must never block a page. Stale rows
are purged opportunistically (1% of calls, older than one day).

### D2 – Any household member can delete the household

Evidence: `supabase/migrations/20260626000000_add_household.sql` policy
"Members delete own household" allows `is_household_member(id)`; deletion
cascades the partner's household data.

Change: new migration drops that policy and creates "Owner deletes own
household" with `USING (created_by = auth.uid())`. No code deletes a household
today (`src/features/household` has no such action or UI), so no application
change is needed; members still leave by deleting their own roster row.

## Affected paths

- `src/app/api/vault/route.ts` (DELETE handler only), `src/app/api/track/route.ts`
- `src/lib/rate-limit.ts` (new), `src/lib/errors/app-error.ts` (two codes)
- `src/integrations/services/security-rpc.ts` (`consumeRateLimit`)
- `supabase/migrations/20261102000165_add_rate_limit_buckets.sql` (new)
- `supabase/migrations/20261102000166_household_delete_owner_only.sql` (new)
- `test/api/vault.test.ts`, `test/api/track.test.ts`,
  `test/integrations/security-rpc.test.ts`

## Acceptance checks

- Vault DELETE: fresh session allowed; session older than 10 minutes, missing
  or future timestamp returns 403 with no write; spent budget returns 429 with
  no write; limiter outage returns 500 with no write.
- Track: over-limit returns 429 with no insert and no raw address in the RPC
  parameters; limiter outage still returns 202.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm build` green.
- Migrations are non-destructive and not applied to any remote database by
  this change; the owner applies them.

## Rollback

Revert the commits. For the database: `DROP FUNCTION public.consume_rate_limit(text, integer, integer);
DROP TABLE public.rate_limit_buckets;` and recreate the old policy
"Members delete own household" with `USING (public.is_household_member(id))`.
The route code requires the RPC, so apply code and migration together.

## Deferred (not in scope)

- CI permissions, action pinning, dependabot, CodeQL and gitleaks: protected
  paths; the owner applies them.
- K_h rotation on household leave: crypto protocol change.
- Account erasure and household-leave flow: new feature.
- `marketing_events` retention.
- `/privacy` notice and data-region documentation.
- The LOW findings of the CCSP audit.
