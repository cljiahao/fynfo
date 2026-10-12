---
id: '134'
slug: expense-reuse-draft
area: feature
status: shipped
author: Codex
created: 2026-10-12
approved: 2026-10-12
shipped: 2026-10-13
impl_pr: https://github.com/cljiahao/fynfo/pull/51
supersedes:
constitution_satisfies: ['§1', '§2', '§3', '§4', '§5', '§7', '§8']
constitution_overrides: []
---

# Spec 134: Reuse an expense as an editable draft

## Problem

Repeated manual entry makes ordinary purchases unnecessarily slow. A recorded
expense already contains useful category, item, notes and amount values, but the
user must type them again. The owner requests individual feature review before
implementation, including merchant rules, recurring expenses, imports and
refund/transfer/card-repayment classification. This proposal approves none of
those follow-ons implicitly.

## Authority and source evidence

Owner approval 2026-10-12: “confirmation sewep and if all is proper and going to
work as intended please implement and PR.” This authorizes the confirmation
sweep, bounded 134 implementation, normal hooks/verification, commit, push and
PR. It does not authorize merge or the staged follow-on features.

Confirmation decisions: compose with an expense-owned coordinator and a typed
Quick Add imperative request handle, so replacement decisions preserve existing
input state without a global event bus. Authoritative refresh uses the existing
authenticated `getExpenses` read action directly; failed reads never unlock uncertain
drafts. A missing record after successful refresh keeps the retained payload
frozen because an original write could still finish; an exact match confirms
completion; changed values
freeze the conflict and disable retry. Existing source row values must match
the saved query snapshot and no row save may be pending before reuse.

Initial investigation was authorized in branch `prep/expense-reuse`, based on merged
`291fd51b2eb340a6fe13df82f2319b4cea89e4e6`. No partial 134 was present in the
initial clean working tree. That proposal phase made no executable changes.

- `expense-quick-add.tsx` keeps five inputs locally, constructs a new ID on each
  submit, clears immediately and can auto-submit tab-separated paste.
- `expense-table.tsx` owns filtered/paginated saved rows; the dashboard currently
  composes Quick Add and table as siblings.
- `editable-expense-row.tsx` has blur-save behavior. Reuse must not accidentally
  trigger a source edit when the user clicks the new action.
- `expenseDataSchema` permits positive finite expenses, not signed ledger flows.
- `upsertExpense` calls the existing atomic `replace_expense_record` RPC by ID.
  Repeating the identical payload with its retained ID replaces that record;
  this is not semantic duplicate prevention across files or sessions.
- Shipped 132 validates export JSON locally; shipped 133 extracts editable PDF
  candidates locally. Neither offers selected-record saving. Statement candidate
  IDs and source locations are not durable bank transaction identities.
- The existing expense hook inserts optimistic rows and does not refetch expense
  records on successful writes. An optimistic row is not proof of a saved row.

## Constitution check

Preserve existing personal-vault ownership, encryption, auth/vault gate, RLS and
server-action mutation boundary (§§1, 2.1–2.4, 5). Client interaction justifies
the existing client components (§2.5). Preserve feature barrels, named exports,
stack, file naming and existing primitives (§§2.6–2.7, 3). Require unchanged
quality gates, hooks and exact-head green CI before release (§4). Owner approval
is required before implementation (§§7–8). No constitutional override or
governance amendment is requested.

## Solution shape — first batch only

### Job, direction and visible sequence

Operate mode: a person recording a familiar purchase uses a prior personal
expense as a starting point. Preserve the incumbent typography, semantic colors,
form controls and expense page structure. No new dashboard, wizard or modal for
the ordinary reuse flow. This is a provisional UX brief for owner review, not a
confirmed Impeccable direction contract; PRODUCT.md is absent and is not invented.

1. Each saved **self** expense offers a named `Reuse` action beside existing row
   actions. Unsaved rows, shared rows and currently saving/editing rows have no
   enabled reuse action. A changed source row must be explicitly finished first;
   clicking Reuse must not initiate blur-save or deletion of that source.
