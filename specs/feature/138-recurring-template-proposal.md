---
id: '138'
slug: recurring-template-proposal
area: feature
status: approved
author: Codex
created: 2026-10-13
approved: 2026-10-13
shipped:
impl_pr:
constitution_satisfies: ['§1', '§2', '§3', '§4', '§5', '§7', '§8']
constitution_overrides: []
---

# Spec 138: Monthly confirm-to-save templates — staged occurrence contract

## Problem

Monthly bills/subscriptions need repeated entry, but automatically recording them
would mistake an expected payment for actual spending.

## Constitution check

Preparation only, with separate owner review before implementation. Preserve
personal-vault encryption, identity/vault gates, server mutations, RLS, pinned
stack, incumbent UI and full gates (§§1–5). Persistent template/occurrence SQL and
crypto identity design need explicit reviewed approval (§§7–8). No old SQL approval
or roadmap direction supplies that approval. No constitutional override requested.

## Solution shape

- Operate mode: monthly review lists due/overdue self-expense templates. Each opens
  an editable expected expense showing template, intended occurrence month and
  actual date/amount/category/notes. Only an explicit confirm button records it.
  Viewing, opening, editing, changing months or time passing never writes expenses.
- Monthly only initially. Template defines start month, optional inclusive end
  month, preferred day 1–31, positive SGD default, existing category/item/notes
  and enabled state. Scheduling uses Singapore calendar dates, not host UTC or
  browser travel timezone. Day beyond month's length clamps to its last day:
  day 31 becomes February 28/29; later months retain preferred day 31.
- Occurrence identity is template ID plus intended YYYY-MM, regardless of edited
  actual save date. Moving the date into March does not turn February's occurrence
  into March's or suppress March's separate review. Cloning makes a new template
  and visibly creates a new series, with provisional semantic duplicate warnings.
- No automatic catch-up mass creation. Show selected month and a bounded earlier
  month navigator; user explicitly reviews each occurrence. Future occurrences
  are labeled planned and unavailable for confirmation initially. Missing months
  remain unresolved until explicitly confirmed or skipped.
- Explicit Skip records that month's skipped occurrence. Template edits affect
  only unconfirmed/unskipped occurrences; confirmed rows retain their saved values.
  Disable stops suggestions without deleting history. Enable does not write
  missed months. Month-end and backdated-edit semantics stay visible.
- Persistent candidate: encrypted versioned template payload with owner/random
  ID/revision; encrypted occurrence receipt containing intended month, outcome,
  frozen request/payload and linked expense ID. Atomic confirm must reserve the
  occurrence and insert self expense in one transaction, preserving RLS. Atomic
  skip must compete with confirm; one outcome wins. Revision checks protect stale
  template and occurrence review across tabs.
- Plaintext template/month uniqueness leaks schedule correlations. Do not approve
  plaintext semantic keys or an unkeyed amount/merchant/date hash. Exact opaque
  occurrence token/uniqueness design and its key derivation/rekey behavior must be
  reviewed separately; no new crypto primitive is selected in this draft.
- Retain stable request and occurrence identity after lost acknowledgement;
  authoritative receipt reads distinguish confirmed/skipped/conflict. Deleting or
  editing linked expense never makes that occurrence due again automatically.
  Receipt remains with a visible missing/changed link; any recreate/reset requires
  a separate explicit reviewed operation. Generic insert-only 136 is insufficient
  for durable recurring occurrence exclusion across sessions and after deletion.
- Fetch/decrypt owner data for due calculation; never SQL-filter ciphertext.
  Recovery export/local review and PIN rekey include both new domains before
  rollout. Retention/disable/delete/recovery and exact RPC/grants/RLS need a final
  reviewed schema contract. No unattended scheduler, notifications or dependency.

Planned paths after approval: new recurring-expenses feature actions,
types/schemas/lib/hooks/components/index; expenses composition; profile
export/review and rekey consumers; exact migration; focused synthetic action,
calendar, occurrence/concurrency and component tests; README/spec. Exact filenames,
limits and schema are to be recorded before implementation.

## Out of scope

Automatic charges/saves, daily/weekly schedules, bank payment detection,
household/shared expenses, budgets, real banking integrations, notifications and
bulk catch-up. No implementation, SQL, dependency or crypto changes authorized.

## Acceptance

- [ ] January 31 → February 28/29 → March 31 and Singapore midnight/year rollover;
      inclusive start/end, disable/enable and explicit catch-up tested.
- [ ] Edited actual date preserves intended month identity; changing template
      affects future unconfirmed occurrences only. No write without confirmation.
- [ ] Two tabs, lost ack, confirm-versus-skip and changed/deleted linked expense
      cannot create another occurrence automatically or overwrite a saved row.
- [ ] Reviewed encrypted identity/rekey/export/RLS/CAS/atomic SQL contract with
      synthetic local replay and separate owner production readiness approval.
- [ ] Hidden inputs/accessibility, teardown, desktop/mobile/keyboard and visible
      expected-versus-recorded assumptions verified.
- [ ] Independent review, full gates/coverage, normal hooks and exact-head green CI.

## Risk & reversibility

Expected expenses may differ from actual payment; review must keep that distinction
visible. Changing dates cannot silently change occurrence identity. Missing receipts
or lost cross-domain restore could duplicate occurrences, so recovery is part of
the schema contract. Revert UI/actions leaves encrypted templates/receipts intact;
saved expenses are actual records and not undone by disabling a template.

