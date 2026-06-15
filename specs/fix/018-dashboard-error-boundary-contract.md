---
id: 018
slug: dashboard-error-boundary-contract
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # audit HIGH #4; Clarence pre-approved roadmap fixes
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.1' # conform to the Next.js error-boundary contract
constitution_overrides:
---

# Spec 018 (fix): Dashboard error boundary matches the Next.js contract

## Problem

Audit HIGH #4. `src/app/dashboard/(overview)/error.tsx` does not implement the Next.js error-boundary
contract. Next renders `error.tsx` with `{ error: Error & { digest?: string }, reset: () => void }`,
but this component declares `{ reset?: () => void; refetch?: () => void }` — it **invents** a `refetch`
prop Next never passes (so the `refetch ?? reset` button is dead-coded toward the nonexistent prop),
makes the always-present `reset` optional, and **ignores `error`** entirely, discarding the `digest`
that ties a client failure to the server logs.

## Constitution check

- Satisfies `§4.1` (conform to framework contract). Overrides: none. No migration, no new dependency.
  Single client component edit.

## Solution shape

`src/app/dashboard/(overview)/error.tsx` only:

- Props become the canonical `{ error: Error & { digest?: string }; reset: () => void }`.
- Drop the invented `refetch`; bind the "Try again" button directly to `reset`.
- Use `error`: render `error.digest` (when present) as a small "Reference: <digest>" line so the user
  can quote it for support and it maps to the server log entry. No `console.*` (lint-banned); the pino
  logger is `server-only`, so no client logging is added.

## Out of scope

- Adding a client-side error reporter / telemetry (none exists; separate effort).
- Any other route's error or loading boundary.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green (Next type-checks the error boundary props).
- [ ] Component signature is `{ error: Error & { digest?: string }; reset: () => void }`; button calls
      `reset`; `error.digest` is rendered when present.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: the dashboard overview error screen only. Behaviorally equivalent "Try again"
  (now correctly bound to `reset`), plus a digest line.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
