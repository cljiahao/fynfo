---
id: 146
slug: statement-save-reliability
area: fix
status: draft
author: Codex
created: 2026-10-19
constitution_satisfies: ['§2.1', '§2.2', '§2.3', '§2.6', '§4.1', '§7.4']
constitution_overrides: []
---

# 146: Repair statement import saving

## Authorization and evidence before edits

Clarence reports importing the first 20 hangs/rejects; after refreshing only one expense was saved. Requests more than 20 and faster writes. Owner-authorized bug remediation under §7.4. Existing save loop dispatches one server action per row, invalidates and refreshes all expense history per confirmation, has no request deadline, and hard-blocks selections above 20. This explains a stall after one acknowledgement but does not prove a specific production error without logs. No private records or secrets inspected.

## Scope and implementation contract

Affected paths: expense read/import actions/schema/barrel/constants, use-statement-save hook and timeout helper, statement selection/save components, related import action/hook/UI regression tests, README import documentation src/lib/with-deadline.ts and this audit. Preserve positive-only SGD purchases, duplicate acknowledgement, insert-only writes, owner/vault gating and encrypted financial fields. No schema, dependency, crypto or protected-file change.

Allow selecting up to 500 eligible purchases, then automatically submit bounded groups of at most 20 and 512 KiB of serialized input in one server action/atomic insert per group. Reduce group size automatically for large source text to remain below the framework body limit. The small internal group bounds payload size and failure isolation; it is not a user-facing 20-row limit. Authenticate once per group, encrypt all financial fields, never upsert. On uniqueness rejection reconcile retained IDs against saved values, treating absent rows as definite rejection only when PostgreSQL confirms the entire insert rejected. Other ambiguous transport/database outcomes remain unconfirmed. Return fixed rejection reasons without database details. Refresh expenses once after dispatch, not per row. Retain original IDs for safe retry and stop on ambiguous/conflicting groups.

Bound server authentication/insert/reconciliation steps to eight seconds each and client duplicate checks, writes and recovery reads to thirty seconds. Bound the existing expense-history read action to fifteen seconds so duplicate/recovery and the final refresh cannot hold the action queue indefinitely; release the UI when overdue and preserve submitted identities as unconfirmed. No automatic retry after unknown writes. Ignore late acknowledgements and privacy-epoch changes. Show concise completed/total progress, pending counts and actionable failure/recovery messages. Warn on browser unload while an operation or unresolved write is retained. No raw statements or financial drafts persisted in browser storage. Existing pagination may continue displaying 20 rows per page independently of selection.

## Verification and rollback

Regression checks: >20 selection and automatic grouping; one DB write per group and one final cache invalidation; source/owner/encryption guards; duplicate-ID conflicts without overwrites; known SQL rollback versus unknown acknowledgements; hung compare/write/recovery timeouts and late results; privacy/unmount cancellation and retained IDs; clear progress. Independent review required, then full repository gates and CI. Compare request counts for a synthetic 45-row import rather than claiming measured production latency. Rollback is an ordinary source revert; no migration.

## Limits

Actual live error is unknown. A refreshed browser loses memory-only draft identities; reopening the same statement requires a new duplicate check against saved purchases. This patch must not claim cross-session idempotence or persist sensitive data to compensate. No whole-app security certification.

Independent review identified that client deadlines alone leave hung reads ahead of later server actions. The existing getExpenses action now bounds its response at fifteen seconds, delegates to the unchanged authenticated read, and preserves generic errors. Reads may complete later but never update the retained import state directly. Regression tests cover the server deadline and later reads proceeding.

## Final verification

Final source: 112 tests across six affected suites and typecheck passed. Second source review found no further actionable changes after the bounded expense-history response fix. Security review confirms grouped input validation, identity/vault gating, encrypted financial fields, insert-only DB writes, fixed rejection hints, and retained ambiguous identities. No production data or credentials used. Synthetic 45-row success requires three write actions rather than 45, with one final invalidation; this measures request count, not live latency. Browser success/progress confirmed; recovery verification and full gates follow.

Browser recovery verified on synthetic data: first 20 unconfirmed pause the remaining 25, continuation is disabled, an exact saved-values check confirms the retained 20 IDs, and continuation saves only the remaining groups. No live actions were loaded by the fixture. Deadline and late-result paths are covered by deterministic regression tests.
