---
id: 013
slug: telemetry-write-exception
area: governance
status: shipped
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-11
approved: 2026-06-11
shipped: 2026-06-11
constitution_satisfies:
  - '§7.1'
  - '§7.2'
constitution_overrides:
  - section: '§2.2'
    reason: 'Adds /api/track to the reserved API-route list for anonymous, non-PII, non-financial telemetry. HARD change → constitutional amendment, not per-spec override.'
  - section: '§2.3'
    reason: 'Narrows "public actions don''t exist" to permit vault-free anonymous telemetry ingestion + admin aggregate reads of non-encrypted data.'
  - section: '§8'
    reason: 'Widens agent edit-scope: rulebooks (CONSTITUTION/AGENTS/CLAUDE) + specs are agent-editable with human approval; enforcement layer (.claude/settings.json, hooks, harness, skills) + secrets + CI remain human-only.'
---

# Spec 013: Telemetry write exception (§2.2 / §2.3 / §8 amendment)

## Problem

The constitution assumed every mutation is an authenticated, vault-gated server action ("public actions don't exist"). Anonymous storefront telemetry (page views, CTA clicks) and a private admin view of aggregate counts had no legal home: §2.2 banned new mutation API routes, §2.3 banned public/vault-free actions. Feature spec 004 was blocked behind this. Separately, the harness blocked the agent from editing any governance file, forcing manual copy-paste for every amendment even though all such files are git-reviewable and non-executable.

## Constitution check

- Amends HARD rules §2.2 and §2.3, and §8 agent-scope, per §7.1 (owner self-approval) and §7.2 (HARD rules require amendment, not per-spec override).

## Solution shape

- **§2.2**: add `/api/track` to the reserved API-route list + a "telemetry carve-out" paragraph constraining it to non-financial, non-PII, no-identifier tables with boundary validation.
- **§2.3**: scope it to "actions/reads touching encrypted feature data"; allow two vault-free exceptions — anonymous telemetry ingestion, and admin aggregate reads of non-encrypted data (still `requireUserId()` + admin allowlist).
- **§8.1 / §8.2**: agent may DRAFT amendments to `CONSTITUTION.md`/`AGENTS.md`/`CLAUDE.md`/`specs/governance/*` (human approves the diff before commit); the enforcement layer (`.claude/settings.json`, `.claude/hooks/**`, `.claude/harness.json`, `.claude/skills/**`), `.env*`, `.github/workflows/**`, `scripts/build-push.sh`, and cert/key files remain never-agent-editable.
- **Harness**: `guard-protected-paths.ps1` drops the `CONSTITUTION.md`/`AGENTS.md`/`CLAUDE.md` patterns; `.claude/settings.json` `deny` drops the rulebook entries and adds `.claude/hooks/**` + `.claude/harness.json`. (Applied by Clarence — enforcement-layer files are human-only.)
- Bump `CONSTITUTION.md` to v2.0; add amendment-log entry.

## Out of scope

- The telemetry feature itself (that is `specs/feature/004`).
- Any change to financial-payload encryption (§2.1), RLS mandate (§5.2), or PIN/DEK invariants (§5.1) — all unchanged.

## Acceptance

- [x] `CONSTITUTION.md` §2.2/§2.3/§8 amended; version → 2.0; amendment log updated
- [x] `.claude/settings.json` + `guard-protected-paths.ps1` relaxed by Clarence (rulebooks editable; enforcement + secrets locked); settings.json valid JSON
- [x] `specs/feature/004` unblocked (depends_on satisfied)

## Risk & reversibility

- **Blast radius:** widens the sanctioned write/read surface by exactly one route + one read class, both fenced to non-PII non-financial data, plus agent edit access to git-reviewable rulebooks. Financial-data invariants, the enforcement layer, and secrets are untouched.
- **Reversibility:** revert the constitution diff; re-add the guard patterns + deny entries; spec 004 re-blocks.

## Open questions

- [x] Q: v2.0 (MAJOR) vs v1.1? — Owner: Clarence — A: v2.0 (HARD rules changed; §7.1 semver = MAJOR for HARD).
