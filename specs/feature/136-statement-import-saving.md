---
id: '136'
slug: statement-import-saving
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

# Spec 136: Selected statement expenses with explicit save outcomes

## Problem

Local statement review can extract and classify rows but cannot record selected
expenses. Importing through the existing upsert would also let a delayed retry
overwrite an expense subsequently edited in another tab.

## Authority and evidence

Owner approval 2026-10-13: “can you implement, clean up and then let me know any
other features we are left to work on before you archive this sesssion? remember
to start a new session for that other features”. This approves the presented 136
scope, implementation/verification/cleanup and a continuation chat for remaining
features. It does not approve new SQL/crypto/dependencies or merchant/recurring
implementation. Normal commit/push/PR is necessary for reviewable delivery;
main merge remains out of scope. Delivered 135 head 14ac25b is integrated by
normal fast-forward in this worktree, with PR55 open and exact-head CI green.
Source-only confirmation adds a conservative 10^12-cent maximum and strict
statement-period/calendar validation. Generic DB errors remain unconfirmed.

At proposal creation, owner requested this separate preparation chat and individual
review of import saving, merchant rules and recurring templates. Inspection and
draft preparation were authorized then; the subsequent approval above authorizes
136 implementation. Isolated
branch `spec/136-statement-import-saving` starts at verified main
`29394c8beb1f2d38954edd78fca17d7183c35390`. Classification 135 was inspected
read-only in its owning checkout; integrate only its delivered baseline later.
No changes were made to that checkout or its index, stashes or jobs.

Read full AGENTS/CONSTITUTION, roadmap 081 and 132/133/134/135. Existing
`expense_records.id` is a primary key; self expenses have no split inserts.
Existing RLS limits records to the authenticated owner. The 077 replacement RPC
uses `ON CONFLICT (id) DO UPDATE`, including deletion/replacement of splits.
It is neither compare-and-swap nor durable import deduplication. `getExpenses`
is an authenticated/vault-gated paginated read; optimistic query rows cannot
confirm a write. Its multi-request snapshot also cannot guarantee concurrent
duplicate absence. Source page/line IDs are local locations, not bank identities.

## Constitution check

New action uses the incumbent identity-then-vault `requireActionContext`, Zod
boundary validation and AES-GCM helpers (§§2.1–2.3, 5). Keep pages thin, feature
barrels, named exports, existing pinned dependencies/styles (§§2.4–2.7, 3).
Client interaction is necessary for selection and local PDF review (§2.5).
No SQL, table/column, RLS, crypto protocol, dependency or protected-file change.
Existing quality gates, independent review, normal hooks and exact-head green CI
remain required (§4). Explicit feature approval precedes code (§§7–8).

## Solution shape

### Review and explicit selection

- Extend the existing statement dialog in Operate mode. Preserve semantic tokens,
  labeled controls, side-by-side source, mobile tabs, keyboard and pagination.
  The UX brief is provisional for owner review. Impeccable context/shape guidance
  was read; no PRODUCT.md, confirmed design contract or new visual world is invented.
- Nothing is selected automatically. Per-row checkbox includes its source
  location in the accessible name. Show selection count, SGD subtotal, self-only
  assumption and a labeled `Save selected expenses` button. Enter in row inputs,
  paste, field edits, classification and selection cause zero writes.
- Eligible rows require Expense classification, positive original SGD source
  evidence, valid current calendar date within period, nonempty description,
  supported category and a positive two-decimal SGD amount. Never infer FX,
  invert signs or bypass credit/refund/summary/ambiguous-currency/column blockers.
  Classification overrides retain 135's immutable source restrictions.
- Separate provisional duplicate warnings from hard source issues. A warning may
  be acknowledged explicitly after source comparison; no other source issue can
  be dismissed. Compare current candidates with each other and freshly read
  personal expenses by calendar date, amount in integer cents, and description
  trimmed/collapsed/case-folded solely for comparison. Never rewrite stored text
  or silently skip matches. Include shared records in warnings, not in writes.
- Duplicate review must precede saving; a failed fresh read blocks that attempt.
  Editing selection/payload invalidates the comparison and acknowledgements.
  Warnings visibly state incomplete/concurrent/overlapping files and legitimate
  identical purchases defeat durable prevention. No plaintext equality hash.
