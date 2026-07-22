---
id: 068
slug: household-unlock-stale-lock-state
area: fix
status: shipped
author: Claude Code
created: 2026-07-22
approved: 2026-07-22
shipped: 2026-07-22
impl_pr: (direct to main)
supersedes:
constitution_satisfies:
  - '§1.1'
constitution_overrides:
---

# Spec 068: Household unlock button does nothing (stale lock state)

## Problem

Pressing "Unlock household" on `/dashboard/household` returns 200 OK (the server
action succeeds, sets the `fynfo_household_kh` cookie) but the page never leaves
the locked screen. `useUnlockHousehold` (`src/features/household/hooks/use-household.ts`)
only invalidates `GOALS_KEY` on success — it never invalidates `HOUSEHOLD_KEY`,
so `useHousehold()`'s cached `household.data.locked` (read by
`household-overview.tsx`) never refreshes to `false`, and the UI stays stuck on
the lock prompt indefinitely.

## Constitution check

- Satisfies: `§1.1` (household feature must actually function)
- Overrides: none

## Solution shape

- `src/features/household/hooks/use-household.ts`: `useUnlockHousehold`'s
  `onSuccess` also invalidates `HOUSEHOLD_KEY` (in addition to the existing
  `GOALS_KEY` invalidation), so `getHousehold()` refetches and picks up
  `locked: false` from the now-set session cookie.

## Out of scope

- The `<Link>` prefetch requests for other dashboard routes visible in the
  Network tab during this flow — standard Next.js navbar prefetch, unrelated,
  not a bug.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: click "Unlock household" → screen flips to the unlocked goals
      view without a manual refresh

## Risk & reversibility

- **Blast radius**: household feature only, one hook.
- **Reversibility**: single git revert.
- **Backout plan**: revert commit.

## Open questions

None.
