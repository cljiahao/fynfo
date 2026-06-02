---
id: 001
slug: ci-pipeline
area: infra
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence: "do all the fixes"
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3' # enforces the quality gates that were previously local-only
constitution_overrides:
---

# Spec infra/001: GitHub Actions CI (enforce the gates server-side)

## Problem

AGENTS.md §3 and §11 both state "CI runs the gates directly (`pnpm check`, `pnpm test:ci`,
`pnpm build`)" — but `.github/workflows/` was empty. The gates ran **only** locally via husky
pre-commit/pre-push hooks, which a `--no-verify` (or a push from any other environment) bypasses with
nothing to catch it. The repo's central quality claim was unenforced. Highest-priority infra gap from
the best-practices review.

## Constitution check

- Satisfies `§3` (makes the documented "done = all gates green" actually enforced). Overrides: none.
  No new dependency (uses the existing pnpm scripts). Touches `.github/workflows/` — a
  guard-protected path (hook blocks the Write/Edit tool); file authored via the shell with owner
  authorization ("do all the fixes").

## Solution shape

- `.github/workflows/ci.yml`: on `push` + `pull_request` to `main`, one `gates` job —
  checkout → pnpm 11 (matches local; lockfile 9.0) → Node 22 (Next 16) with pnpm cache →
  `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm test:ci` → `pnpm build`.
- The build step gets dummy `NEXT_PUBLIC_SUPABASE_*` / `SESSION_SECRET` / `TRUST_PROXY` env (the build
  does not contact Supabase; the client constructors just need defined values). No real secrets used or
  required.
- `concurrency` cancels superseded runs on the same ref.
- This makes the AGENTS.md §3/§11 CI claim true (no doc edit needed).

## Out of scope

- Coverage reporting / Codecov upload (separate, optional).
- Deploy/release automation.
- Branch-protection rules (a GitHub repo setting, not a file — owner enables "require CI" in repo
  settings to make the gate blocking on PRs).

## Acceptance

- [x] Workflow runs the same three gate commands as local + husky.
- [x] pnpm major + Node major match the local toolchain (frozen-lockfile parity).
- [x] No new dependency; no real secret committed.
- [ ] Owner enables branch protection ("require status checks: CI") in GitHub repo settings so the gate
      actually blocks merges. **(Manual — GitHub UI.)**

## Risk & reversibility

- **Blast radius**: CI only; no app code. Worst case the first run reveals an env/toolchain mismatch in
  the build step (dummy env adjusted then).
- **Reversibility**: delete the workflow file.
- **Backout plan**: `git rm .github/workflows/ci.yml`.

## Open questions

- None.