- Freeze at most 20 selected rows per explicit batch, across pagination; selected
  total includes off-page rows. Issue one sequential action request per row,
  stop dispatching after an unconfirmed request, retain not-started rows. Partial
  completion is normal and never presented as an atomic batch.

### Values, provenance and insert-only action

- Generate a cryptographically random UUID once per selected candidate, retained
  for that review lifetime. Freeze the complete submission before the first send.
  Selection toggles do not replace IDs. Never reuse source page/line IDs as ledger IDs.
- New action `insertImportedExpense` accepts a strict bounded envelope: UUID,
  calendar date, existing category, edited description, positive integer SGD cents,
  bank/period and original transaction source lines with page/line coordinates.
  Max 4096 characters per description/source line, 32 source lines and 16 KiB
  total UTF-8 provenance; exceeding bounds blocks visibly, never truncates silently.
  No source PDF, filename, full statement, account headers or nonselected rows sent.
- Server validates independently, converts cents to the incumbent positive amount,
  fixes `splitType: self` and `splits: []`, and constructs an ordinary `ExpenseData`.
  `info` contains a deterministic readable source note: bank, actual period,
  original transaction lines and coordinates, original classification suggestion
  and reviewed override. Preserve exact source text separately from edited item.
  The UI previews this note before save. It is ordinary editable encrypted notes,
  not immutable audit evidence or a machine-recognized transaction identity.
- Encrypt item, info and amount with existing helpers, then plain `.insert` into
  `expense_records` with authenticated `user_id`; never `.upsert`, replacement RPC,
  UPDATE, split write or service-role path. One self parent insert needs no
  multi-table transaction. Do not alter existing manual/reuse write behavior.
- Return only opaque typed outcome and requested ID, no DB text, source data or
  ciphertext. Successful insert acknowledgement confirms that request committed.
  An ID conflict causes an owner-filtered authoritative read: exact decrypted
  values confirm an existing match; changed values report conflict without writes;
  missing/inaccessible/read failure remains unconfirmed. Never reveal another
  owner's row or distinguish its existence through detailed errors.
- Expected pre-write validation failures and explicitly classified transaction
  rejections are `not_saved`. Use a narrow reviewed database-error allowlist;
  generic gateway/timeouts and opaque `DB_ERROR` are not proof of rollback.
  Transport failure, missing/malformed acknowledgement and uncertain
  server exceptions are `unconfirmed`. Only a definitive `not_saved` outcome
  permits explicit retry with the same frozen ID/payload. No mutation auto-retry.

### Outcome, concurrency and lifecycle

- Track each row as not-started, pending, confirmed, not-saved, unconfirmed or
  conflict. Freeze submitted rows; display counts and per-row action/status. Do
  not clear all candidates or infer success from optimistic cache insertion.
- `Check saved expenses` performs a fresh direct read. Exact ID/value match
  confirms; changed values freeze conflict; missing ID remains unconfirmed.
  Missing is not proof the original request cannot finish, nor proof another tab
  did not delete a completed expense. Therefore no retry/recreation from an
  unconfirmed missing result in this first scope. Keep ID/payload available in
  memory for checks. Durable replay after deletion requires a future receipt contract.
- Confirmed rows cannot be submitted again in this review. Definitively rejected
  rows can retry identical payload; editing requires explicit cancellation of that
  rejected attempt before a new reviewed attempt. Conflicts have no overwrite action.
- Refresh the expenses cache only through guarded invalidation after confirmed
  writes, without optimistic import rows. Never directly replace an active
  optimistic cache snapshot; late callbacks cannot recreate cleared private cache.
- Hide masks source, inputs, totals, outcomes containing values, accessible names
  and dialogs; disables read/write initiation and stops dispatching unsent rows.
  Recheck visibility epoch, owner lifetime and generation after awaits. Hide marks
  an outstanding request unconfirmed locally before invalidating its callback,
  so Show never leaves an indefinitely pending row or infers a hidden success.
  An already
  sent write cannot be canceled. Retain its frozen identity while the same dialog
  remains mounted; Show permits explicit checking, not automatic continuation.