2. Reuse fills Quick Add with category, item, notes and amount. Date becomes
   **Today**, computed at activation using the browser-local calendar convention
   already used by Quick Add. Original ID, date, splits and settlement state are
   not copied. Household and shared expenses are not silently converted to self.
3. A visible banner says `Reused expense · Date set to today · Self expense`.
   Inputs remain labeled and editable, including the date. Focus moves to the
   item field and the form is brought into view; status is announced politely.
4. Choosing Reuse causes zero writes. In reuse mode, blur, category selection,
   Enter in inputs and paste cause zero writes. Explicit keyboard activation of
   Add Expense remains accessible. Plain-text paste stays ordinary input;
   tab-separated row paste is prevented with `Finish or cancel this draft before
pasting expense rows`. Saving requires the labeled **Add Expense** button.
5. If Quick Add contains typed/pasted content or another reused draft, show
   `Replace current draft?` with `Keep draft` and `Replace draft` before staging
   new values. Date/category defaults alone are not a dirty draft. Replacement
   never writes either draft. A pending/unconfirmed save blocks replacement.
6. `Cancel reuse` clears the reused draft, resets Today and default category,
   and returns focus to the originating action when available, otherwise the
   form heading. It does not delete any saved expense. Dirty cancellation asks
   to discard changes; canceling an unchanged reused draft needs no second dialog.

### Save and lifecycle contract

- Generate a fresh expense ID once on reuse activation, distinct from the source;
  retain it through edits and submission. Payload remains `ExpenseData` with
  `splitType: self` and `splits: []`; notes are copied explicitly, not bank source
  text or hidden provenance. No new stored fields.
- Validate date and positive finite amount before mutation. Errors stay next to
  the affected input and preserve the draft. No new rounding/currency assumptions.
- Freeze submitted values and ID while pending. Disable repeated save, replacement,
  cancel and input editing. Use the existing mutation hook and encryption action.
- Clear only on fulfilled server acknowledgement. If rejection may represent
  an unknown outcome, retain the frozen submitted payload and show `Save
unconfirmed. Check expenses before retrying.` An explicit retry submits that
  identical ID/payload; it must not build a fresh expense ID.
- In the unconfirmed state, offer read refresh through the existing expense read action
  and `Retry same expense`. Do not infer confirmation from the optimistic cache.
  Editing/discard/replacement remain blocked until a successful retry or a fresh
  server read confirms the exact submitted record exists. Absence is not proof
  an original request cannot still finish; preserve the frozen payload. If the read
  finds the ID with changed values, show a conflict and require a separately
  reviewed resolution rather than overwriting it automatically.
- Navigation/lock/unmount destroys local draft state and ignores late UI callbacks.
  An already dispatched server save cannot be canceled by navigation; no secure
  memory erasure or persistence across navigation is promised.
- This bounded mode does not remediate the existing manual/paste submission path.
  Keep its incumbent behavior and regression coverage unchanged.

### Planned paths and public interfaces

Before implementation approval, finalize names against a narrow consumer sweep.
Expected edits are expense `components/expense-quick-add.tsx`,
`expense-table.tsx`, `editable-expense-row.tsx`, component/feature barrels and
the dashboard composition; add an expense-owned `expense-entry.tsx` coordinator
and a pure `lib/reuse-draft.ts` mapper/state helper if needed. Dashboard remains
thin and moves its two existing components into the coordinator, with no new
page-owned fetching. Coordinator owns ephemeral reuse requests; row callback
passes a validated saved self expense; Quick Add receives the request and reports
draft/pending availability. No global event bus, local storage or query-cache draft.

Tests: focused reuse mapping/lifecycle/component regressions plus existing
quick-add/editing/workflow suites. Update README only for the new user contract.
No action, schema, SQL, crypto, dependency, protected tooling or other-worktree edit.
If this path list proves insufficient, revise the proposal before implementation.

## Out of scope

Merchant matching or normalization, templates/schedules, batch import saving,
shared reuse, household writes, refunds, transfer/repayment accounting, semantic
duplicate prevention, new dependencies/migrations, browser storage, background
writes and automatic categorization. No implementation, commit, PR publication,
merge or deployment is authorized by preparing this draft.

## Acceptance

