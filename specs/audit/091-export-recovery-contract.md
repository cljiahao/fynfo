---
id: '091'
slug: export-recovery-contract
area: audit
status: draft
author: Codex
created: 2026-10-10
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  [
    '§2.1',
    '§2.2',
    '§2.3',
    '§2.4',
    '§3.1',
    '§4.1',
    '§4.2',
    '§5.1',
    '§5.2',
    '§6.3',
    '§7.4',
    '§8.2',
  ]
constitution_overrides: []
---

# Spec091: Personal export and empty-vault recovery contract

## Problem

Fynfo downloads a plaintext personal export but cannot restore it. Independent domain reads and offset pagination can observe concurrent changes; exact counts do not prove a coherent backup. Running existing individual save actions in sequence would risk a partial restore. A useful recovery workflow must preserve the current account, keys and existing records and report uncertain outcomes honestly.

Source basis: managed main b18373b1f36e646bc7e1478b468784643294a16e, roadmap081 batch G, 2026-10-10. The owner authorized investigation and roadmap delivery, not this unreviewed migration. This document remains DRAFT. No SQL, dependency, crypto, protected-file or product edits are authorized by this proposal.

## Constitution check

Preserve identity→vault guard ordering, feature-owned server actions and thin pages, existing AES-GCM payload format and derivation/session semantics. No raw key, PIN, auth cookies or vault canary is exported/restored. New receipts have RLS and explicit restricted grants in the same additive migration. No delete, truncate, replacement of populated records, household merge or auth-account mutation. No constitutional override is proposed.

## Solution shape and delivery separation

### A — ordinary export qualification and proof (no migration)

Affected paths: profile export card/hook/lib, their tests, README and scoped audit record. Name this operation export in UI/tests; keep plaintext/household limitations visible and add concise no-restore/consistency guidance. Exercise every domain failure, nonempty values, complete paged reads, failed decrypt, late-unmount success/failure, temporary URL/anchor cleanup including download exceptions, and synthetic browser download. Use finally cleanup and, if same-tick duplicate invocation is reproduced, a synchronous in-flight guard. This ordinary batch may proceed under existing owner §7.4 scope after separately recording exact paths/evidence. It does not claim recovery support or a coherent DB snapshot.

### B — additive coherent export read (specific migration approval required)

Proposed path supabase/migrations/20261010000003_export_recovery_contract.sql (confirm unused timestamp before implementation), profile/actions/recovery-actions.ts, profile/lib/export-validation.ts, profile schemas/types/public exports, export hook and test/security/export-recovery.sql. This is a proposal, not SQL implementation.

Add get_personal_export_ciphertext(): one owner-filtered SQL STABLE SECURITY INVOKER RPC returning a single JSONB object with all eight personal domains and child rows. Every table and nested subquery derives ownership from auth.uid(), never a caller user ID. Revoke PUBLIC/anon execution, grant authenticated; existing RLS still applies. Authenticated app server action calls requireActionContext() first, then RPC, validates its returned structure and decrypts existing encrypted fields in process. Service-role bypass is unnecessary. RPC excludes auth identities, email/name/image, vault verification fields, household tables, revisions/operational history and receipts. Export domain profile means only birthYear/isNsman/residencyStatus.

STABLE SQL function uses the calling query snapshot, so its read-only queries see one fixed view. Prefer one SQL statement with independent domain subqueries and deterministic order; avoid VOLATILE helper reads that acquire fresh snapshots. Return aggregated JSON, not SETOF rows subject to API row caps. Count all parents AND children in the same snapshot and reject oversize results before building large aggregates. Never truncate a domain, page a changing snapshot, or fall back to old independent reads while claiming coherent recovery.

Proposed initial hard limits for owner review: 10000 aggregate rows including children; ciphertext RPC JSON <=768KiB; downloaded plaintext JSON <=1MiB. Exact local measurements and existing host request limits must validate these conservative bounds before approval is finalized. Over limit returns a clear capacity error with zero partial file; larger capacity is a later measured design, not silent omissions. Complete means all supported personal domains within declared bounds; household remains expressly excluded.

Keep envelope version2 for the existing plaintext shape; coherent snapshot is a runtime property, not invented provenance for old files. Do not imply file encryption/authenticity. A separate version is needed only if fields change.

### C — local review and additive empty-vault atomic restore (specific migration approval required)

UI uses a dedicated review dialog/page launched from Profile. File selection parses locally; no automatic uploads or writes. Show eight domain counts, missing-version1 dividends, target account confirmation, plaintext warning and empty-vault restriction visibly. Optional row details use named disclosures. Confirmation sends only validated domain values to the authenticated feature action. No selected file or plaintext is retained in localStorage, IndexedDB, logs, telemetry or query cache. Leaving review/signing out/locking clears in-memory state.

Proposed frontend paths profile/components/restore-data-dialog.tsx, hooks/use-restore-data.ts, lib/export-validation.ts, schemas/types/index.ts; use existing primitives/dependencies. Implement Impeccable and existing project skill guidance within the present design system when UI is approved; no skill installation/modification.

