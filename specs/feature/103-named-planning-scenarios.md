---
id: '103'
slug: named-planning-scenarios
area: feature
status: draft
author: Codex
created: 2026-10-10
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  [
    '§1.1',
    '§2.1',
    '§2.3',
    '§2.5',
    '§3.2',
    '§4',
    '§5.1',
    '§5.4',
    '§7.4',
    '§8.2',
    '§8.3',
  ]
constitution_overrides: []
---

# Spec103: Private named allocation scenarios

## Problem

The dashboard allocation simulator loses hypothetical salary/expense inputs when its editor remounts. A user cannot name, reopen or compare a saved plan. Existing planner settings store only six plaintext preferences; they cannot hold confidential salary/asset inputs. Household goals are shared under K_h and do not provide personal scenario storage.

## Constitution check

Financial scenario values and name are sealed using existing encryptPayload/decryptPayload and personal DEK after verified identity/vault access (§2.1/§2.3/§5.1). No protocol/key change. Dedicated owner RLS and bounded reads preserve §4/§5.4. Client editor interaction is required (§2.5). New additive persistence needs explicit scoped approval (§8.2/§8.3); roadmap081 authorization alone does not approve this migration. No HARD rule is overridden. This external draft is not implementation approval.

## Current consumers and isolation

Evidence checked against095 merged base31482852 and scoped098 worktree:

- assets/components/salary-planner.tsx owns hypothetical inputs, automatically persists six preferences, derives savings/bonds from the current snapshot and publishes PlannerValues.
- assets/components/planner-inputs.tsx and planner-results.tsx already expose presentational setters and visual calculation results. Reuse these in a separate scenario dialog.
- assets/lib/salary-plan.ts computeSalaryPlan takes10 explicit inputs; its flat20% CPF, fixed5% insurance and9-month reserve funding model stay unchanged and visible.
- app/dashboard/(overview)/dashboard-overview.tsx sends live planner output to InvestmentBreakdown/InvestmentAllocation. A loaded saved scenario must never enter this callback: otherwise hypothetical inputs silently change downstream allocation suggestions.
- assets/actions/planner-actions.ts and hooks/use-planner-settings.ts remain unchanged. Loading a scenario must not trigger their autosave or overwrite existing preferences.
- profile/lib/export-data.ts and hooks/use-export-data.ts currently export eight personal domains with version2; add complete scenarios to a new version3 envelope while retaining existing qualified export lifetime/cleanup. No restore guarantee.

One dedicated table is necessary: no tracked owner-scoped encrypted generic vault storage exists. Existing planner_settings has fixed plaintext columns, while household storage intentionally uses shared K_h/membership. Extending either would blur their privacy/lifecycle contract. A generic encrypted object store is unnecessary for one bounded domain.

## Solution shape

### Payload and validation

Encrypt a strict JSON object with schemaVersion1, name (trimmed1..80chars), model:'allocation-flat-cpf-v1', currency:'SGD', capturedAt(valid UTC ISO timestamp), optional sourceSnapshotMonth(YYYY-MM) and inputs containing all existing SalaryPlanInput fields: salary, expenses, emergencyMonths, warChestMonths, titheEnabled, tithePctInput, allowanceEnabled, allowancePctInput, currentSavings, currentBonds. The two boolean fields remain boolean. Proposed scenario-only bounds: salary/expenses finite0..1e9; captured balances finite-1e9..1e9; months finite0..120; percentages finite0..100.

These new storage bounds require owner approval. Existing SalaryPlanInput has ten number/boolean fields and no runtime caps. plannerSettingsSchema permits fractional nonnegative months without an upper bound, percentages0..100 and booleans. Preserve fractional months instead of inventing integer-only input. Existing live planner/settings/asset schemas remain unchanged; out-of-range capture shows an explicit error rather than clipping it. Tiny positive salary can overflow expensesPct despite finite bounded inputs; qualify every computed numeric SalaryPlan field as finite before save/view and show unavailable on failure. Bounds alone do not prove safe arithmetic. No silent rounding/coercion. Validate action input and decrypted reads; unsupported versions/malformed/nonfinite data return opaque domain error, never zero defaults or skip-and-claim-complete.

Store the complete input snapshot, including captured balances. On load, display 'Hypothetical · saved [date]' plus SGD, flat20% CPF/fixed5% insurance/9-month reserve-funding assumptions visibly. Captured values do not automatically refresh from actuals. New saved plans capture today's current editor inputs explicitly; no record identifiers/account names or outputs need duplication in payload. Name/financial inputs never appear in SQL metadata or logs.

### One additive table and explicit RPC contract

Proposed migration filename: supabase/migrations/20261010000103_personal_planning_scenarios.sql (new file only after approval; no SQL written yet).

