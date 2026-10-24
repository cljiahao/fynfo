---
id: '153'
slug: deployment-wording-vercel
area: governance
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 5.5)
approved_by: Clarence
created: 2026-10-24
approved: 2026-10-24
shipped: 2026-10-24
impl_pr:
supersedes:
constitution_satisfies:
  - '§7.1'
constitution_overrides:
  - section: '§1.1, §6.1, §6.2'
    reason: 'Clarification only: the text describes a Raspberry Pi / Docker deployment that no longer exists. PATCH bump to 4.1.1.'
---

# Spec 153: Constitution deployment wording matches Vercel

## Problem

CONSTITUTION §1.1, §1.2 (Why), §6.1 and §6.2 say Fynfo is self-hosted on a
Raspberry Pi and that the Docker image `cljiahao/fynfo:latest` is the deployment
artifact. In fact Vercel builds and deploys `main` through its Git integration,
the owner decided to stay on Vercel, and no Dockerfile, compose file or image
build script is tracked. README "Production artifact" already describes the
standalone build. Agents reading the constitution get a false deployment model
(audit 152 finding G1).

## Solution

Reword the deployment text to match reality. No rule is loosened:

- §1.1: "Deployed on Vercel from `main`" replaces "Self-hosted on Raspberry Pi
  via Docker".
- §1.2 Why: "single Vercel deployment" replaces "single Pi / Vercel".
- §6.1 stays `HARD`: Vercel's Git integration deploying `main` is the only
  production path; no container image is built or published.
- §6.2: "Production = the Vercel deployment of `main`" replaces
  "Production = Pi".
- §8.2 "Push images to Docker Hub" stays as a prohibition.
- Version 4.1.0 → 4.1.1 with a history row.

## Out of scope

Any change to how deployment works, staging environments, or the
`scripts/build-push.sh` entry in AGENTS §0 (the file is absent; the entry is
harmless and is reviewed with G2).

## Approval

Clarence approved G1 on 2026-10-24 in the audit 152 planning session: "a
`specs/governance/` amendment plus a CONSTITUTION §1.1/§6.1 edit … a PATCH
version bump. Clarence approves the commit." Recorded in
`specs/audit/152-whole-repo-audit-2026-10.md` (Owner approvals). The commit
was approved by Clarence in chat on 2026-10-24 ("I approve G1 and G2 as diffed").

## Acceptance

- [x] No remaining "Raspberry Pi", "Pi runs" or "Watchtower" deployment claim
      in CONSTITUTION.md.
- [x] Version header and history row read 4.1.1.
- [x] `pnpm format:check` green.

## Risk & reversibility

Documentation only. Revert the commit to restore the prior wording.