Validation: exact app=fynfo, integer supported version, valid timestamp, bounded UTF-8 file bytes before parse, bounded aggregate rows and per-field strings, finite numbers, valid actual dates/months, enums/currencies, all required domains, unique expense/trade/dividend IDs and snapshot/salary months, relief(year,key) uniqueness and valid split allocations. Reuse current schemas through feature-owned public exports, but preview must not silently uppercase tickers, strip unknown fields or otherwise transform saved values. Reject unknown envelope/domain fields with field-local explanation or explicitly classify approved legacy compatibility fields. Never accept user_id/auth identifiers, key material, ciphertext or client-supplied restore permissions.

Version2 requires dividends. Version1 may be supported with a reviewed adapter that explicitly displays dividends absent and restores an empty dividend domain; do not imply old file completeness. Reject unsupported/future versions. Existing files contain no owner binding or authenticity proof: confirmation declares the user intends to import this file into the signed-in target account, and SQL always binds to current auth.uid(). This supports a fresh account holding the owner's plaintext export; it cannot authenticate the file author or recover old ciphertext with a forgotten PIN. Material limitations remain visible.

Existing globally unique row IDs cannot be copied into another account. Remap imported expense/trade/dividend IDs and child/parent storage IDs to freshly generated IDs once per operation, retaining stable in-memory mapping for retries; snapshot/salary month and relief keys stay domain identities. Old snapshot revisions are never restored: new server identities and initial revisions use the deployed snapshot schema, preventing editors from inheriting stale concurrency tokens. Canonical roundtrip comparison ignores storage IDs but preserves domain fields, child grouping, currencies and decimal values. Determine duplicated same-date trades by file row identity, not heuristic deduplication.

Server action revalidates all values and bounds, gets current target key through requireActionContext(), encrypts only the same fields encrypted by current save actions, and makes one RPC call. Never reuse exported ciphertext or source vault verification material. Profile/planner fields follow existing plaintext database treatment; no security expansion or new encryption protocol. Prepared ciphertext and remapped IDs remain only in operation memory and are reused byte-for-byte for transport retries; changing the reviewed file creates a new operation.

Proposed RPC restore_personal_export_empty(p_operation_id uuid,p_payload jsonb) and read_personal_restore_status(p_operation_id uuid). No caller user ID. Status requires app auth+vault guards and SQL own-owner predicate. Add public.personal_restore_receipts: composite owner/operation identity, ciphertext-request fingerprint, committed timestamp and bounded outcome counts; no plaintext financial values, filename, file digest, key or original-account identifier. RLS enabled, with direct table privileges revoked from PUBLIC/anon/authenticated so a client cannot forge committed receipts. The mutation/status functions require narrowly scoped SECURITY DEFINER with fixed empty search_path, fully qualified objects, no dynamic SQL, explicit auth.uid() checks on every owner association and restricted authenticated EXECUTE only; no caller user ID or service-role client. Preserve enabled RLS on financial tables and independently test the explicit owner boundary because definer ownership can bypass policies. This privilege contract is part of the requested migration approval. Functions must compute binding over canonical JSONB prepared ciphertext plus existing non-financial metadata with PostgreSQL built-in SHA256, never a low-entropy plaintext financial/file hash. This request binding is idempotency metadata, not a file authenticity signature; its schema and exact binding are part of this approval. Confirm built-in function support locally; no extension/new dependency is assumed.

Atomic write transaction: authenticate; look up completed same-owner receipt; replay identical request returns the recorded committed outcome without writing, different payload under same operation ID returns conflict; verify valid target vault initialization exists without changing canary/version; verify target personal financial tables and planner settings are empty and demographic profile fields are unset/default; validate every payload relationship and bound; insert all personal financial rows without overwrite/upsert; update only demographic profile fields; append receipt in the same transaction. No exception swallowing or partial-domain success. Null profile leaves defaults unchanged. A non-default profile/planner is a populated target and must be reviewed elsewhere, never overwritten here. Existing empty vault verification row/auth metadata is allowed and preserved.

Empty check and writes must execute with demonstrated SERIALIZABLE transaction semantics, using PostgREST per-function isolation settings only if local replay proves they are hoisted before the transaction starts on the supported deployment contract. An ordinary function-body SET after queries begin is inadequate. Do not broaden every existing mutator or introduce table-wide locks as an unreviewed fallback. Serializable means equivalent serial ordering; an independent append may serialize after restore, but no conflicting record is overwritten and a stale empty check must never authorize partial replacement. A serialization failure is an explicit retryable conflict after whole-transaction rollback. Two distinct concurrent restore operations may commit at most one. Any uniqueness/FK/validation failure rolls back data and receipt together.

Outcomes: committed, already-committed, target-not-empty/conflict, validation-failed, locked/unauthorized, capacity-exceeded, or uncertain transport. Missing reply is never reported as failed rollback or success. Keep the file/review draft, disable fresh repeat submission, query own operation status; present committed receipt when found. If status says absent, a retry uses the same ciphertext/IDs/operation ID. After reload loss of prepared ciphertext, check status first; a committed receipt proves transaction completion only, not equality to later-edited live data. A fresh operation after absence may only proceed through a new review; empty-target guard still applies. Receipt lifetime initially lasts with the account, bounded to one row per successful empty restore; no purge policy that weakens retry proof is implied.