- [ ] Reusing synthetic `2026-09-04 / groceries / Example Market / weekly basket /
42.60 / self` on local 2026-10-12 produces Today, groceries, the same item/notes
      and 42.60, a different ID and no splits. No mutation until Add Expense.
- [ ] Date is evaluated at activation, including after local midnight; explicit
      date edits remain intact. Source is unchanged by reuse/cancel/save.
- [ ] Shared source, unsaved source and source with unsaved edits cannot be reused;
      row action does not cause blur-save. A filtered/paginated source is identified
      by its record, never a visible row index.
- [ ] Dirty-draft replacement retains values on Keep and replaces only on Replace.
      Reuse paste/blur/Enter/category interactions do not dispatch a write.
- [ ] Invalid dates, zero/negative/nonfinite amounts show field feedback and retain
      inputs. Successful save creates exactly one self record and clears after ack.
- [ ] Double click/pending navigation/late callbacks are handled; ambiguous failure
      retains frozen values and ID; retry sends the same payload. Refresh must use
      fresh server results; optimistic presence is not confirmation. Conflict is visible.
- [ ] Synthetic desktop/mobile/keyboard checks verify labeled Reuse/Cancel/Add,
      focus, replacement dialog, status/error announcements and visible Today/self
      assumptions without clipping or dependence on hover alone.
- [ ] No plaintext draft persistence, logs, analytics, raw errors or additional
      network calls before explicit save/read refresh; lock/unmount clears local state.
- [ ] Meaningful regressions pass, unchanged `pnpm check`, `pnpm test:ci`, build,
      active hooks and exact-head green CI before release; independent second review.
      Heavy jobs remain serialized with the main chat, with no heavy proposal jobs.
- [ ] Owner approval recorded and approved spec hash retained for implementation.

## Risk & reversibility

Primary risks are replacing an unsaved form, copying a stale amount/notes and
unintentionally altering a source through blur-save. Explicit replacement,
visible editable fields, saved-self-only sources and event handling bound these.
Stable in-memory IDs reduce retry duplication but do not survive page reload or
prevent an intentional second purchase. The existing replacement action is
last-writer-wins: a later concurrent edit can still race a read or retry; this
feature adds no revision/CAS guarantee. Existing date representation is preserved.
Revert the scoped UI/helper/tests/docs to remove reuse; legitimately saved new
expenses remain ordinary records and can be deleted through the existing UI.
No rollback migration or automatic deletion of financial records.

## Staged follow-ons — each needs its own reviewed spec

| Stage                   | Proposed UX and exact initial boundary                                                                                                                                                                                                                                                                                                                       | Schema/security/dependency decision                                                                                                                                                                                                                                                   | Synthetic acceptance example                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import save             | Select individually reviewed, positive SGD candidate rows; unresolved/excluded rows cannot be selected. Show source page, date/category/amount and selected total before explicit save; serialize bounded saves and report confirmed/unconfirmed/skipped per row. Freeze IDs/payloads through retries; confirmed rows cannot be resubmitted in that session. | Existing expense action can support session retries without SQL, but no durable provenance or cross-file uniqueness. PDF review becomes server-writing only on explicit selection/save; file stays local. New full proposal required.                                                 | Two 12.00 purchases on the same day remain distinct candidates; one successful and one ambiguous save yields one confirmed, one unconfirmed, never “2 imported”. |
| Classification review   | Show suggested expense/refund/transfer/card repayment/unknown labels with source evidence. User confirms labels; only expenses are saveable initially. Ambiguous credits remain excluded.                                                                                                                                                                    | Existing positive expense model cannot record refunds or transfers correctly. True ledger entries, links and totals changes require separate schema/consumer/security proposal. No negative expense shortcut.                                                                         | A 25.00 refund and 500.00 card repayment are visibly excluded from expense save; a 25.00 purchase remains eligible.                                              |
| Merchant rules          | Explicit exact-match rule preview, category suggestion, original description retained, apply/ignore per row. Conflicting rules require review; no silent write.                                                                                                                                                                                              | Durable user rules need approved encrypted persistence, auth/vault/RLS, rule bounds and export lifecycle. Avoid regex/AI/dependencies in first proposal.                                                                                                                              | `EXAMPLE MARKET` suggests groceries; `EXAMPLE MARKETPLACE` does not match that exact rule.                                                                       |
| Recurring templates     | User-created template with frequency/start/end and next-due review list; occurrence opens editable draft, never auto-charges or auto-saves. No catch-up mass creation.                                                                                                                                                                                       | Encrypted template and occurrence identity, timezone/month-end policy, edits/skips, ownership/export and concurrency contract require separate schema approval. No scheduler dependency assumed.                                                                                      | A monthly 31st-day 18.00 subscription proposes the last calendar day in February; changing actual amount to 19.00 saves only on confirmation.                    |
| Durable import identity | Reimport shows persisted source identity matches independently of current session; concurrency handled atomically and legitimate repeated purchases preserved.                                                                                                                                                                                               | Requires separately reviewed import identity/provenance storage and atomic uniqueness. Plain merchant/date/amount hashes leak equality and are not approved. Same-file hashes alone fail overlapping exports; bank transaction IDs may be absent. Identity design remains unresolved. | Importing the same transaction from overlapping statements does not duplicate it, while two real identical purchases both remain recordable.                     |

