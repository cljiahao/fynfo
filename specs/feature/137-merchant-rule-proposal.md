---
id: '137'
slug: merchant-rule-proposal
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

# Spec 137: Reviewable merchant suggestions — staged persistence proposal

## Problem

Repeated statement descriptions need repetitive category/name edits. Suggestions
should reduce that work while preserving source evidence and user corrections.

## Constitution check

Owner authorized feature implementation on 2026-10-13 as recorded below;
new schema approval remains separate. Preserve personal ownership,
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

## Continuation scope review — 2026-10-13

Prepared in an isolated detached worktree at
`18a9cf0686467291aa974e4096b1e8ef345bf096`; no implementation or publication.
136 has a source-review cache-refresh finding recorded separately and must be
resolved by its owning chat before relying on its integrated save behavior.

Proposed first product scope is persistent personal rules, because reducing work
across statements requires surviving review closure. A session-only alternative
can be selected explicitly, but is not assumed to satisfy that durable need.
Owner scope selection precedes the exact SQL/crypto/export contract review; a
scope answer alone is not implementation or migration approval.

Operate-mode interaction stays in the incumbent row editor: source description,
suggested category/name, rule and match reason, then explicit Apply. Rules never
select a row, acknowledge duplicates or activate Save. Each Apply invalidates
136 duplicate review. Applying another rule to a manually touched field requires
an explicit field-specific replacement choice; untouched fields may be staged.
Restore source is likewise explicit. Source matching uses retained original
description, not a previously suggested or edited display name. The extractor
must retain that original description separately before integrating rules.

Assumed initial bounds for owner review: 100 personal rules, match/display/rule
names limited to 256 characters, versioned encrypted payload limited to 8 KiB,
and matches limited to the supported four explicitly selected banks or all banks.
Normalize with NFC, trim, collapse Unicode whitespace and locale-independent
lowercase; do not strip accents/punctuation or apply compatibility normalization.
Phrase boundaries are string edges or characters outside Unicode letters,
combining marks and numbers. Punctuation-only patterns are invalid. Synthetic
tests must cover composed/decomposed accents, combining marks, non-Latin text,
apostrophes, hyphens and case variants; no promise of linguistic word segmentation.

Persistent candidate envelope: random UUID, authenticated owner, positive lossless
revision and AES-GCM payload. Payload version 1 includes label, enabled,
matchMode exact/phrase, matchText, nullable bank, nullable suggestedDisplayName
and nullable existing expense category; at least one suggested field required.
No amount, date, classification, eligibility or bank-account field is writable.
All semantic fields stay encrypted; IDs/count/revision metadata remain visible.

Before implementation, prepare and separately review the exact contract for:
owner-only RLS and minimal grants; invoker create/CAS-update/CAS-delete RPCs;
capacity concurrency; permanent request receipts/tombstones or another explicitly
reviewed way to prevent unknown delete/create replay; strict payload and revision
bounds; retry confirmation after intervening edits/deletion; rekey transaction and
failure rollback; export version 4 with required merchantRules domain; v1–v3
review visibly reporting absent rules; unsupported limits and all-domain failure
handling; account deletion and recovery semantics. Current v3 export is plaintext
and has no restore; adding rules cannot claim recoverability. The new feature
must remain unavailable until its SQL and rekey/export consumers are ready.

Impeccable planning guidance was read with the existing statement component and
semantic globals as visual authority. No UI/code, PRODUCT.md, design contract,
dependency, SQL, hooks, tests, build or browser job was created. Recurring 138
remains the next separate scope review after the merchant decision.

## Owner implementation direction and recorded first batch

On 2026-10-13 Clarence accepted the recommendation of persistent personal rules:
“go ahead to implement please. can you review the other featrues then let me know
you recommendation and implement?” This authorizes feature implementation and
review/recommendations for remaining features. The exact new schema below was
not part of that preceding recommendation and retains its separate approval gate.
Do not repeat the persistence preference question.