## Primary research and evidence

[PostgreSQL volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html) establishes fixed calling snapshots for STABLE functions, unlike VOLATILE internal queries. [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) establishes serializable outcomes and whole-transaction retries. [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html) documents request transactions, default Read Committed, per-function isolation settings and rollback on failure. [Supabase functions](https://supabase.com/docs/guides/database/functions) recommends invoker security and explicitly restricting function execution. [PostgreSQL binary functions](https://www.postgresql.org/docs/current/functions-binarystring.html) documents built-in SHA256. These are architectural contracts, not proof of the actual hosted version/configuration; local replay and rollout confirmation are required.

Synthetic helper proof 089-recovery-pagination-proof.json shows same-count replacement returning A,B,B,C without a count failure. Reviewed existing export, flat/nested history and pagination tests prove ordinary read completeness/failure handling, not coherent recovery. No real backups/credentials/PINs were inspected.

## Out of scope

Encrypted offline file format, new encryption/derivation, forgotten-PIN decryption, ciphertext-only restore, populated-vault merge/replace, auth identity/password changes, household restore/keys/invites, revision history, cross-account automatic matching, scheduled backups, filesystem persistence of selected data, schema changes to existing financial rows, protected/CI/skills edits, new dependencies and production SQL execution by agents.

## Acceptance

- [ ] Exact migration/limits/ownership/idempotency choices approved by Clarence and approval recorded; this draft must not be self-approved.
- [ ] Full local fresh-DB replay of migration under actual supported PostgreSQL/PostgREST assumptions; no production access.
- [ ] Coherent export equality across eight nonempty domains, >1000 rows, nested children, lower API cap, concurrent replacements during a deliberately delayed single snapshot; size limits reject whole export.
- [ ] Synthetic export→local review→fresh target restore→re-export canonical domain equality; same/new target keys use unchanged encrypt/decrypt helpers with synthetic keys.
- [ ] Malformed/unsupported/unknown-key/duplicate/relationship/oversize files fail with zero writes; legacy version1 dividends warning explicit.
- [ ] SQL tests inject failure at every domain and verify original data/profile/vault metadata and receipt unchanged; RLS rejects other-owner reads/writes and anon/unauthorized roles.
- [ ] Concurrent save/restore and two distinct restores prove no overwrite/partial commit; actual RPC isolation is checked, not inferred from Promise.all.
- [ ] Lost reply then status lookup/retry gives exactly one committed restore; changed payload with same operation ID rejects; receipt absent on rollback.
- [ ] Stale account/vault context and lock/unmount clear local review and block late UI disclosure; no plaintext/key logs or persistence.
- [ ] Synthetic desktop/mobile/keyboard preview, confirmation, conflict and uncertain outcome browser proof; essentials stay visible.
- [ ] pnpm check, pnpm test:ci and pnpm build green in isolated synthetic fixture; every aggregate coverage metric >80%, stricter security floors unchanged; independent second review.
- [ ] README/comments accurately explain plaintext, supported domains/limits, new-account ownership, unsupported forgotten-PIN/household recovery and conflict outcomes.
- [ ] Production migration owner-applied and confirmed before caller application merge; PR required checks green at exact merge head.

## Risk and reversibility

Blast radius is Profile export/restore and the signed-in account's personal domains. Coherent export increases bounded query/serialization cost; restore introduces cross-domain transaction and idempotency attack surfaces. Validation is defense in depth; RLS/SQL guards are mandatory. Existing security assumptions and encrypted field layout remain unchanged.

Before rollout back out application code with git revert; additive functions/table may remain inaccessible or revoked through a separately reviewed forward migration. Do not delete completed restore data or receipts as rollback. A committed restore is data creation and cannot be undone by reverting application code; any owner-requested removal requires a separately approved exact data operation and verified backup. Test-only failure injection is confined to a disposable synthetic database.

## Open owner decisions

- [ ] Clarence: approve part B coherent ciphertext read RPC and part C empty-vault-only atomic restore, additive receipt table/RLS/functions, ciphertext-request binding and named migration? Approval excludes production execution by agents and all populated-vault replacement.
- [ ] Clarence: allow deliberate import into a fresh target account despite legacy exports having no authenticated owner binding? Recommended yes, with explicit target confirmation and no authenticity claim.
- [ ] Clarence: support version1 with visible missing-dividends warning, or require version2 only? Recommended explicit version1 adapter.
- [ ] Clarence: accept proposed initial bounds (10000 aggregate rows,768KiB ciphertext,1MiB download), adjusted only after measured fixture/host-contract review? Approval must record final exact limits.
- [ ] Implementer/reviewer before approval: prove supported PostgREST transaction isolation hoisting, receipt grants/RLS, stable snapshot function and built-in request fingerprint canonicalization. If unavailable, revise this draft rather than downgrade atomicity or bypass constraints.