## Open questions

- Owner reviews this feature separately after 136/137; monthly Singapore-calendar,
  last-day clamping and confirm-only behavior are proposed defaults.
- Exact occurrence identity/metadata exposure, atomic persistence, export/rekey,
  receipt retention and SQL remain unresolved; resolve before implementation.
- No feature, migration, crypto, dependency or protected-file approval claimed.

## Continuation review and recommendation — 2026-10-13

The owner requested review, recommendations and implementation of remaining
features on 2026-10-13. Recommended next feature after persistent merchant137:
monthly self-expense templates, explicit Confirm/Skip, Singapore calendar and
last-day clamping. Keep expected payments distinct from recorded spending.
No unattended writes or mass catch-up. Source preparation is authorized;
the exact new SQL/atomic receipt contract still needs its own review/approval.

Source review suggests a simpler occurrence identity candidate without a new
crypto primitive: keep schedule, intended months and confirmed/skipped occurrence
receipts inside the template's encrypted versioned payload. Use revision CAS on
the template row to serialize every occurrence update. Atomic confirm updates
that encrypted payload and inserts the self expense together; skip only updates
the payload. A same-revision race has one winner. Stale/replayed submissions cannot
overwrite or reserve another occurrence, even when the expense has been deleted.
The authenticated server action decrypts and validates current template plus
receipt map before constructing the next version. SQL never queries encrypted
month keys; the revision predicate is the concurrency boundary.

Retain archived template rows and their receipts rather than deleting/recreating
them. The public mutation contract must disallow occurrence removal/reset, only
append or explicit terminal transitions. Cloning is a visibly distinct new series.
Loss of receipt history in restore cannot be accepted silently. Proposed bounds
and export/retention contract must be finalized together before implementation.
This replaces the draft opaque-token/key-derivation candidate; it does not claim
SQL proof or approve ciphertext schedule indexes.

Merchant137 source inspection found no current PIN-change/rekey implementation.
138 should inventory all new encrypted domains for future atomic recovery/rekey,
preserve the current DEK/AES-GCM helpers and make no PIN-change promise. A rekey
workflow is a separate cryptographic contract, not an invented prerequisite
integration with nonexistent consumers.

## Exact implementation approval — 2026-10-13

Clarence selected “Approve recurring scope and this storage contract” for
`138-recurring-storage-contract.md`: monthly Singapore scheduling, explicit
Confirm/Skip, encrypted retained occurrence history, revision CAS, atomic
expense-plus-history saves and export v5. Production migration application remains
a separate owner action. No new crypto primitive/dependency/protected edit.

Recorded implementation paths: new recurring-expenses `constants.ts`, `types.ts`,
`schemas.ts`, `index.ts`, `lib/calendar.ts`, `lib/commands.ts`,
`actions/recurring-actions.ts`, `hooks/use-recurring-rulebook.ts`,
`components/recurring-review.tsx`, `components/recurring-template-editor.tsx`,
`components/recurring-occurrence-editor.tsx`; expenses `components/expense-entry.tsx`
composition; Profile export-data.ts/export-validation.ts/export-review-constants.ts,
use-export-data.ts, export-data-card.tsx and export-review.tsx; the exact138
migration; `supabase/tests/138-recurring-rulebooks.mjs`,
`test/security/138-recurring-rulebooks.sql`; focused calendar/schema/command/action/
hook/component tests under test/features/recurring-expenses plus existing export,
month-compatibility, expense-entry/reuse and privacy suites as consumers require;
README and138 records. Record any additional path before adding it.

Prepare source separately under this session's `work/138-draft` while137 is being
verified, then create the138 implementation branch from the verified137 commit.
Normal hooks/full gates, second review and separate publication/production
readiness still apply. This source staging does not claim runtime verification.

## Integration review — 2026-10-13

The recurring hook cleared its frozen submission immediately after a saved RPC,
before its authoritative reload finished. A Hide/Show during that reload could
leave a stuck saving state or a stale editable draft. Keep the submission until
the reload completes; interrupted reloads use the existing explicit receipt Check.
Affected paths: recurring hook and its lifecycle regression tests. Verify both
separate and same-render Hide/Show, single dispatch, retained receipt and draft
completion. This is within the approved lifecycle contract; no SQL changes.

Mobile browser review found long template names expanded action buttons beyond
390px (observed document scroll width 660px versus client width 375px). Keep the
full name in each action's accessible label, with concise visible action text
under the named template. Recheck long-name mobile width and existing UI tests.
Affected path: recurring-review.tsx; no behavior or persistence contract change.

## Verification progress — 2026-10-13

Based on merchant137 commit 2bef1a4, whose normal check/build and full coverage
gate passed (175 suites / 1,933 tests). Recurring integration passed check and
191 focused tests across 11 suites. Browser verification used real components
and hooks with in-memory synthetic actions only: desktop/390px, light/dark,
Enter without save, retained Hide/Show draft, duplicate-check invalidation,
lost acknowledgement with explicit Check and retained missing-expense receipt.
Long-name mobile overflow is corrected (scroll width equals client width 375px).

The SQL file still matches the exact approved normalized-LF SHA-256
`a5b17525c10ad539fcc81454f7917fecbd4e950f3954f947964188f53ba4724d`.
Docker's Linux engine remains unavailable; SQL concurrency/RLS replay is pending.
Full application gates, final source review and publication readiness follow.
No production data, credentials, real environment files or production SQL used.
