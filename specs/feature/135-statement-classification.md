---
id: '135'
slug: statement-classification
area: feature
status: approved
author: Codex
created: 2026-10-12
approved: 2026-10-12
shipped:
impl_pr:
supersedes:
constitution_satisfies: ['§1', '§2', '§3', '§4', '§5', '§7', '§8']
constitution_overrides: []
---

# Spec 135: Explicit local statement classification

## Problem

Local PDF review currently groups credits/refunds and transfers/repayments into
exclusion messages. The user cannot see or correct a distinct transaction kind.
The expense ledger accepts positive expenses only, so misreading a refund or card
repayment as spending would be misleading even before a future save feature.

## Authority and confirmation sweep

On 2026-10-12 the owner reviewed a staged proposal and approved its first scope:
“please go ahead after you confirmation sweep ot ensure your specs is correct,.
if so please iomplement and then confrirmation sweep.” The preceding proposal
explicitly selected local PDF classification only. This records implementation
and verification approval for that first feature; import saving, merchant rules,
recurring templates and their persistence remain separate proposals.

Investigation baseline is 09cf0ee, isolated from the main integration checkout.
Read AGENTS, the full Constitution, roadmap 081, local review 132/133 and reuse 134. The parser currently checks generic credit markers before repayment wording,
clears credit amounts and retains source lines. Statement rows use temporary
page/line IDs. The UI keeps draft edits only in memory and currently shows the
original extraction status after edits. No save action is connected. Preserve
the original signs/text and derive visible review status from classification and
source issues; never equate an edited label with validated spending.

## Constitution check

Existing local browser interaction justifies client components (§2.5). No new
action, network/storage sink, DB model, encryption code, auth/vault gate or RLS
change (§§2.1–2.4, 5). Keep named exports, feature boundaries, existing controls,
semantic styles and pinned dependencies (§§2.6–2.7, 3). Required checks, independent
review, normal hooks and exact-head green CI remain release requirements (§4).
No constitutional override, new dependency, migration or protected edit.

## Solution shape

- Add local classification values: Expense, Refund, Transfer, Card repayment,
  Other credit and Unknown. Preserve the parser suggestion and its plain-language
  evidence separately from the user's choice. Summary lines are explicitly
  non-transactions and cannot be relabeled as expenses.
- Recognize specific refund, transfer and repayment wording before generic credit
  markers. A bare CR, negative amount or parenthesized amount means Other credit,
  not automatically Refund. Conflicting specific signals, reversal-only wording
  and ambiguous payment wording mean Unknown. No account-linking or ledger effect
  is inferred. Existing supported constructed layouts remain the support boundary.
- Keep the untouched source line and original amount notation available. Never
  take an absolute value or populate a positive amount for a source credit. A
  credit/refund/conflicting-direction source remains blocked as an expense even
  after a user changes its classification or types a positive draft amount.
- Use a labeled native classification select within the existing row editor.
  Show the suggested kind and reason, mark a changed selection as a user override,
  and offer restoration of the suggestion. Date/description/category/amount edits
  do not silently reclassify the source. Retain all original extraction issues.
- Derive visible counts/status from the current classification: known non-expenses
  excluded, Unknown unresolved, Expense a suggestion only when original extraction
  issues and current field validation permit it. An explicit correction of an
  ambiguous payment/transfer label can become an expense suggestion only when
  positive source amount/date/currency evidence is already valid. Summary and
  credit-direction blockers cannot be cleared by edits. Edits remain unsaved.
- Preserve desktop side-by-side preview, mobile Statement/Extracted controls,
  source navigation, row pagination, keyboard labels and local cleanup. Use the
  incumbent Operate-mode visual system. This is a narrow extension of the existing
  editor, not a new design surface or a product-wide design documentation task.

Recorded paths before implementation: this spec;
`src/features/import-review/types.ts`, `constants.ts`, `lib/statement-parser.ts`,
`components/statement-review.tsx`; `test/features/profile/statement-parser.test.ts`
and `statement-review.test.tsx`; README. No other product files. Temporary
synthetic verification sources/logs live under the session's work directory;
never read or copy environment files, credentials, cookies, PINs or private data.
No public API/action or persisted data shape changes.

## Out of scope

Import saving, totals/netting refunds, durable classification, new bank variants,
merchant rules, recurring templates, restore, durable duplicate prevention,
schema/dependency/crypto/protected changes, deployment and merge. Main chat owns
integration of 130–134. This feature must be reconciled with its supplied baseline
before delivery. No concurrent heavy job: coordinate tests/build/browser/install.

