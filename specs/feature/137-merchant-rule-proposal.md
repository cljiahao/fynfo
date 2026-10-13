---
id: '137'
slug: merchant-rule-proposal
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

# Spec 137: Reviewable merchant suggestions — staged persistence proposal

## Problem

Repeated statement descriptions need repetitive category/name edits. Suggestions
should reduce that work while preserving source evidence and user corrections.

## Constitution check

Owner authorized preparation, not implementation. Preserve personal ownership,
identity/vault gates, server actions, AES-GCM, RLS, existing stack/design and full
gates (§§1–5). New persistent storage needs separate exact SQL review under §§7–8.
No existing 077/083/103 approval covers this feature. No HARD override requested.

## Solution shape

- Operate mode, within existing statement review. A rule suggests category and
  optional display merchant, with rule name/match reason and explicit Apply.
  Untouched source remains available. Never change transaction kind, currency,
  amount, source eligibility or saved historical rows.
- Compare original transaction description using trim, collapsed whitespace and
  case-folding. First tier is exact normalized description; second tier is a
  normalized phrase occurring at token boundaries. No arbitrary regex, fuzzy/AI
  match, wildcards or substring matching inside words. Optional bank scope is
  part of matching; no hidden account identity assumption.
- An exact match takes precedence over broader rules. Multiple matching rules
  within the winning tier that disagree on any suggested field produce a visible
  conflict with no preselected winner. Identical outcomes show contributing rules.
  Do not invent priority by creation order or phrase length.
- Manual field edits win per field, including intentional clearing. Refreshing,
  editing or enabling rules never overwrites manually touched values. A user can
  explicitly restore source or explicitly Apply a selected suggestion. Applying
  a rule is visible review state and never writes an expense.
- Creating a rule from a reviewed row requires a preview of exact/broader matches
  and explicit rule save. A broad rule matching many merchants shows those examples
  before saving. Changes/disable/delete affect future suggestions only.
- Persistent design candidate: personal rule records with random ID, user owner,
  encrypted versioned payload and revision. Payload contains match mode/text,
  optional bank, display name/category and enabled flag. Fetch owner records then
  decrypt/match in process; no plaintext merchant/category indexes or equality hash.
  Use atomic revision-checked updates/deletes and stable request identity for
  unknown outcomes; reject stale edits rather than silently last-write-wins.
- Recovery/export and PIN rekey must include this new encrypted domain before
  persistent rollout. Exact export version/legacy review behavior, record limits,
  RPC/CAS, RLS/grants and forward-only SQL remain to be drafted and reviewed.
  Do not put hidden rules in existing expense notes or planning scenarios.

Planned paths after contract approval: new merchant-rules feature actions,
schemas/types/lib/hooks/components/index; import-review suggestion integration;
profile export/review and existing rekey consumers; focused synthetic tests,
README and this spec. Migration filename and exact paths must be recorded before
implementation. No implementation-ready SQL or dependency change is proposed now.

## Out of scope

Automatic saves, historical recategorization, refund/transfer reclassification,
bank identity inference, unattended enrichment, third-party services and household
rules. This draft does not authorize application or migration implementation.

## Acceptance

- [ ] Exact-before-broader, bank scope, boundary normalization and conflicting
      exact/broad outputs tested; Unicode matching contract finalized explicitly.
- [ ] Manual overrides/restoration and source/eligibility preservation verified.
- [ ] Rule edits do not rewrite any existing expense or automatically save a row.
- [ ] Reviewed RLS/encryption/CAS/retry/export/rekey contract and owner-approved SQL
      locally replayed with synthetic users before persistent feature rollout.
- [ ] Desktop/mobile/keyboard, hidden amounts and teardown/stale-result proof.
- [ ] Independent review, normal hooks/full gates/coverage and exact-head green CI.

## Risk & reversibility

Broad names can miscategorize unrelated purchases; explicit application, previews
and conflict review mitigate. Encryption still exposes record-count metadata.
Schema rollback is not destructive: disable callers and retain encrypted records;
exact backout must be recorded with the migration. Rule removal cannot undo a
previously confirmed manual expense edit. No private data accessed in preparation.

## Open questions

- Owner reviews merchant scope separately after 136. Decide whether persistent
  rules are wanted; session-only rules may be a separately reviewed smaller batch.
- Exact persistence/export/rekey/CAS/SQL contract is unresolved and blocks code.
- No feature, schema, dependency or protected-file approval is claimed.