### Duplicate warning versus prevention

133 already flags repeated date/description/amount rows within one file. A future
import proposal can compare edited candidates with freshly read expenses and
flag a possible match. Both are provisional warnings: formatting changes,
incomplete reads, concurrent tabs and legitimate repeated purchases defeat a
semantic guarantee. Never silently drop a row, treat ciphertext as searchable,
or call this durable prevention. Persisted source identity plus an atomic server
contract must be separately designed and approved before making that claim.

## Owner decisions

- Resolved 2026-10-12: the owner selected confirmation sweep, implementation and
  PR for this proposal. Self-only source, Today, copied notes and amount,
  explicit-button save and retained unconfirmed draft are the approved defaults.
  Reuse is optional and is not a prerequisite for imports.
- Follow-on classification and durable identity decisions remain unresolved and
  do not block this schema-free feature. Each row above is a proposal boundary,
  not an implementation-ready or approved spec.

## Proposal-phase verification (historical)

Read AGENTS/CONSTITUTION, roadmap 081, shipped 132/133, actual expense model,
write/hook/helper and quick-add/table/row composition, statement candidate model
and parser/review source. Used synthetic examples only. No dependencies installed,
private data inspected, heavy verification run or executable changes made.

## Implementation verification

The confirmation sweep and a separate resulting-source review covered source
blur-save, dirty/pending eligibility, discarded-input confirmation, frozen retry
payloads, failed/missing/conflicting authoritative reads and late callbacks.
The initial 234 focused expense tests in 17 suites passed, including 15 reuse tests
and unchanged manual/paste behavior. Impeccable's scoped detector reported no
deterministic findings.

Final reader sweep found that TanStack Query 5.97.0 can return reverted cached
data after cancellation, even when the caller requests errors. Confirmation now
uses the existing authenticated/vault-gated `getExpenses` action directly. Only
after Quick Add's active lifetime check may the coordinator refresh the existing
expense cache, and only with no pending mutations. A late read cannot repopulate
the cleared cache after lock/unmount, and a snapshot cannot replace active
optimistic rows. Regression fixtures replay a canceled-query cached match,
late read and pending-mutation conditions. No action or hook implementation is
changed; these are confirmation corrections inside the approved component paths.
The resulting 18 reuse regressions passed after the direct-reader correction.

Actual in-app browser verification used the real expense components and existing
styles with isolated synthetic query/mutation boundaries and three invented
source records. Desktop and 390px mobile rendering, keyboard Keep draft/focus,
zero writes from reuse/input Enter, unconfirmed controls, missing-read retention
and explicit successful retry passed. Two synthetic mutation attempts (first
failed, second succeeded) produced one record. The mobile document had no page
overflow; the wide expense table retained its own scroll area. This is component
workflow evidence, not an authenticated production or full Next-page observation.
The final reader hardening is covered by the subsequent component regressions;
the earlier browser run establishes the unchanged layout and interaction states.
No private financial data, account, PIN, cookies or credentials were accessed.