- Clear/replace/close during unsaved or uncertain work offers explicit discard
  with the visible warning that dispatched saves may still complete and retry
  identity will be lost. No late response updates a replaced/closed review.
  Lock/logout/owner teardown/navigation destroys local review and ignores late
  results. No persistent browser storage, source upload, logs/analytics of values
  or secure-memory-erasure promise. Reopening a file requires duplicate review.
- Update local-only wording accurately: PDF parsing stays on-device; selected
  expense fields and the previewed source note are sent only on explicit save
  and encrypted before database storage. This is a material change to 133's UI.

### Recorded implementation paths

This spec; import-review `components/statement-review.tsx`, `types.ts`,
`constants.ts`, `index.ts`; new `lib/import-selection.ts`,
`lib/import-outcomes.ts`, `components/statement-save-review.tsx` and
`hooks/use-statement-save.ts`. Expense additions: `actions/import-expense-actions.ts`,
`lib/import-expense.ts`, `schemas.ts`, `index.ts` for the narrow public action/types.
Tests: new `test/features/expenses/import-expense-actions.test.ts`,
`test/features/profile/statement-import.test.tsx`, `statement-import.test.ts`,
and existing statement-review/parser tests for duplicate severity integration.
README records the contract. No page, privacy-provider, existing action/hook,
SQL, package/lockfile or protected tooling edits. Amend this list before adding paths.

## Out of scope

Durable cross-file deduplication or replay receipts, refund/transfer/card repayment
ledger writes, shared expenses, JSON restore, new bank layouts, merchant rules,
recurring templates, unattended saves, deployments and main merge. No new schema,
dependency or crypto contract; no implementation authorized by drafting this spec.

## Acceptance

- [ ] Synthetic tests prove zero writes before button activation; eligibility,
      immutable source blockers, duplicate-only acknowledgement and comparison reset.
- [ ] Server tests prove strict bounds, auth/vault ordering, ownership, encryption,
      insert-only self rows, same-ID exact/mismatch/missing cases and opaque errors.
- [ ] Lost acknowledgement followed by edit cannot overwrite; followed by delete
      cannot trigger retry/recreation. Double-click and late results cannot resend.
- [ ] Mixed confirmed/rejected/unconfirmed/not-started rows retain exact identities
      and payloads; only definitive rejection permits same-payload retry.
- [ ] Hide/Show and owner teardown reject stale reads/cache callbacks, pause dispatch,
      and mask native/accessibility surfaces without inventing cancellation of writes.
- [ ] Source note survives ordinary read/export unchanged; original source and edited
      item remain distinguishable. No PDF/plaintext persistent browser sink.
- [ ] Synthetic actual UI desktop/mobile/keyboard verifies selection across pages,
      visible warnings/partial outcomes/source note and focus/discard behavior.
- [ ] Independent source/UI review, confirmation sweep, unchanged full gates/hooks,
      incumbent coverage floors and exact-head green CI. Record approved spec hash.

## Risk & reversibility

Wrong source interpretation can create wrong expenses; explicit source review and
selection mitigate without qualifying real bank layouts. Imported provenance is
editable notes, may contain sensitive transaction text, and survives encrypted
export like other notes. Separate files/tabs can duplicate purchases. A completed
save may later be edited/deleted; confirmation is not a permanent existence claim.
Unknown outcomes cannot be safely resolved by absence alone. Closing loses retry
identity; warn before voluntary discard. Revert removes the feature, not saved
expenses; delete mistaken rows through existing controls. No schema rollback.

## Open questions / exact owner approval

- Resolved by the 2026-10-13 instruction above: the bounded first feature and named paths, including the new
  insert-only action, selected-row encrypted source notes, 20-row batches and
  conservative no-retry behavior for unconfirmed missing rows. No SQL/dependency/
  crypto/protected edits are requested. Approval must not be inferred for 137/138.
- Classification supplied delivered 14ac25b and released LOCAL slot. Integrated
  by normal fast-forward; PR55 remains a separate open/unmerged prerequisite.

## Implementation confirmation — 2026-10-13

