---
id: 055
slug: env-example-editable
area: governance
status: approved # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-27
approved: 2026-06-27
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§7.1'
  - '§7.2'
constitution_overrides:
  - section: '§8.2'
    reason: 'Narrows the ".env*" hard-stop to real secret env files; exempts .env.example (a committed placeholder template, already sanctioned by §5.3). HARD-adjacent scope change -> amendment, not per-spec override.'
---

# Spec 055: Make `.env.example` agent-editable (narrow the secret deny)

## Problem

The secret guard is too broad. `.env.example` is a **committed placeholder
template** — §5.3 explicitly says it "lists required keys with placeholder
values" — yet three layers block the agent from editing it:

1. `.claude/settings.json` deny: `Write(.env*)` / `Edit(.env*)` — the `.env*`
   glob matches `.env.example`.
2. `.claude/hooks/guard-protected-paths.mjs`: the `/\.env(\.|$)/` pattern matches
   `.env.example`.
3. `CONSTITUTION.md §8.2` + `AGENTS.md §0/§0.3` list `.env*` as a hard stop.

Net: the agent can't keep the example template in sync when a new env var is
added (e.g. spec 053's household work touched no env, but spec 005 added
`ADMIN_EMAILS` — that example update had to be done by hand). Real secrets
(`.env`, `.env.local`, …) must stay hard-blocked; only the non-secret template
should open up.

Owner intent (2026-06-27): hard-gate only real secrets/keys; `.env.example` is
freely editable; `settings.json` / `AGENTS.md` and the rest of the enforcement
layer stay permission-gated (unchanged).

## Constitution check

- Amends HARD rule `§8.2` per `§7.1` (owner self-approval) + `§7.2` (HARD change
  = amendment). `§5.3` is unchanged and already treats `.env.example` as the
  committed template — this aligns the guards with it.
- Out of scope by design: no change to the human-only status of
  `.claude/settings.json`, `hooks/**`, `harness.json`, `skills/**`, or to the
  rulebook draft-then-approve model (gov-013). Those stay gated.

## Solution shape

Replace the broad `.env*` matchers with the explicit real-secret set everywhere,
leaving `.env.example` (and only it) editable:

- **`CONSTITUTION.md §8.2`** — change the `.env*` hard-stop wording to "real
  secret env files (`.env`, `.env.local`, `.env.*.local`, `.env.development`,
  `.env.production`, `.env.production.*`, `.env.staging`) — **not**
  `.env.example`, the committed placeholder template (§5.3)". (agent-drafted,
  human-approved per gov-013)
- **`AGENTS.md §0` hard-stop #3 + §0.3** — same narrowing of `.env*` →
  enumerated secret files, exempting `.env.example`. (agent-drafted,
  human-approved)
- **`.claude/settings.json` deny** — replace `Write(.env*)` / `Edit(.env*)` with
  explicit `Write`/`Edit` denies for each real secret env file (mirroring the
  existing `Read(.env*)` enumeration), dropping `.env.example`. (enforcement
  layer — **drafted; Clarence applies**)
- **`.claude/hooks/guard-protected-paths.mjs`** — change the env pattern from
  `/\/\.env(\.|$)/` to `/\/\.env(?!\.example(\.|$))(\.|$)/` (negative lookahead
  exempts `.env.example` / `.env.example.*`). (enforcement layer — **drafted;
  Clarence applies**, then `/regen-harness` + re-hash)

No change to secret reads (`Read(.env)` etc. stay denied), destructive-bash
guards, the household feature, or any app code.

## Out of scope

- Moving `settings.json` / `AGENTS.md` from gated to an `ask`-prompt model —
  considered and **declined**: the enforcement layer stays draft-then-apply
  (the safer reading of "needs my permission"); rulebooks stay gov-013
  draft-then-approve.
- The Claude Code platform "self-modification" classifier — not configurable
  here; it independently gates the agent committing its own permission/guard
  changes and is intentionally retained.
- Any widening of secret access (reads of `.env`, `secrets/**`, certs/keys all
  stay denied).

## Acceptance

- [ ] `CONSTITUTION.md §8.2` + `AGENTS.md §0/§0.3` narrowed; `.env.example`
      explicitly exempted; constitution version bumped (PATCH — clarifies a HARD
      stop's scope without expanding secret access) + amendment-log row.
- [ ] `.claude/settings.json` deny enumerates the real secret env files; no
      `.env*` wildcard on Write/Edit; valid JSON; `Read(.env*)` denies unchanged.
- [ ] `.claude/hooks/guard-protected-paths.mjs` blocks `.env` / `.env.local` /
      `.env.production` but **allows** `.env.example` (verified: payload test
      exit 2 for secrets, exit 0 for `.env.example`).
- [ ] `/regen-harness` re-run; `harness.json` hashes updated for the edited
      settings + hook.
- [ ] `pnpm check` green.

## Risk & reversibility

- **Blast radius**: widens the agent-editable surface by exactly one non-secret
  file (`.env.example`). Real secret files, reads, and the rest of the
  enforcement layer are untouched.
- **Reversibility**: revert the spec + doc edits; restore the `.env*` wildcard in
  the deny-list + hook; re-regen harness.
- **Backout plan**: single revert of the governance commit + re-apply the broad
  matchers.

## Open questions

- [x] Q: Constitution bump PATCH (3.0 → 3.0.1) vs MINOR? — Owner: Clarence — A:
      **PATCH (3.0.1)** — narrows/clarifies a HARD stop's scope, expands access to
      no secret; removes an over-broad block on a non-secret template only.