personal_planning_scenarios columns: id UUID primary key generated fresh by the database on each creation (immutable row incarnation, never a create caller argument); creation_request_id UUID not null (client request correlation, separate from row identity); user_id UUID not null references auth.users(id) on delete cascade; slot SMALLINT not null check1..10; payload TEXT not null; revision BIGINT not null default1 check>0; created_at/updated_at TIMESTAMPTZ not null. UNIQUE(user_id,creation_request_id) correlates a retried request only while its row exists. UNIQUE(user_id,slot) makes the10-record capacity enforceable during concurrent creation. Ciphertext length bounded to32KiB; encrypted payload decoded JSON bounded8KiB at action boundary. No additional index: PK(id) and the owner-scoped slot/request uniqueness indexes already support this bounded domain; no EXPLAIN or measured evidence justifies another index. No plaintext name/model/money and no SQL filter/sort on ciphertext. Owner-scoped reads sort by creation time thenid and retrieve at most10rows; revisions cross the JSON boundary as decimal text, never unsafe JavaScript BIGINT numbers.

Enable RLS; explicit select/insert/update/delete policies TO authenticated compare auth.uid() to user_id, with WITH CHECK for insert/update. Revoke anon/PUBLIC table access; authenticated grants only needed operations. Existing invoker atomic pattern retained; no service-role client. RPC result revisions are decimal TEXT, validated against the BIGINT range before client use; expected revisions are validated decimal strings passed to BIGINT parameters. CAS protects conforming application editors, not a claim that a malicious owner cannot directly overwrite their own row through an authorized table API.

Proposed SECURITY INVOKER RPCs with pinned search_path and PUBLIC/anon execute revoked:

- get_personal_planning_scenarios(): return at most10 caller-owned rows (id,creation_request_id,payload,revision::TEXT,created_at,updated_at), preserving RLS and deterministic metadata ordering.
- create_personal_planning_scenario(p_creation_request_id UUID,p_payload TEXT): derive user_id from auth.uid(); reject null auth and invalid lengths; insert the first free slot1..10 using INSERT ... ON CONFLICT DO NOTHING then examine returned row and recheck caller-owned creation_request_id after any conflict. Retry remaining slots inside the same transaction if another create wins. Generate a fresh server row id for an actual new insert. Return CREATED +id/revision or CAPACITY; duplicate caller-owned creation_request_id returns EXISTING +id/revision for reload, never overwrites ciphertext. Request identity is unique per owner; another owner using the same request UUID gains no information about this row. Ten unique slots cap capacity without advisory locks/new coordinator.
- compare_save_personal_planning_scenario(p_id UUID,p_expected_revision BIGINT,p_payload TEXT): update only caller-owned matching server row id/revision; preserve id/creation_request_id/owner/slot/created_at; increment revision and timestamp in the same statement; return SAVED/newrevision or CONFLICT. Guard BIGINT overflow as opaque unavailable/conflict. No user_id parameter.
- compare_delete_personal_planning_scenario(p_id UUID,p_expected_revision BIGINT): delete only caller-owned matching identity/revision; return DELETED or CONFLICT. No bulk wipe.

Action auth/vault/validation precede every query/RPC. Missing/stale/uncertain responses preserve the draft and require reload before retry. A creation request UUID belongs to one draft intent and never serves as row identity. EXISTING requires authoritative reload/review and never claims an identical payload merely because request UUID exists. Fresh server-generated row id plus revision qualifies later save/delete; deleting and replaying even the same creation request yields a different row id, so the old editor cannot modify the replacement. This follows spec083's distinction between logical month/request identity and parent incarnation.

There is no separate durable receipt/tombstone: correlation lasts only as long as the row. After delete, a stale create RPC can create a new row with fresh identity; no exactly-once or permanent anti-resurrection guarantee is claimed. On ambiguous create completion the UI reloads by creation request before retry. An absent row cannot establish never-created versus created-then-deleted, so it stops automatic replay, preserves the draft and requires an explicit new Save as new intent with a new request UUID. Export includes current rows, not invented receipt/deletion history. Direct owner table writers remain outside the RPC-only conflict/incarnation guarantees. No new crypto protocol.

### UI/data interfaces and exact planned paths