Tooling setup copied only existing matching dependencies into this worktree,
remapping Windows junctions locally. pnpm subsequently rejected the donor's
installation metadata, so normal unchanged-lockfile offline reconstruction is
required for its gates/hooks. No new dependency, version, package manifest,
lockfile or protected tooling change is authorized or made. Temporary browser
fixture sources were removed after verification. Heavy checks are serialized
with the main chat after direct owner authorization for scheduling messages.

Full repository gates and normal commit/push hooks are required before PR
publication. The unchanged pre-push build/check/coverage run supplies the full
local verification under §7.4; its results and exact-head hosted CI are recorded
in the PR body and delivery report. Approval does not authorize merge and this
spec stays approved until a separate delivery actually ships.

## Prospective129/130 integration correction — 2026-10-12

Owner requested PR51 merge after greenCI; the old09cf0ee head conflicts with merged129. Prepare a normal no-commit main merge, retaining134 reuse and129 masking/native lifecycle guards in the already scoped expense-entry, expense-quick-add, expense-table and editable-expense-row paths. Add actual privacy regressions to the selected expense-reuse test. The existing coordinator captures hide epoch before direct getExpenses and rejects stale/hidden/teardown results before cache refresh or confirmation; Quick Add guards all reuse/save/check/discard event initiation and preserves frozen drafts. Capture and recheck its epoch after reads. Keep all financial inputs blank/disabled while hidden and Show accessible inside replacement dialogs. Preserve130 disclosure when its exact source is normally integrated; record the page/barrel composition addition before doing so. No action/schema/dependency/crypto/protected change or gate bypass. This is source preparation; old-head greenCI does not authorize merging a changed conflicting head.

## Integrated129 focused verification — 2026-10-12

Independent source review found no remaining actionable privacy integration issue. Four focused suites passed 62 tests, including actual-provider Hide/Show draft and stale-read regressions plus incumbent Quick Add, draft preservation and visibility boundaries. Log retained in parent work/134-integrated-targeted.log. Data/query boundaries are mocked; no private auth/RLS/database proof is claimed. Final normal hooks, full coverage, native composition and exact changed-head CI remain required.

## Prospective merged130–131 composition — 2026-10-12

Before resolving this normal main merge, select the existing Expenses page and components barrel plus README composition. Retain130 ExpenseAnomalyReview followed by134 ExpenseEntry, which owns Quick Add and the table. Keep all130/131 modules/tests unchanged and both README sections. Main130 PR53 merged f8dc9e8 and131 PR54 merged6b63ce5 after exact-head CI. This changes composition only; no alternate source copies or provider changes.

## Synthetic native integrated reuse verification — 2026-10-12

Hash-matched actual reuse components passed desktop and390px mobile checks in the isolated Next fixed-memory fixture. Keyboard Reuse created a today-dated editable self draft without a write; input Enter did not save. Cancel cleared the reuse draft. Keep draft retained ordinary unsaved text and explicit Replace populated the selected source. One explicit Add Expense caused one upsert and increased memory rows5→6, retaining the original visible date, description and amount. Hide blanked and disabled financial input properties/value attributes, removed source descriptions from the DOM, and Show restored the exact draft. Mobile document width and scroll width were both390.130 review still produced September120/median50/excess70, then invalidated when hidden. Images retained in parent work/134-reuse-desktop.png and134-reuse-mobile.png. Data/query boundaries are synthetic; committed-with-lost-acknowledgement/external conflict/auth/RLS/database branches are not native proof. Their retry semantics remain component-test evidence.

## Verified delivery — 2026-10-13

PR51 merged as `29394c8beb1f2d38954edd78fca17d7183c35390` at
2026-10-12T16:14:28Z (2026-10-13 Singapore), after exact head
`d28bfc3395a1889acbc437adb00da838c487012f` passed CI38275391567 at
2026-10-12T16:13:59Z. Main recorded unchanged normal build/check/coverage hooks:
165 suites, 1751 tests, S92.85/B88.49/F92.00/L94.49, with existing floors intact.
Independent source reviews and qualified synthetic desktop/mobile composition
passed. Earlier pending statements describe preparation stages. No private
authenticated workflow or production deployment success is claimed here.
