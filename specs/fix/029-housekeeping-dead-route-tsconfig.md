---
id: 029
slug: housekeeping-dead-route-tsconfig
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-05
approved: 2026-06-05 # YYYY-MM-DD, set on approval
shipped: 2026-06-05 # YYYY-MM-DD, set on impl merge
impl_pr: direct-to-main (solo project) # link to impl PR, set on shipped
supersedes: # spec id, if applicable
constitution_satisfies:
  - '§4.1'
  - '§3.1'
constitution_overrides:
  - section: none
---

# Spec 029: Housekeeping — dead `/api` route + stale tsconfig exclude

## Problem

Two dead-config / drift items from the 2026-06-02 audit roadmap (Phase 0),
both mechanical, no behavior change for any live path:

1. **Dead duplicate route `src/app/api/route.ts`.** Byte-identical to
   `src/app/api/health/route.ts` except the log label (`api.root` vs
   `api.health`). It is not referenced by `API_ROUTES` (`routes.ts` exposes only
   `/api/health` + `/api/vault`). Worse, `test/api/health.test.ts` — named for the
   health check — imports the **dead** root route (`@/app/api/route`), so the real,
   constant-referenced `/api/health` endpoint is currently **untested** while the
   orphan route is the only one covered.

2. **Stale `tsconfig.json` exclude.** `"exclude": ["node_modules", "tests"]` lists
   `tests` (plural); the real dir is `test/`, so the entry matches nothing and is
   inert. Test files are already typechecked via `include: ["**/*.ts"]` (desired —
   `tsc --noEmit` catches test type errors). Removing the dead entry keeps that
   behavior and drops the misleading config.

## Constitution check

- Satisfies: `§4.1` (gates stay green), `§3.1` (no dep / stack change).
- Overrides: none. No `HARD` rule. No protected path touched
  (`tsconfig.json`, `src/app/api/route.ts`, `test/` are all agent-editable).

## Solution shape

- **Delete** `src/app/api/route.ts` (dead duplicate).
- **Repoint** `test/api/health.test.ts` to import `@/app/api/health/route` and
  request `http://localhost/api/health`, so the test now covers the canonical,
  `API_ROUTES.HEALTH`-referenced endpoint instead of the deleted orphan. No new
  test file; the existing one is corrected to its intended target.
- **`tsconfig.json`:** remove the inert `"tests"` element →
  `"exclude": ["node_modules"]`. No functional change (it matched nothing).

## Out of scope

- `/api/health` handler body (unchanged).
- Any auth-posture change to health endpoints.
- The governance-protected harness items (settings.json dead grants, AGENTS.md
  doc drift) — owner-applied separately; the `guard-protected-paths.ps1` hook
  blocks agent edits to those by design.

## Acceptance

- [x] `pnpm check` green
- [x] `pnpm test:ci` green; health test now imports `@/app/api/health/route`
- [x] `pnpm build` green (route table no longer lists a bare `/api`)
- [x] No reference to `@/app/api/route` remains
- [x] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius:** one deleted dead route + one test re-point + one dead config
  line. No live route, data, auth, or encryption path. `/api/health` (the only
  referenced health route) is unaffected and now actually tested.
- **Reversibility:** single `git revert`.
- **Backout plan:** revert the impl commit.

## Open questions

- None.
