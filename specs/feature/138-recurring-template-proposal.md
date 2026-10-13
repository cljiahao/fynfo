---
id: '138'
slug: recurring-template-proposal
area: feature
status: draft
author: Codex
created: 2026-10-13
approved:
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