Implemented the recorded bounded scope. Typed input schema lives beside the
expense mapper in `lib/import-expense.ts`; no change to the incumbent general
expense schema is needed. Source-only credit/refund/negative/summary checks add
a conservative server boundary, but submitted provenance cannot authenticate a
bank statement. Any source/payload size restriction is visible beside the row.
Additional preparation records 137/138 remain draft docs only, authorized by the
owner's requested remaining-feature handoff; no merchant/recurring code or SQL.

Second source review in this chat found and fixed stale duplicate-read busy state,
instant Hide/Show pending acknowledgement, active optimistic-mutation refresh and
comma-formatted amount mapping. All edited payloads explicitly invalidate duplicate
review, including changing back to a previously reviewed value. Definitively
rejected attempts retain identity; only explicit cancellation permits edit.
No import cache optimistic row is written and invalidation defers active refetch
when another mutation is pending. Scope uses incumbent components/styles; no
product-wide design context or governance file is created.

Five focused suites passed 113 tests, including insert-only encrypted action,
validation/provenance limits, known/unknown failure distinctions, exact/conflicting/
missing ID checks, duplicate acknowledgement, no implicit writes, identical retry,
partial frozen batch/continuation, 21-row cap across pages, close and actual-provider
hide lifecycle. The initial repeated 20-row DOM-interaction fixture exceeded the
default timeout; batched test events corrected fixture overhead without raising
timeouts or changing production behavior. Earlier failures/logs are retained.
Full `pnpm check` passed before the final narrowly tested source-review fixes;
normal commit and push gates verify the resulting final source again.

Synthetic native browser used actual statement components/styles and local PDF.js
worker with an invented binary PDF containing all six kinds plus summary. Selection,
source-note preview, Enter zero writes and explicit keyboard save produced exactly
one fixed-memory request and one row; saved source note stayed available. At 390px,
document width/scroll were 390/390 and dialog width/scroll 373/373. Desktop/mobile
screenshots are retained in session outputs. The in-app native file picker failed;
a fixture-only file/date-event adapter supplied the invented File afterward.
Actual File reading/extraction/rendering followed. Arial fallback and fixed-memory
actions mean this is component/worker/UI evidence, not authenticated Next-page,
real bank-layout, private auth/RLS/database or production deployment proof.
Browser server is stopped; failure log and fixture are retained outside Git.
Impeccable detector reported no deterministic scoped UI findings.

Normal full check/build/coverage hooks and exact-head hosted CI remain release
requirements. Their results are recorded in the implementation PR and continuation
handoff. Status remains approved until merge; no main merge is authorized here.

## Independent continuation review correction

The owner-requested continuation chat independently inspected commit 18a9cf0 and
found one actionable issue: a confirmed insert's refresh could be deferred during
another pending mutation and never retried, leaving the expense table missing it.
The scoped hook now retains only the original query object's identity, subscribes
to real mutation-cache events and initiates a fresh active refetch when pending
mutations finish and the same presentation owner can reveal. Hide delays this
fresh read; Show can release it. Removed/replaced private cache identity and
unmount discard the queue; no old data or import acknowledgement is replayed.
Two actual QueryClient/QueryObserver/MutationCache regressions prove deferred
table recovery after a real pending mutation and no invalidation after query removal.
Three focused action/helper/component suites passed 55 tests. The previous broad
coverage run was stopped because this review superseded its source; its log is
retained rather than treated as final-head evidence. No new paths or protocol.

Normal commit checks passed for the initial implementation. Automatic approval
review rejected remote push because explicit permission to publish repository
contents to `https://github.com/cljiahao/fynfo.git` was missing. No workaround,
push, PR publication or CI claim is made. Complete final local gates and ask owner
for that exact publication permission before repeating normal push hooks.

Final correction commit 64981df passed normal check hooks and its production build.
V8 instrumentation made the dense 21-row native-control fixture take 5.764s,
exceeding Vitest's default 5s budget despite the same assertions passing focused
checks. That single test now has a 10s harness allowance; no assertion, application
timeout, global test configuration or coverage threshold is changed. The failed
broad log is retained, and full coverage is repeated. No production source changes
after the successful corrected build. Public origin metadata was verified, but
automatic review still requires explicit owner permission for remote publication.
