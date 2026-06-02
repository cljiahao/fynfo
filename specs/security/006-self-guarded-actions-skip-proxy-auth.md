---
id: 006
slug: self-guarded-actions-skip-proxy-auth
area: security
status: approved # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Track A spike fix #1; Clarence pre-approved roadmap
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # every server action self-validates auth; no action depends on middleware
  - '§4.2' # ships a unit test for the request classifier
constitution_overrides:
---

# Spec 006 (security): Self-guarded actions, skip redundant proxy auth on action POSTs

## Problem

Track A spike (`docs/audit/2026-06-02-dashboard-perf-spike.md`) found the post-PIN dashboard stall is
**not** crypto (full decrypt ≈ 12 ms) — it is ~9 `supabase.auth.getUser()` network round-trips per
load. Every server-action POST is caught by the `proxy` matcher, which runs `getUser()` (1 auth RTT)
**in addition to** the action's own `requireActionContext()`/`requireDbContext()` `getUser()`. The
proxy pass on action POSTs is redundant: the action validates auth itself, and the action's Supabase
client also rotates the session cookie (its `setAll` writes cookies, which is allowed inside an
action).

Removing the proxy pass on action POSTs is only safe if **every** server action self-validates. Audit
of all nine `'use server'` files shows eight do — but `equity/actions/price-actions.ts`
(`fetchStockPrices`, `fetchExchangeRate`) has **no guard** and currently relies on the proxy as its
only gate. That is a latent gap on its own (an action should not depend on middleware for authz), and
it blocks the optimization.

## Constitution check

- Satisfies `§2.1` (defense-in-depth: each action self-guards; no reliance on middleware) and `§4.2`
  (unit test). Overrides: none. No migration, no new dependency. Touches `src/proxy.ts` (security
  infra) — not a §0 hard-stop path.

## Solution shape

- **Close the gap first.** Add `requireUserId()` (from `@/lib/auth-guard`, already used by
  `statement-actions`) to the top of both `fetchStockPrices` and `fetchExchangeRate`. Prices are only
  ever viewed by a logged-in user; this is the correct posture regardless of the proxy change.
- **`src/proxy.ts`**: extract a pure `isServerActionRequest(method, headers)` =
  `method === 'POST' && headers.has('next-action')`. When true, return a passthrough
  (`NextResponse.next({ request: req })`) **before** creating the Supabase client / calling
  `getUser()` — the action now owns both validation and cookie refresh.
- **Fail-secure by construction:** the predicate only ever skips `POST` requests carrying the Next.js
  server-action header. Page/RSC navigations (GET) and API routes keep full proxy protection
  unchanged. Any request the predicate misclassifies as _not_ an action simply gets the current full
  auth pass — the safe direction.

## Out of scope

- Fix #2 (RSC-prefetch dashboard) and fix #3 (`getClaims()` local verify) from the spike — larger /
  governance-bearing, separate specs.
- Any change to `requireActionContext` / `requireDbContext` internals.
- The unescaped `${from}${to}=X` symbol in `fetchExchangeRate` (pre-existing; noted for a later spec).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New `test/proxy-request.test.ts`: `isServerActionRequest` is true only for `POST` + `next-action`
      header; false for GET (even with the header), POST without the header, and other methods.
- [ ] Both price actions call `requireUserId()` before any fetch.
- [ ] Manual reasoning recorded: all nine `'use server'` files self-validate after this change, so no
      action is exposed by skipping the proxy.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: auth enforcement + session refresh on server-action requests. Mitigated by (a)
  every action self-validating, (b) the action client rotating cookies itself, (c) the fail-secure
  predicate. Worst realistic case: a session that expires exactly between navigations refreshes on the
  action call instead of in the proxy — same end state.
- **Reversibility**: single `git revert` (restores the proxy pass; the price-action guards are
  independently correct and can stay).
- **Backout plan**: revert the commit.

## Open questions

- None.
