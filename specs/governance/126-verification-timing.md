---
id: 126
slug: verification-timing
area: governance
status: shipped
author: Codex
created: 2026-10-11
approved: 2026-10-11
shipped: 2026-10-11
impl_pr: https://github.com/cljiahao/fynfo/pull/45
supersedes:
constitution_satisfies: ['§4.1', '§4.4', '§7.1', '§7.4', '§8.2']
constitution_overrides: []
---

# Spec126: Keep full verification before PR without duplicating it before commit

## Problem

Constitution §7.4 says “Follow §4 quality gates before commits or PRs.” Normal pre-commit runs check, and pre-push runs build, check and coverage. The recorded 122 delivery therefore ran the same complete application pipeline before commit and again in the unchanged pre-push hook, then independent CI. Its standalone coverage took about310 seconds. Repeating that full pipeline adds several minutes per batch without changing the tested source.

## Constitution check

This is a proposed workflow amendment under §§7.1/8.2, requiring explicit owner permission before editing or committing either affected path. All HARD quality, build, security and merge rules remain unchanged. No agent approval is inferred from the general audit or speed request.

## Solution shape

Exactly two paths: this governance spec and `CONSTITUTION.md`.

Replace the §7.4 sentence above with: “Before commits, run meaningful targeted regression checks and all active Git hooks. Before opening an executable PR, all §4 quality gates must pass on its resulting source; an unchanged pre-push run may supply that full local verification. Documentation-only edits may use formatting and diff review without an application build or runtime tests when no executable behavior changed.”

Retain the following existing documentation-only wording only once rather than duplicating it. Bump version4.0.0 to4.1.0 and append a factual amendment-log entry after owner approval. No AGENTS, hook, CI, manifest, dependency, receipt cache or script edit is included. Existing hooks still execute every command they currently require. Every aggregate coverage metric must exceed80% and stricter security floors remain unchanged. CI must pass on the exact PR head before merge.

## Out of scope

Skipping or modifying hooks, cached test receipts, reduced coverage, changed workers, secrets, encryption, migrations, dependencies, protected enforcement or CI changes. This does not make red commits/PRs acceptable or allow a changed source to reuse unrelated earlier evidence.

## Acceptance

- [x] Owner explicitly approves exactly these two paths and this timing change; record date/scope here.
- [x] Only §7.4 timing, version and amendment log change; all HARD rules and active enforcement bytes remain unchanged.
- [ ] Targeted regressions and normal pre-commit pass; normal pre-push supplies all five local gates before an executable PR is opened.
- [ ] Formatting/diff review and independent scope review pass for the documentation amendment; normal hooks and required CI are retained.

## Risk & reversibility

The local commit boundary becomes narrower, but full local verification remains mandatory before PR, and independent CI remains mandatory before merge. A failed pre-push blocks delivery and must be fixed; no hook bypass is permitted. Revert the two-file amendment if this sequencing proves inadequate. No application, persisted data or migration rollback is involved.

## Open questions

Clarence explicitly replied “Approve this timing change” on 2026-10-11 to the scoped request naming only `CONSTITUTION.md` and this spec. Approval covers the exact timing amendment, version bump, amendment log and committing these two files together. No hook, CI or other protected-file edit is authorized by this approval. Unaffected stabilization work continues.

## Preparation and independent review — 2026-10-11

The owner approval above was checked before preparing `impl/126-verification-timing` from merged main `89ed0cbaabac774d612da32f86adeeedaeadb962`. The previously frozen four-path123 donor remains preserved separately and in a retained scoped stash. This branch contains only the two approved governance paths.

The independent read-only review compared the actual constitution diff with the owner-approved timing proposal. Only the version, §7.4 verification timing and factual amendment log changed; all HARD rule text remains unchanged. No active hook, CI, enforcement, dependency or application file is included in this amendment. Installed Prettier's two-file check and scoped whitespace diff review passed on the reviewed proposal. The original reviewed SHA-256 values were `f3000e8beeffe68ad34b8c98a2018f51ece6f93cea24de2cfe08adba3721990f` for `CONSTITUTION.md` and `74ab5f8b835457e93e175ae1d18eca171c2264332e6d7a816db1612680f639d3` for this spec before this preparation record.

Normal unchanged hooks and exact-head CI remain delivery checks. This record does not claim those checks have run, that the amendment has shipped, or that the pending125 stabilization batch is complete. Heavy jobs remain held for the coordinated125 slot.
