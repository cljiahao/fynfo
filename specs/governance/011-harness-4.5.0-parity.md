---
id: 011
slug: harness-4.5.0-parity
area: governance
status: shipped
author: Claude (Opus 4.8)
created: 2026-06-06
approved: 2026-06-06
shipped: 2026-06-06
constitution_satisfies:
  - '§8.2'
  - '§7.1'
constitution_overrides:
  - section: none
---

# Spec gov-011: Adopt templateCentral 4.5.0 harness hardening (PowerShell port)

## Problem

templateCentral plugin advanced 4.2.0 -> 4.5.0. The AGENTS.md `@4.0.0` marker is a
migration schema floor and stays pinned (4.5.0 lint guards against bumping it).
4.5.0 ships harness hardening Fynfo lacks. Fynfo runs a PowerShell fork (section 9),
so changes are ported, not copied. Gaps:

1. Secrets are Read-able. Harness blocks writing `.env*` but an agent can `Read`
   `.env.local` (SESSION_SECRET, Supabase keys) - violates the zero-knowledge
   posture (section 10). 4.5.0 adds `permissions.deny` Read-blocks.
2. `--no-verify` not blocked. `guard-destructive-bash.ps1` blocks
   force-push/reset/branch-delete but not `git commit --no-verify`, which bypasses
   the Stop test gate + pre-commit hooks.
3. Context re-inject on PostCompact is unreliable (observability-only). 4.5.0 moves
   re-injection to SessionStart(compact).
4. Injection guard is LLM01-only with a false-positive `you are now a` pattern; no
   LLM02 credential-leak detection.
5. `Bash(cat:*)` auto-grant lets the shell read secret files (the Read-deny in item
   1 covers the Read tool but not bash `cat`).

## Solution shape (all hook-protected paths; owner hand-applied)

- `.claude/settings.json`: `permissions.deny` Read-blocks for `.env*`/secrets;
  remove `Bash(cat:*)` from allow; drop PostCompact (replaced by item 3).
- `.claude/hooks/guard-destructive-bash.ps1`: add `--no-verify` + source-dir `rm`
  patterns.
- `.claude/settings.json` SessionStart: re-inject AGENTS.md + CONSTITUTION.md heads.
- `.claude/hooks/injection-guard.ps1`: prune false-positive, add jailbreak variants
  - LLM02 credential-leak regexes.
- `.claude/harness.json`: bump `templatecentral_version` 4.2.0 -> 4.5.0; rehash.

## Out of scope

- AGENTS.md `@4.0.0` marker - stays pinned (schema floor).
- Bash/Node hook scripts 4.5.0 seeds - Fynfo stays PowerShell (section 9).
- Supabase/Drizzle, app code.

## Acceptance

- [x] `Read(.env.local)` denied; `.env.example` still readable.
- [x] `git commit --no-verify` blocked by guard (exit 2).
- [x] SessionStart re-injects AGENTS + CONSTITUTION heads; PostCompact removed.
- [x] injection-guard blocks AKIA/sk-ant/PEM/DB-URL + jailbreak variants; no
      false-positive on "you are now a reviewer". (8/8 smoke tests PASS.)
- [x] `harness.json` version = 4.5.0, hashes recomputed.
- [x] `pnpm check && pnpm test:ci` green (271 tests).

## Risk & reversibility

Harness-config only; no app/runtime path. Revert via `git revert`. Each guard
functionally smoke-tested (block/allow) before commit.
