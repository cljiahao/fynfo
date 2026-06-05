---
id: 012
slug: unlock-spec-authoring
area: governance
status: approved
author: Claude (Opus 4.8)
created: 2026-06-06
approved: 2026-06-06
shipped:
constitution_satisfies:
  - '§8.2'
constitution_overrides:
  - section: none
---

# Spec gov-012: Unlock specs/governance/ for agent authoring

## Problem

The harness denied agents Write/Edit on `specs/governance/**` (via
`permissions.deny` in `.claude/settings.json` and a `/specs/governance/` pattern
in `guard-protected-paths.ps1`). This was over-broad and self-contradictory:
spec-first (AGENTS section 1.2) requires the agent to AUTHOR specs, and every
other `specs/` area (`fix/`, `security/`, `refactor/`, `infra/`, `feature/`) was
already agent-writable. Only `governance/` was locked, so an agent proposing a
governance amendment had to dictate the full spec body for the owner to paste by
hand - friction with no security benefit.

The real human gate for a governance change is NOT the markdown proposal. It is:
(a) the `status: approved` field, (b) the owner-only edits to the enforcement and
governance-text files, which stay locked. A `status: draft` governance spec
authored by an agent authorizes nothing on its own.

## Solution shape (owner hand-applied - locked files)

- `.claude/settings.json`: removed `Write(specs/governance/**)` and
  `Edit(specs/governance/**)` from `permissions.deny`.
- `.claude/hooks/guard-protected-paths.ps1`: removed `'/specs/governance/'` from
  the `$protected` list.

## Security boundary after this change

Still locked (agent cannot Write/Edit; secrets also Read-denied):

- `.env*` (Read + Write), `.pem`/`.key`/`.p12`/`.pfx`/`.secret`, `credentials.json`/
  `.netrc`/`.secrets`, `./secrets/**`.
- `CONSTITUTION.md`, `AGENTS.md` (the files that override all other guidance).
- `.claude/settings.json`, `.claude/hooks/**`, `.claude/harness.json`,
  `.claude/skills/**` (the enforcement layer and its manifest).
- `.github/workflows/**` (CI integrity).

Now agent-writable: all of `specs/**`, including `specs/governance/`. The agent
drafts; the owner reviews, sets `status: approved`, and makes any locked-file
edits a governance spec calls for.

## Acceptance

- [x] Agent can Write `specs/governance/*.md` (gov-011 + this file authored
      directly, no hand-paste).
- [x] `.env.local`, `CONSTITUTION.md`, `AGENTS.md`, `.claude/settings.json`,
      `.claude/hooks/**` remain Write/Edit-denied for the agent.
- [x] `harness.json` rehashed (guard-protected-paths.ps1 + settings.json changed).

## Risk & reversibility

Loosens one guard scope; the high-value locks (secrets, enforcement, governance
text) are untouched. Revert by re-adding the three removed lines. Worst case an
agent drafts an unwanted governance spec - inert until the owner approves + merges
and makes the locked-file edits.

## Notes

Convention to preserve: only the human owner sets `status: approved` on a
governance spec. Agents author with `status: draft`. (Both gov-011 and gov-012
are marked approved here at Clarence's explicit direction in-session.)