## Acceptance

- [ ] Parser fixtures cover all six kinds, CR repayments, refund wording, unsigned
      transfers, signed/parenthesized credits, conflicting signals, generic payment,
      reversal, summary lines, existing ambiguity, duplicate and provenance behavior.
- [ ] Component regressions prove classification edits/restoration, live status
      counts, preserved source/suggestion/issues, invalid edited values and immutable
      source credit/summary blockers; cleanup and navigation remain functional.
- [ ] Synthetic desktop/mobile and keyboard evidence confirms labeled controls,
      source access, responsive layout and absence of save/upload actions.
- [ ] `pnpm check`, `pnpm test:ci`, `pnpm build` green, all existing floors intact.
- [ ] Independent source/UI review and post-implementation confirmation sweep.
- [ ] Normal hooks and exact-head green CI before any release claim; preserve logs.
- [ ] Record the approved specification hash at implementation delivery.

## Risk & reversibility

Keyword classification can be wrong: always show source and suggestion evidence,
allow explicit correction, keep credit/summary/ambiguous amount guards, and label
all values as unsaved local review. No real bank qualification is claimed.
Clear/close/replace/unmount discards classifications with the existing PDF review
lifecycle; transient browser memory is not a secure-erasure guarantee. Revert the
scoped code/docs/tests to remove the feature; there is no stored data to undo.

## Open questions

No remaining owner decision for the approved local classification scope. Main
chat will supply the integration baseline and serialized verification slot.
Durable financial semantics and saving require later feature review.

## Integration confirmation — 2026-10-13

Main released the local verification slot and supplied reviewed PR51 head
`d28bfc3395a1889acbc437adb00da838c487012f`, containing 129–134. The original
classification changes were retained in a stash before a normal fast-forward;
stash application preserved that backup. One row-count conflict was resolved by
applying the incoming privacy mask to derived classification counts. The new
classification callback checks `canReveal`; the incoming disabled fieldset and
source/input masking remain intact. Added Hide/Show and owner-teardown regression
inside the already-recorded component test path. No privacy provider change.
The final merged-main baseline is `29394c8beb1f2d38954edd78fca17d7183c35390`.
A second retained stash protected classification changes before a normal
fast-forward. Its tree is identical to the reviewed d28 head, so focused runtime
evidence applies unchanged. No source conflict occurred on this final integration.

Coordinated ordinary documentation closeout recorded before edits: main requested
updating `specs/feature/134-expense-reuse-draft.md` and
`docs/audit/2026-10-09-roadmap-progress.md` with verified PR51 merge/CI facts. These
two documentation paths record delivered 134 metadata only, without modifying
its approval, implementation or broader roadmap scope.

## Verification evidence — 2026-10-13

Own frozen offline installation reused all locked dependencies with no downloads
or manifest/lockfile changes. The sandboxed first formatter attempt failed in
pnpm's automatic dependency check; normal host-access retry passed, with both
logs retained. Three focused suites passed 64 tests, including classification,
source-credit/summary blockers, duplicate evidence, current field validation,
override/restoration, lifecycle and actual privacy-provider behavior. TypeScript
passed. Independent source review found and resolved suffix-evidence and
reclassifiable-duplicate gaps; integration re-review found no remaining issue.

An isolated Vite fixture loaded actual components/styles and PDF.js worker with
one invented binary PDF. Seven rows exercised all six transaction kinds plus a
summary. Override/restoration, blocked refund after positive edit, keyboard
Home/Enter classification, mobile source navigation and retained amount, Escape
focus return and hidden entry guard passed. Desktop and 390px mobile screenshots
were independently reviewed with no actionable scoped UI finding. Document
width/scroll width were 390/390, dialog 341/341. The fixture uses an Arial fallback
and a constant-only expenses barrel replacement, with server actions forbidden.
This is component/PDF-worker evidence, not authenticated Next-page or private
auth/RLS/crypto/database proof. Initial fixture-only CSS resolution and slow
in-app-browser file-selection failures were retained; extraction subsequently
passed. Temporary fixture-only error logging diagnosed synthetic input and does
not modify product logging. Screenshots and logs live outside the repository.

Normal full gates/hooks and exact-head hosted CI remain release requirements;
their results will be recorded in the PR and delivery report. No merge or shipped
status is claimed by this preparation record.