First authorized source batch: new `src/features/merchant-rules/constants.ts`,
`schemas.ts`, `types.ts`, `lib/matching.ts`, `lib/review-draft.ts`, `index.ts` and
`test/features/merchant-rules/matching.test.ts`, `schemas.test.ts`,
`review-draft.test.ts`. These implement bounded validation, matching, conflict
and explicit-apply/manual-override behavior without persistence or UI wiring.
Synthetic tests are authored now; run only after the LOCAL slot is released.
No SQL/migration, server call or database write is authorized by this first batch.

Exact persistence proposal is `137-merchant-rule-storage-contract.md`. It replaces
the earlier per-rule-record candidate with one revisioned encrypted rulebook per
account, bounded to 100 rules. All rule edits use whole-book CAS; conservative
conflicts between edits to different rules are accepted. This avoids separate
per-rule creation receipts and deletion tombstones. Review storage approval
separately before application actions/UI/export wiring and migration execution.

Source inspection found no current PIN-change/rekey implementation in `src`.
The earlier instruction to integrate existing rekey consumers had no such consumer.
137 uses unchanged existing AES-GCM/DEK helpers and adds no PIN-change promise.
A future rekey must include this encrypted domain atomically; changing a canary
alone is not supported recovery. This correction is explicit in the storage
proposal rather than silently implementing a new cryptographic protocol.

Clarence then explicitly approved the exact storage contract and implementation
in the structured response on 2026-10-13. The new SQL and recorded action/UI/export
paths may now be implemented and locally replayed. Additional named paths:
profile/components/export-review.tsx for supported-version copy; merchant-rules
lib/rulebook-state.ts for pure confirmation comparison; test/security/137-merchant-rulebooks.sql;
test/features/merchant-rules/{rulebook-actions,use-merchant-rulebook,merchant-rule-manager,merchant-suggestion}.test.ts(x).
Production application and remote publication/merge remain separately gated.

Export integration also updates `test/features/month-record-compatibility.test.tsx`
for the explicit version-4 envelope field; legacy raw-month behavior is unchanged.

SQL proof runner path: `supabase/tests/137-merchant-rulebooks.mjs`, reusing the
existing already-installed PostgreSQL17/PostgREST14.14 Docker fixture pattern,
with --pull=never, loopback HTTP, fresh synthetic identities and owned-resource
cleanup. No new dependency, existing database, secret or protected runner edit.

## Local verification progress — 2026-10-13

Integrated prerequisite136 through30d27b46ce6293b6fb11219c3c98de6dbbe6e06f.
Locked offline installation completed without downloads. The focused feature,
import, export and month-compatibility suites contain220 passing tests (219 in
the initial run plus the corrected Strict Mode fixture; all10 hook tests passed
on rerun). TypeScript validation passed after adapting lossless BigInt arithmetic
to the incumbent target. Initial lint reported one cleanup-ref warning; fixed
without suppression. Normal pre-commit checks and full build/coverage follow.

A separate source pass found two lifecycle issues and added regressions: Strict
Mode must release its discarded initial-read gate, and Hide/Show must preserve
the original draft revision rather than silently rebasing it onto a newer read.
Dispatched writes remain frozen for explicit authoritative checking.

The real manager/hook/suggestion components passed synthetic in-memory browser
checks at desktop and390px mobile width, including light/dark themes, native
inputs/selects, Enter without saving, source preview, retained hidden draft and
lost-acknowledgement Check. Fixture CSS uses incumbent tokens and fallback fonts;
this does not claim a production-account or live-database smoke test.

The migration still exactly matches the approved normalized-LF SQL hash.
Fresh Docker SQL replay is pending: Docker Desktop's Linux engine was unavailable,
so the runner failed before creating any resource. No production SQL was applied.
Full gates, SQL evidence and publication readiness must be updated before release.

## Independent review correction and publication approval — 2026-10-13

The owner explicitly approved an independent reviewer and publication of137/138.
Reviewer found that MerchantSuggestion returned null when a previously applied
rule stopped matching, removing the original-description and Restore controls.
Keep source restoration independent of active matches while preserving privacy.
Affected paths: merchant-suggestion.tsx and its component regression tests.
Verify apply, then disable/remove/change-match, Restore, and Hide/Show; run normal
hooks and full publication gates. Exact approved SQL remains unchanged.
Both fresh PostgreSQL17/PostgREST14.14 migration proofs have now passed, including
owned-resource cleanup. Production application remains a separate owner action.
