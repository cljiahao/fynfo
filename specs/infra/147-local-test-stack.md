---
id: '147'
slug: local-test-stack
area: infra
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-10-23
approved: 2026-10-23
shipped: 2026-10-23
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§5.3'
  - '§7.4'
  - '§8.2'
constitution_overrides:
---

# Spec 147: Local Supabase test stack with a synthetic user

## Problem

Fynfo has no way to exercise the real app end to end without the owner's live
account. `supabase/config.toml` lists `./seed.sql`, but the file does not exist.
The Supabase CLI is not installed, and `.env` points the dev server at the
hosted project. An agent therefore cannot sign in, unlock a vault or add a
record without seeing the owner's real finances. Statement import (spec 079)
will need repeated runs with synthetic statements, duplicates and bad rows,
which must never touch the real vault.

## Constitution check

- Satisfies: `§2.1` (zero-knowledge: no agent sees real decrypted data),
  `§5.3` (no secrets committed; local keys are the CLI's public demo keys),
  `§7.4` (owner approval before tooling changes), `§8.2` (no secret env file
  is read or written).
- Overrides: none.

## Solution shape

- **Supabase CLI as a pinned dev dependency.** Add `supabase` to
  `devDependencies` at an exact version. This is a new dependency and needs
  explicit owner approval (AGENTS.md §0.4). Docker Desktop is already running
  on the host.
- **`supabase/seed.sql`.** Creates one synthetic auth user,
  `test@fynfo.test`, with a confirmed email and a generated test password. It
  seeds no vault data. The vault canary is created by the normal first-unlock
  flow in `src/app/api/vault/route.ts`, so the seed never touches encryption.
- **Test values recorded in `supabase/seed.sql` comments.** The test password
  and a test PIN live only in the seed file. They exist only on the local
  stack and are never valid on the hosted project.
- **`scripts/dev-local.mjs`.** Starts `next dev` with environment overrides in
  the child process:
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `supabase status -o env`
  - `SESSION_SECRET` generated randomly per run
  - `ADMIN_EMAILS` unset

  Process environment takes precedence over `.env` in Next.js, so `.env` is
  neither read nor edited. The script refuses to start if the resolved
  Supabase URL host is not `127.0.0.1` or `localhost`.

- **`package.json` scripts.**
  - `db:start` runs `supabase start`, which applies all migrations.
  - `db:reset` runs `supabase db reset`, which re-applies migrations and the
    seed.
  - `db:stop` runs `supabase stop`.
  - `dev:local` runs `node scripts/dev-local.mjs`.
- **README.** A short "Local test stack" section with the four commands.

- **`next.config.ts`: `agentRules: false`.** Next.js 16.3 `next dev` appends a
  generated block to the governed `AGENTS.md` on every start. Found while running
  `pnpm dev:local`; the change was reverted and generation disabled.

## Results

Live check on 2026-10-23: signed in as the synthetic user, created the vault
with the test PIN, quick-added a $4.50 expense, reloaded, and the row decrypted
and persisted.

## Out of scope

- Seeding financial records. Tests create their own data through the UI.
- Playwright or other browser automation dependencies.
- CI use of the local stack.
- Any change to `.env`, `.env.local` or the hosted project.

## Acceptance

- [x] `pnpm db:start` applies every migration on a clean stack without errors.
- [x] `pnpm db:reset` recreates the synthetic user.
- [x] `pnpm dev:local` serves the app against `127.0.0.1:54321` only, and
      refuses a non-local URL.
- [x] Manual: sign in as the synthetic user, first-unlock with the test PIN,
      add an expense, reload, and confirm it decrypts and persists.
- [ ] `pnpm check && pnpm test:ci && pnpm build` green.

## Risk & reversibility

- **Blast radius**: developer tooling only. The hosted project and real data
  are not touched.
- **Reversibility**: a single `git revert`. `pnpm db:stop` and removing the
  Docker volumes clear all local data.
- **Backout plan**: revert the commit, then run `supabase stop --no-backup`.

## Open questions

- [ ] Q1: Approve `supabase` as a pinned dev dependency? — Owner: Clarence — A: Approved 2026-10-23; pinned at 2.120.0 (newest stable older than two weeks), with `supabase: true` added to `allowBuilds` for its binary download.
- [ ] Q2: Do all migrations apply on a clean database? Some may assume
      hosted-only state. This is checked during implementation; any failure is
      reported, not patched silently. — Owner: implementer — A: All 21 migrations and the seed apply cleanly on a fresh stack (2026-10-23).
