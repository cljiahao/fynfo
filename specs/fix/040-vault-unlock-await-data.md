---
id: 040
slug: vault-unlock-await-data
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.1' # UI quality — loading state matches actual readiness
constitution_overrides:
---

# Spec 040: Vault-unlock overlay should stay until data is on screen

## Problem

On the first PIN unlock, the progress bar animates to completion and the unlock
overlay disappears — but the dashboard data isn't on screen yet. The user then
stares at empty/skeleton content while the encrypted rows refetch and
server-decrypt. The bar measures **key derivation** (a fixed 1.8s animation), not
data readiness, and `vault-unlock-flow.tsx` drops the gate the instant the DEK
cookie is set:

```js
if (res.ok) {
  onUnlocked?.(); // gate unmounts immediately
  queryClient.invalidateQueries(); // fire-and-forget, not awaited
  return;
}
```

Warm navigation is fine (React Query cache is already populated); only the initial
post-unlock reveal mismatches. The overlay drops one data-fetch too early and the
bar promises "Unlocking your dashboard…" before the dashboard exists.

## Constitution check

- Satisfies `§4.1` (loading state reflects real readiness). Overrides: none. No
  migration, no new dependency. One component file.

## Solution shape

`src/features/auth/components/vault-unlock-flow.tsx` only:

- Add `revealWhenReady()`: after the DEK cookie is set, hold the overlay until the
  currently-unlocked page's active queries settle, then call `onUnlocked()`. Race
  the settle against a `DATA_WAIT_TIMEOUT_MS` cap (6s) so a slow/failing query can
  never trap the user behind the gate — at the cap the gate drops to the page's own
  skeletons.
  ```js
  await Promise.race([
    queryClient.invalidateQueries(),
    new Promise((r) => setTimeout(r, DATA_WAIT_TIMEOUT_MS)),
  ]);
  onUnlocked?.();
  ```
- Apply to **both** success paths (normal `res.ok` and the v1→v2 migration
  `migrateRes.ok`).
- Add a `loadingData` phase so the bar is honest: phase 1 (derive + POST) animates
  0→90 as today; entering `revealWhenReady` flips `loadingData`, which stops the
  phase-1 interval, pins the bar near the top, and swaps the message to
  "Loading your dashboard…". `isSubmitting` stays true across the await, so the
  overlay + bar remain mounted until `onUnlocked`.

Trade-off (accepted): `invalidateQueries()` awaits _all_ active queries, which on
the equity page includes the external Yahoo price/FX fetch. The 6s cap is therefore
also the reveal point on external-data pages; those components keep their own
spinners for the live values. The win is the common case — encrypted-row pages
(overview/assets/salary/expenses) reveal populated instead of blank.

## Out of scope

- Scoping the await to specific feature query keys (would couple the auth flow to
  feature internals).
- RSC-prefetching landing data into the unlock response.
- Changing the derivation timing or the PBKDF2 work factor.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: cold unlock on the overview page → overlay stays until cards are
      populated, no blank flash; bar shows a "Loading your dashboard…" phase
- [ ] Manual: unlock on the equity page → reveals by the 6s cap at the latest, live
      prices may still be streaming (expected)
- [ ] Manual: wrong PIN still resets the field and re-prompts (no regression)
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: the unlock component only. Worst case a query hangs → capped at
  6s, identical to today's behavior (gate drops, page skeletons show).
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- [ ] Q: 6s cap right? — Owner: Clarence — A: default 6s; tune after feeling it.
