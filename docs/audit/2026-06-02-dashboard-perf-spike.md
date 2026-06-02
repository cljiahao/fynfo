# Track A — Dashboard-slow-after-PIN measurement spike (2026-06-02)

Read-only investigation. No code changed. Answers: _where does the post-PIN latency
actually go?_ — so a fix targets the real cost instead of a guess.

## Verdict

**It is not crypto. It is auth round-trips + a client-side fetch waterfall.**

The earlier "store a summary table so we decrypt one item instead of all" idea is
confirmed-rejected: decryption is effectively free.

## Measurements

Crypto costs (node `crypto`, this machine — browser WebCrypto is the same order):

| Cost                                                                                 | Measured                                | When                           |
| ------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------ |
| PBKDF2 600k iters → DEK                                                              | **~105 ms** (browser likely 150–250 ms) | once, at PIN entry             |
| AES-256-GCM decrypt                                                                  | **0.008 ms / field**                    | per encrypted field            |
| Heavy dashboard decrypt (≈1,432 fields: 200 expenses, 24×8 asset entries, 24 salary) | **~12 ms total**                        | per load, all 4 queries summed |

Decryption of an entire heavy dashboard is ~12 ms. A summary table would save ~12 ms — not worth the
zero-knowledge complexity. PBKDF2 is a one-time ~0.1–0.25 s at PIN entry, not a per-load cost.

## The actual critical path (post-PIN → dashboard painted)

1. Client derives DEK (PBKDF2, ~0.1–0.25 s) → `POST /api/vault` (1 RTT, sets cookie).
2. Client router navigates to `/dashboard`. **`proxy.ts` runs `supabase.auth.getUser()`** — a network
   round-trip to Supabase Auth (it revalidates the JWT server-side; it is _not_ a cookie read).
3. `(overview)/page.tsx` is `'use client'`, so the 4 data hooks (`useSnapshots`, `useSalaryRecords`,
   `usePlannerSettings`, `useExpenses`) only fire **after** the route JS bundle downloads and hydrates
   — a hydrate-before-fetch waterfall.
4. Each of the 4 hooks issues a server-action POST. The proxy `matcher` catches those POSTs too, so
   **each one re-runs `proxy` → `getUser()` (1 auth RTT)**, and then the action's
   `requireActionContext()` runs **another `getUser()` (1 auth RTT)** before any DB query.

Net `auth.getUser()` network round-trips for one dashboard load: **1 (nav) + 4 (proxy on actions) + 4
(action context) ≈ 9**, plus the DB query RTTs. Even with the 4 actions running concurrently, the
wall-clock critical path is roughly _nav-auth → (proxy-auth → action-auth → db)_ ≈ **3 sequential auth
round-trips + 1 DB round-trip**, gated behind bundle-hydrate. `auth.getUser()` is the dominant unit
cost and it is paid ~9×.

`requireActionContext` has no per-request memoization; React Query `staleTime` is a healthy 5 min, so
this is purely a _first-load_ cost, not refetch churn.

## Fix options (each its own spec; none block another)

Ranked by payoff ÷ risk:

1. **Don't re-run the proxy on server-action POSTs.** The proxy's `getUser()` on action requests is
   redundant — the action already validates via `requireActionContext`. Narrowing the matcher (or
   short-circuiting non-GET/action requests) removes ~4 auth RTTs per load. Risk: medium — the proxy
   also refreshes the session cookie; must confirm actions don't depend on that refresh. **Best
   payoff/risk.**
2. **Make the overview an RSC (or RSC-prefetch + hydrate).** Fetch all 4 datasets server-side in one
   request, in parallel, behind a single auth context, then hydrate React Query. Removes the
   hydrate-before-fetch waterfall _and_ collapses the 4 action auth calls into 1. Biggest perceived
   win; larger refactor, and runs against the current `'use client'` + per-feature-hook pattern.
3. **`getClaims()` (local JWT verify) instead of `getUser()` (network) for the in-request check.**
   Supabase verifies the JWT signature + expiry locally (~0 ms) instead of a round-trip. Cuts _every_
   auth RTT app-wide to ~nothing. **But it is a security-posture change** (local verify trusts the
   signature/expiry without a server-side revocation check) — it contradicts AGENTS.md §4's
   `getUser()` mandate, so it needs Clarence's explicit call and a governance note. Highest leverage,
   highest governance cost.

## Relationship to audit HIGH #2

HIGH #2 (move the PBKDF2 work factor server-side) and this stall are **independent** — crypto is not
the bottleneck, so HIGH #2 will not make the dashboard feel faster. Don't conflate them.
