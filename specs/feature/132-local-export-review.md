---
id: '132'
slug: local-export-review
area: feature
status: shipped
author: Codex
created: 2026-10-11
approved: 2026-10-11
shipped: 2026-10-12
impl_pr: https://github.com/cljiahao/fynfo/pull/49
constitution_satisfies:
  ['§2.1', '§2.2', '§2.4', '§2.5', '§2.6', '§3', '§4', '§5', '§7.4', '§8']
constitution_overrides: []
---

# Spec132: Local personal JSON export review

## Problem and authorization

The shipped version3 personal export has nine domains but no way to check a file locally. Recovery draft091 predates scenarios and is not an approved restore contract. On2026-10-11 the owner requested a confirmation sweep and implementation alongside another session, then explicitly selected: “Local JSON validation and review only, with no writes or new dependencies (recommended)”. This records that bounded approval; it does not approve079 dependencies or091 restore/migrations.

## Constitution check

Client interaction/File APIs justify a client component (§2.5). No file/financial values are sent to server, logged, cached or persisted. Pages remain unchanged/thin; existing export reads/actions/encryption and all security/coverage/hooks stay unchanged. No new dependency, DB schema, crypto, auth, protected file or governance change. Named exports/Tailwind/existing primitives meet §§2–5. No constitutional override.

## Confirmation sweep decisions

- Keep JSON review distinct from PDF extraction and restore. Inspect actual v3/nine-domain export and v1/v2 legacy differences; no unconditional completeness claim.
- Use strict, non-transforming local schemas. Do not reuse write schemas that trim/uppercase/strip fields. Reject duplicate JSON object keys, unknown fields, nonfinite numbers, invalid dates/enums/allocations and duplicate record identities. Preserve supported values and year-zero YYYY-MM compatibility; no silent normalization. UI errors expose known domain locations only, never input values or arbitrary unknown property names.
- Review has independent conservative device limits:1MiB UTF-8 file,10000 aggregate domain/child rows,4096 characters per general string,32 nesting levels,10 scenarios and existing8192-byte scenario payload constraint. These are local review bounds, not validated backup/restore/host capacity. Existing exporter has no corresponding size limit; larger exports remain intact and report unsupported review size.
- Support exact version1 seven-domain, version2 eight-domain and version3 nine-domain shapes. Legacy absent dividends/scenarios are visibly absent, not zero records presented as evidence of completeness. Reject future versions or missing version-required domains. Finite current domain constraints bound review support; unsupported historical values reject visibly rather than rewrite.
- Return counts/version/export timestamp/legacy warnings only, not financial rows. Scenario record metadata is validated for inspection; no identity/revision remapping or writes occur. Strict scenario name validation preserves strings; no trim transform. No file authenticity, account ownership, coherence or recoverability assertion.
- Inline named file review below export controls avoids another task modal. Native file label, reading/error/summary/clear states, nine labeled domain counts and material limitations remain visible on mobile/keyboard. Results have polite status updates; clear returns focus to selection. Reset input so the same file can be selected again. File replacement/clear/unmount invalidates late async reads; vault gate unmount clears review. No file names, plaintext rows, raw errors, local storage/query cache/telemetry.

## Recorded paths before implementation

New: this spec; `src/features/profile/lib/export-review-constants.ts`, `export-validation.ts`, `json-review-guard.ts`; `src/features/profile/components/export-review.tsx`; `test/features/profile/export-validation.test.ts`, `export-review.test.tsx`.

Edits: profile `components/export-data-card.tsx`; README; `docs/audit/2026-10-11-pdf-import-preparation.md`. Existing preparation fixtures may be formatted only. No other product paths. Intermediate verification config/logs may live under this worktree's `work/` and must be removed before delivery; reuse installed matching dependencies read-only if available, never edit another checkout or install packages. No push/merge authorized here. Keep the existing named preparation branch.

## Out of scope

PDF export/reporting/extraction, editable rows, selected-record saving, remote upload, household review/restore, schema/dependency/crypto changes, populated-target import, empty-target restore, owner-binding/authenticity checks, changes to current export shape/filename, concurrent-session remediation, commits/pushes/merges and protected tooling changes.

## Acceptance

- Version1/2/3 and synthetic nonempty nine-domain review; exact legacy absence labels; empty/null supported; output contains no values/rows/file name.
- Unknown/future/missing-domain, duplicate keys (including escaped keys), invalid JSON/depth/UTF-8 size, duplicate IDs/month/relief/scenario request IDs, invalid dates/numbers/enums/shared allocations, scenario bounds reject without writes. Transformation controls preserve valid strings and decimal counts.
- Component selection/reading/replacement/clear/same-file/read-error/unmount/late-result behavior; visible limitations and native file label. No record action or upload path.
- Existing export tests pass unchanged; source review checks no network/storage/log imports and unchanged export hook/lib/actions. Independent second review pass in this chat; no subagent delegation requested.
- Scoped formatting/lint/type checks and meaningful tests first. Full unchanged check/test:ci/build/hooks/CI before executable PR; defer resource-heavy jobs while another session owns serialized verification. Record outstanding checks honestly; no shipped claim or red PR.

## Risk and reversibility

Malformed input can consume browser resources; pre-read file bytes, post-read UTF-8 size/depth/row/string bounds limit work. File.arrayBuffer cannot be physically aborted; generation invalidation prevents stale result disclosure and retains no file reference in state. The platform may retain transient memory until garbage collection; no secure-erasure promise. Strict UTF-8 decoding rejects malformed bytes instead of substituting characters. Counting a file cannot authenticate it or prove restore is possible. Revert only scoped application/docs/tests; no stored data changes. Existing financial exporter and its consumer contracts stay intact.

## Open questions and verification boundary

No further owner decision is needed for this selected local-only batch. Exact PDF dependency, coherent export/restore schema/security and heavy-verification scheduling remain separate. Confirmation source sweep is complete; implementation/test results will be recorded below without changing approval scope.

## Implementation verification

Implemented the approved local review and README contract in exactly the recorded product/test paths. Four focused synthetic Profile suites passed83 tests, including unchanged export suites. Scoped TypeScript passed with zero diagnostics and scoped ESLint passed. Separate source review found malformed UTF-8 substitution; strict decoding and a regression corrected it. Duplicate keys/unknown fields, counts-only output, version omissions, bounds and lifecycle were reviewed. Existing package/source/crypto/schema/protected files and parent worktrees were not edited.

Verification reused matching installed dependencies read-only with worktree-local tooling; no dependency install occurred. Full standard gates/coverage/build/hooks/CI and actual browser proof are still pending, deliberately not competing with the parent-owned serialized verification. Approval permits implementation, not skipping those release gates. No commit/PR/push/merge or shipped claim. The audit records tooling failures and their resolution separately from product evidence.
