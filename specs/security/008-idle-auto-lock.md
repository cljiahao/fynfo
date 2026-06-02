---
id: 008
slug: idle-auto-lock
area: feature
status: approved # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner approved design (15min, lock-vault-only, silent) in brainstorming
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§4.1' # client provider composes dashboard; feature seam isolated
constitution_overrides:
---

# Spec security/008: Vault idle auto-lock

## Problem

The vault DEK cookie (`fynfo_vault_dek`) has only a **6-hour absolute** expiry
(`src/app/api/vault/route.ts` `COOKIE_OPTS.maxAge = 60 * 60 * 6`). There is **no
idle/inactivity timeout** anywhere. A user who unlocks the vault and walks away
leaves their decrypted financial data readable for up to 6 hours with zero
activity — the worst exposure being an unattended or shared device. Bank apps
auto-lock after a few idle minutes; Fynfo does not lock at all until the absolute
ceiling.

## Constitution check

- Satisfies: `§4.1` (dashboard composes from a feature provider; data-fetching
  stays out of pages). Overrides: none.
- **No `HARD` rule touched.** No encryption primitive changes — the DEK
  derivation, canary, and sealing are untouched. This adds a lifecycle control
  (when the DEK cookie is cleared), not a crypto change.
- No new dependency.

## Solution shape

15 minutes of no user activity → clear the DEK cookie server-side → the existing
vault overlay re-appears → user re-enters the 6-digit PIN to re-derive the DEK.
The Supabase auth session is **not** touched (lock vault only, not sign-out).
Silent — no countdown warning. The 6h absolute cap remains as a hard ceiling.

- **`src/app/api/vault/lock/route.ts`** (new) — `POST` handler, `withLogging`
  wrapped. Calls `supabase.auth.getUser()`; 401 if unauthenticated. On success
  clears `fynfo_vault_dek` by setting it with `maxAge: 0` (same `path`/`sameSite`
  /`httpOnly`/`secure` attributes as the set in `vault/route.ts`, factored to a
  shared `COOKIE_NAME`/base options constant to keep set+clear in lock-step).
  Returns `{ success: true }`. Encryption-touching: only deletes the sealed DEK
  cookie; never reads or logs its value.
- **`src/features/auth/components/vault-lock-context.tsx`** (new, `'use client'`)
  — `VaultLockProvider` exposing `{ locked, lock, unlock }` via context, seeded
  from a server-provided `initiallyUnlocked` prop. `lock()` sets `locked=true`;
  `unlock()` sets `locked=false`.
- **`src/features/auth/hooks/use-idle-lock.ts`** (new) — armed only while
  unlocked. Tracks `lastActivityRef` (epoch ms), updated by throttled listeners
  on `pointerdown`, `keydown`, `scroll`, and `visibilitychange`. A single
  interval (~30s) compares `Date.now() - lastActivity`; when it exceeds
  `IDLE_LIMIT_MS` it `await fetch('/api/vault/lock', { method: 'POST' })`, then
  `queryClient.clear()`, then `lock()`. Constant `IDLE_LIMIT_MS = 15 * 60 * 1000`
  in `src/features/auth/constants.ts`.
- **`src/components/layout/vault-gate.tsx`** — refactored to read `locked` from
  `VaultLockContext` instead of local `useState`; renders `VaultUnlockFlow` when
  locked, wiring `onUnlocked` → `unlock()`.
- **`src/app/dashboard/layout.tsx`** — wrap the dashboard subtree in
  `VaultLockProvider` with `initiallyUnlocked={isVaultUnlocked}`; mount the idle
  watcher (a small client component calling `useIdleLock`).
- Barrel exports updated in `src/features/auth/index.ts` /
  `components/index.ts` as needed.

## Out of scope

- Cross-tab lock synchronization (BroadcastChannel/storage events). v1 is
  per-tab. A stale unlocked tab fails safe: its next server action hits
  `action-guard`, finds no DEK, and is rejected — no decrypted data leaks.
- Countdown / "about to lock" warning toast.
- Changing the 6h absolute `maxAge`, the PIN, PBKDF2 params, or any crypto.
- Signing the user out of Supabase on idle.
- Configurable timeout UI (constant only).

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; new tests cover: lock route returns 401 unauthed and
      clears the cookie (`maxAge: 0`) when authed; `useIdleLock` calls the lock
      endpoint + `lock()` after `IDLE_LIMIT_MS` under fake timers; activity
      before the limit resets the timer (no lock); watcher disarms when already
      locked.
- [ ] `pnpm build` green
- [ ] Manual: unlock vault, idle 15 min → overlay returns; re-PIN restores
      dashboard; activity within 15 min keeps it unlocked; Supabase session
      survives the lock (no re-login prompt).
- [ ] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius**: authenticated dashboard only. Worst-case bug = locking too
  eagerly (annoying re-PIN) — never data loss; the DEK is re-derivable from the
  PIN, and encrypted data at rest is untouched.
- **Reversibility**: single `git revert` (new files + the `vault-gate`/layout
  edits). No migration, no data change.
- **Backout plan**: revert the commit; vault returns to 6h-absolute-only.

## Open questions

- None. (15 min, lock-vault-only, silent, per-tab — all confirmed with owner.)