- src/features/assets/types.ts and schemas.ts: ScenarioPayload/ScenarioRecord, strict payload and identity/revision input schemas.
- src/features/assets/actions/scenario-actions.ts (new): getScenarios():ScenarioRecord[]; createScenario({creationRequestId,payload}):Created|Existing|Capacity|Conflict; updateScenario({id,revision,payload}):Saved|Conflict; deleteScenario({id,revision}):Deleted|Conflict. All requireActionContext, existing personal crypto, opaque errors.
- src/features/assets/hooks/use-scenarios.ts (new): existing query/mutation patterns with ['personal-planning-scenarios']; bounded invalidation, no global store.
- src/features/assets/components/planning-scenarios.tsx (new): named 'Saved scenarios' disclosure loaded only when expanded; Save current plan/name dialog and bounded list with Open/Delete. Essential source/model assumptions remain visible when viewing a plan.
- src/features/assets/components/scenario-dialog.tsx (new): isolated captured-input state, reuse PlannerInputs/PlannerResults + computeSalaryPlan, Save changes or Save as new. It never invokes onPlannerValuesChange/upsertPlannerSettings. Closing discards unsaved changes; identity/unmount/request guards suppress late UI output.
- src/features/assets/components/salary-planner.tsx: pass a snapshot of current inputs to the saved-scenarios disclosure; existing live planner/autosave/callback behavior stays intact. No top-level route or new shadcn primitive.
- src/features/profile/lib/export-data.ts, hooks/use-export-data.ts and existing export tests: add scenarios as ninth domain/version3; failed scenario read blocks download, lifecycle/cleanup guards preserved. Download remains confidential decrypted export, not proven restore.
- supabase/tests/103_personal_planning_scenarios.sql: isolated actual RLS/RPC tests.
- targeted scenario action/schema/UI tests, README and specs/feature/103-named-planning-scenarios.md; exact test filenames finalized in implementation record before edits. No protected-file edits.

## Out of scope

No personal-goal/recurring/budget tables, household reuse, actual financial record changes, comparison forecasting/tax engine, automatic rebase to live balances, advice/trading, share links, revision-history ledger, import/restore execution, dependencies, crypto changes, provider/settings/email/account access, or plaintext/localStorage financial persistence. No SQL or application implementation before approval.

## Acceptance

- [ ] Scoped migration/table/RPC/payload/privacy contract explicitly approved; approval hash recorded unchanged.
- [ ] Isolated SQL proof covers userA own CRUD, userB/anon denials, forged ownership, update WITH CHECK, same-request concurrent creates, revision races, stale delete/recreate including identical creation-request replay generating a different row id, ten-slot concurrent capacity, uncertain/retried creation while a row exists versus ambiguous post-delete replay, and ciphertext bounds.
- [ ] Actions prove identity/vault before DB, schema before encryption/write, ciphertext financial payloads, opaque errors and unsupported/corrupt payload failures. Existing crypto format retained.
- [ ] Mounted actual scenario editor proves load never invokes live PlannerValues callback, settings mutation, salary/snapshot/expense mutations; current planner remains functional. Closed/reopened/new-id editor rejects late results; stale edits retain drafts; capacity/conflict errors visible.
- [ ] Full10-field snapshot reproduces computeSalaryPlan outputs across zero/normal/fractional-month/negative captured balances; no invented refreshed balances. Proposed numeric bounds, tiny-positive-salary computed-result finite qualification and unsupported model/version are tested without changing live planner input contracts.
- [ ] Export v3 includes all scenarios or fails atomically before download; existing duplicate export/lifetime/URL cleanup regressions remain green. No restored-data claim.
- [ ] Desktop/mobile390px and keyboard dialog/disclosure proof; visible saved date and material model/currency assumptions. Impeccable applied within existing primitives.
- [ ] pnpm format:check/lint/typecheck/test:ci/build green; all aggregate metrics>80%, existing security floors unchanged and action boundary coverage qualified.
- [ ] Second independent review; application PR waits for owner confirmation SQL is applied before merge; no live credentials/private records accessed.

## Risk & reversibility

Blast radius is only private saved scenario storage/viewing and export. Primary risk is accidental live-planner/autosave mutation; isolated dialog/callback tests guard this. Capacity/CAS races tested in real isolated SQL, not mocks alone. Revert application commit/hide disclosure and retain encrypted rows; no destructive SQL rollback. Older export v2 remains readable by its existing documented future-version contract; this proposal does not execute restore or rewrite backups.

## Open questions / required scoped decision

- Owner: approve the single dedicated encrypted table, distinct server row incarnation/client creation request identities, row-lifetime-only request correlation (no durable receipt/anti-resurrection promise),10-record limit, proposed scenario-only typed version1 numeric bounds, owner RLS/invoker CAS/create/delete contract and export v3; no implementation authorization claimed until approved.
- Root: confirm migration filename and isolated SQL execution harness before seeking approval; no dependency/install workaround is authorized.
- Owner: apply reviewed SQL and confirm completion before application merge. Existing flat20% simulator assumptions remain; separate CPF eligibility/planner accuracy work is not silently folded into103.

## Primary references / guidance

[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) requires grants plus per-operation row policies and actual role tests. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) supplies scoped slot uniqueness and FK contracts. [INSERT](https://www.postgresql.org/docs/current/sql-insert.html) documents ON CONFLICT/RETURNING; slot conflicts must be retried rather than treating a skipped insert as success. Reuse previously reviewed project next-verify and Impeccable hardening guidance. TemplateCentral/frontend-design unavailable; no install/use claimed. No live providers/accounts/database or secret files inspected.
