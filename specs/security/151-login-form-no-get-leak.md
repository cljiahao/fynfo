---
id: '151'
slug: login-form-no-get-leak
area: security
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-10-24
approved: 2026-10-24
shipped: 2026-10-24
impl_pr: https://github.com/cljiahao/fynfo/pull/72
supersedes:
constitution_satisfies:
  - '§5.1'
  - '§2.5'
constitution_overrides:
---

# Spec 151: Keep sign-in credentials out of the URL

## Problem

The email sign-in form is a plain `<form>` with no `method`. If it is submitted
before React hydrates (fast typist, slow network, or a JS chunk that fails to
load), the browser performs its default GET submit and puts `email` and
`password` into the `/login` query string. That lands in browser history, the
address bar, the host's request logs and any proxy in between. Found during the
2026-10-23 local-stack run; reported then and left for the owner as security
work.

Owner approval (2026-10-24): "go ahead please" in reply to the pending list that
named this fix.

## Constitution check

- Satisfies: `§5.1` (the vault PIN form gets the same guard, so a PIN can never
  reach a URL either), `§2.5` (both forms are already client components; no new
  `'use client'` boundary).
- Overrides: none.

## Solution shape

- `src/features/auth/components/email-login-form.tsx`:
  - `method="post"` on the form, so even a native, un-hydrated submit never puts
    fields in a URL.
  - Submit button disabled until hydrated, read with `useSyncExternalStore`
    (server snapshot `false`, client `true`). A disabled default button also
    blocks implicit Enter-key submission, so no native submit happens at all.
- `src/features/auth/components/vault-unlock-flow.tsx`: `method="post"` on the
  PIN form (defense in depth; its input already starts disabled while the vault
  state is `checking`).
- No server, auth-flow or crypto change. Sign-in still calls
  `supabase.auth.signInWithPassword` from the client.

## Out of scope

- Server-side handling of a stray POST to `/login` (it re-renders the page; no
  credentials are read or logged).
- Any other form in the app; none carries credentials.

## Acceptance

- [x] `pnpm check` green
- [x] `pnpm test:ci` green; new tests assert both forms declare
      `method="post"` and the sign-in button renders disabled in server HTML
- [x] `pnpm build` green
- [ ] Manual: local stack sign-in still works

## Risk & reversibility

- **Blast radius**: the sign-in page and the vault unlock overlay.
- **Reversibility**: single git revert.
- **Backout plan**: revert the implementation commit.

## Open questions

None.

## Results

Shipped in PR 72. Gates green locally and in CI: 2148 tests, coverage
thresholds and build. Regression tests fail without the fix. The manual
local-stack sign-in check was not run. The PR also adds `.claude/worktrees/`
to `.prettierignore`, because nested session worktrees broke `format:check`.
