---
id: 069
slug: owner-authorized-audit-remediation
area: governance
status: approved
author: Codex
created: 2026-10-08
approved: 2026-10-08
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§7.1'
  - '§8.2'
constitution_overrides: []
---

# Spec 069: Owner-authorized audit and remediation

## Problem

The owner requested a full review and improvement of the codebase, including
security, latency, duplication, maintainability, coverage, README, and comments.
The existing protocol stops all work for missing implementation specs and treats
enforcement files as never agent-editable, preventing ordinary audit remediation
and permission-based governance maintenance.

## Owner authorization

Clarence explicitly authorized amendment of `AGENTS.md` and `CONSTITUTION.md`
in this conversation on 2026-10-08: “lets amend the agents.md and constituition.
i allow that to happen now because i am planning to ask you to do a full sweep
and improve it.” The preceding request establishes the intended policy:
secret access stays blocked, `.env.example` is editable, and rulebook edits
require permission. Approval metadata records this human instruction, not agent
self-approval of an unseen audit or findings.

This amendment changes only the two rulebooks and this supporting spec. It does
not authorize edits to the active harness or baseline, dependencies, CI, or
deployment. The full codebase sweep remains a separate work phase.

## Constitution check

- Amends §7.1, adds §7.4, and updates §8.1–§8.3 under owner authorization.
- Bumps the constitution from 3.0.1 to 4.0.0 because the permission boundary
  changes. No SOFT overrides.
- Preserves architecture, encryption, authentication, RLS, PIN/key invariants,
  the pinned stack, and forward-only migration rules in §§2–6.
- Strengthens §8.2 to explicitly prohibit reading or exposing real secrets.

## Solution shape

- `CONSTITUTION.md`: introduce an owner-authorized audit path for reversible,
  evidenced remediation without a separate approved spec per ordinary finding.
  Require an audit record before each implementation batch and a second pass.
- `AGENTS.md`: align receiving tasks, hard stops, quality evidence, drift
  handling, and scope rules with the constitution. Define file inventory,
  consumer verification, security review, coverage, performance measurement,
  and README/comment maintenance expectations.
- Both rulebooks: require specific owner permission for governance, harness,
  CI, and build/push changes. Permission is scoped; a general audit request
  cannot authorize these changes or bypass hook/tool denials.
- Keep separate approval for new dependencies/features, migrations, and crypto
  protocol changes. Continue independent authorized work while a protected
  operation is paused.
- Record skill use in audit records, preserve Fynfo's templateCentral deviations,
  and distinguish harmless environment-variable documentation from secret access.
- Keep `CLAUDE.md` as `@AGENTS.md`; its pointer remains valid.

## Out of scope

- Application fixes or the full audit itself in this amendment batch.
- Changes to `.claude/**`, `.github/workflows/**`, `scripts/build-push.sh`,
  actual secrets, certificates/keys, dependencies, or migrations.
- Automatically regenerating the harness baseline or changing hook enforcement.
- Creating automatic commits, pushing, merging, or marking this work shipped.

## Acceptance

- [ ] The two rulebooks agree on audit authorization and protected operations.
- [ ] Ordinary audit remediation requires an owner request and a scoped record;
      it does not weaken existing application security invariants.
- [ ] Secrets are excluded from reading, output, and editing; `.env.example`
      remains editable with placeholders.
- [ ] Permission for rulebooks/enforcement/CI cannot be inferred from a general
      audit request; active denials cannot be bypassed.
- [ ] README/comments, consumer checks, security coverage, measured performance,
      skill scoping, and a second review pass are explicit audit requirements.
- [ ] Formatting of the changed Markdown and `git diff --check` pass.
- [ ] Diff contains only `AGENTS.md`, `CONSTITUTION.md`, and this spec; no
      executable behavior changes, so application tests/build are unnecessary
      for this documentation-only batch under §7.4.
- [ ] Any harness baseline drift is reported without silently accepting it.

## Risk & reversibility

- **Blast radius:** future agent decision-making. The audit exception could be
  misread as blanket permission; explicit scope records, protected-operation
  exclusions, and existing HARD invariants constrain it.
- **Enforcement:** actual hooks remain unchanged. The rulebook amendment does
  not implement secret-read guards or permission prompts in those hooks.
- **Manifest:** `AGENTS.md` is tracked in `.claude/harness.json`, so its approved
  edit changes the hash. Spec 065 documents an existing LF/raw-byte mismatch;
  report drift and seek a scoped reconciliation rather than regenerating all
  hashes. The manifest is not part of the current `pnpm check` gate.
- **Migration:** no application, data, or runtime migration. A separately
  authorized harness update is needed to align mechanical enforcement/baseline.
- **Reversibility/backout:** revert these documentation changes together;
  retain any unrelated working-tree changes.

## Open questions

None for this document amendment. Actual hook changes and manifest reconciliation
require a separate concrete proposal and permission.
