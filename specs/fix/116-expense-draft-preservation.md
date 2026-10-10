---
id: 116
slug: expense-draft-preservation
area: fix
status: shipped
author: Codex
created: 2026-10-11
approved:
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/39
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.6'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.3'
  - '§4.4'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec 116: Preserve independent expense drafts

## Problem

Saving any expense clears every unsaved inline draft. Cancelling the first of two drafts reuses the first editor's local inputs for the survivor. Repeated saves of a pending draft can generate different expense IDs, and the Add Row date remains the date the module loaded. Pending completion also publishes a global notice after the table unmounts. Generated mounted tests establish these paths; they do not establish production duplicates or authenticated persistence.

This records an ordinary owner-authorized audit remediation under Constitution §7.4. The owner requested sequential improvements and parallel worktrees; root accepted these exact eight paths and the pending new-row policy on 2026-10-11 after verified PR38 delivery. This records the existing owner authorization and reviewed scope selection, not agent approval of a new feature or a migration. The approved field remains blank. This audit is published before executable edits.

## Constitution check

- Preserve encrypted actions, identity/vault order, data model and query ownership (§2.1–§2.3). The existing expense_records.id is plaintext operational identity; monetary amounts, item and info remain ciphertext under the unchanged existing payload contract. No database receipt is introduced.
- Keep the existing internal feature composition and named exports (§2.6, §3.2). No dependency, protected edit, migration or encryption protocol change (§8.2).
- Meaningful actual-component regressions, all five gates and independent review remain required (§4.1–§4.4, §7.4). Ordinary audit approval fields remain blank; shipment fields wait for verified merge.
- Overrides: none. Existing client components already require interactive state; no new client boundary is proposed.

## Solution shape

### Recorded paths

Exactly eight ordinary paths are proposed:

1. `specs/fix/116-expense-draft-preservation.md`
2. `src/features/expenses/components/expense-table.tsx`
3. `src/features/expenses/components/editable-expense-row.tsx`
4. `src/features/expenses/components/expense-type-select.tsx`
5. `test/features/expenses/expense-draft-preservation.test.tsx`
6. `README.md`
7. `specs/fix/112-year-zero-months.md` — verified shipped metadata/current delivery only.
8. `docs/audit/2026-10-09-roadmap-progress.md` — factual PR38 delivery and linked 116 scope only.

The category component path is necessary because its current input and popup do not accept a disabled state. Existing shared call sites must retain default enabled behavior. Root verified PR38 merged at 2026-10-10T17:23:27Z as `1c9857c014038e755c54140cb9d50398103c3223`, exact published head `5e60b81e83e04fe41ff9ad31278da17d2aa80e65`, with CI 38071070671 SUCCESS at 17:20:31Z. The two linked ordinary closeout paths are explicitly included before any edits. Root verified public production deployment status SUCCESS at https://vercel.com/noxynx/fynfo/8diU35ZaLJWq4N6JDeXPCcpk26hZ ; no private workflow claim is permitted.

### Draft identity and projection

- At Add Row, generate an ID using the existing `generateId` helper and generate today's date with the existing local-date formatting policy. No extra draft state or protocol is required.
- Key new editors by that stable ID. Cancel and successful new save remove only that ID. Existing-record saves never clear new rows. Preserve failed draft inputs and ID for retry.
- Real optimistic upsert inserts the stable ID into the owner expense cache before settlement. Hide cached rows whose IDs are still active drafts in the table's persisted-row projection, avoiding a second editor for the same operation. Keep the optimistic hook/action and all other consumers unchanged. Once that draft saves and is removed, its cached persisted row becomes visible normally. Do not hide distinct existing rows or change aggregate financial calculation semantics.

### Pending policy requiring root acceptance

Freeze only the saving **new** row until settlement. Other drafts and existing rows remain usable. Set a row-owned synchronous ref before dispatch, with state for rendering, so repeated Enter, blur and split confirmation cannot dispatch another save before React commits. Keep the callback type compatible with `void | Promise<void>`; settle local pending state in `finally`, guarded against unmount. Existing-row save dispatch behavior remains unchanged.

Use explicit native disabled controls and guarded mutation handlers, rather than invalid fieldset/table markup or an inert-only accessibility claim. Disable date trigger, item/info/amount inputs, category input/options, split selector/trigger and new-row cancel while saving. Show concise visible `Saving…` status and row busy semantics; do not imply cancellation can undo a dispatched write. Close/suppress date, category and split popup content while saving and guard their callbacks, including portal callbacks. The category component gains an optional disabled prop, defaults false, and suppresses its popup when disabled. No broad form rewrite or abstraction is proposed.

The table must suppress stale success/error notices and state removal after its unmount. Already-dispatched actions may still persist; this is UI lifetime protection, not server cancellation. Stable draft IDs prevent a repeated pending click from creating another ID, but do not establish cross-session idempotency, compare-and-save or exactly-once persistence.

## Out of scope

- Expense CAS/revisions, database receipts, duplicate repair, historical record rewriting or a migration.
- Existing-record simultaneous edits, server write cancellation, retry-after-ambiguous-network guarantees or provider behavior.
- Query/action/optimistic rollback refactors, date timezone policy, split arithmetic, table layout and global pending lock.
- Protected rules, dependencies, telemetry and real accounts or confidential records.

## Acceptance

- [ ] Publish the accepted exact scoped audit before product edits; preserve draft-only authorization status until root selection.
- [ ] Render actual table and actual editor: saving one new row preserves sibling drafts; existing save preserves new drafts; deferred completion preserves later-added draft; cancel-first retains the survivor's exact item/amount/identity.
- [ ] Failure preserves the saving draft inputs and stable ID; retry uses that ID. Successful save removes only its draft.
- [ ] While one draft saves, actual controls are disabled and portals closed; Enter/blur/split-confirm cannot dispatch again, while another row can still be edited/saved/cancelled. Use real user events for disabled controls, not artificial changes through disabled DOM inputs.
- [ ] Actual QueryClient and existing optimistic hook with inert server actions show exactly one editor per pending ID and exactly one persisted row after success; failed rollback retains the draft without an optimistic duplicate.
- [ ] Date generated at Add Row reflects the current local day after module loading.
- [ ] Table and row unmount prevent late state/toast publication; existing row timers still stop on unmount. No claim that writes were cancelled.
- [ ] Existing expense editing, lifecycle, workflow, split and category tests pass unchanged unless an actual contract adjustment is explicitly added to scope.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm build` pass; aggregate coverage stays above 80% in every metric and existing strict floors remain.
- [ ] Second independent source review and scoped README/comment review pass. Accessible pending controls receive actual mounted qualification; browser qualification only if mounted/native portal behavior leaves uncertainty.
- [ ] Frozen path hashes and exact-head CI pass through unchanged commit/push hooks. Do not mark shipped before merge.

## Risk & reversibility

- **Blast radius:** inline new expense editors and category disabled behavior. Incorrect projection could hide cached expense rows, so compare only exact active draft IDs and assert final row count under real optimistic cache behavior.
- **Reversibility:** a focused ordinary code/test/docs revert; no schema or data migration. Reverting returns the prior draft-loss risk.
- **Backout plan:** revert only this scoped batch. Never delete previously dispatched expenses to imitate a UI cancellation; owner data repair would need separate evidence and approval.

## Open questions

- Root accepted the eight-path scope and pending new-row policy on 2026-10-11, including disabled cancellation until settlement, native disabled controls and concise status; no invalid fieldset wrapper.
- Root selected the two named linked PR38 closeout paths after verified merge and verified public production status. No private production workflow was accessed.
- [ ] Implementer/reviewer: prove real optimistic projection and portal/callback behavior before declaring source frozen; expand no path implicitly.

## Investigation evidence

Source: expense files at main `349bf026da12980eb62a99274d4221d8ccfe6727`, unchanged in published PR38 head `5e60b81e83e04fe41ff9ad31278da17d2aa80e65`.

External baseline file `expense-draft-preservation-baseline.test.tsx`: actual table/editor, mocked hooks only, **4 failures / 1 passing failure-retention control**. Log `expense-draft-preservation-baseline.log`. Failures reproduce sibling/existing-save loss, index-key editor reuse and later-added draft loss.

External supplementary file `expense-draft-preservation-supplementary.test.tsx`: **5 failures** for multiple generated IDs, creation date after the clock advances past module load, newer input loss during a pending save, and late success/error notices after unmount. Log `expense-draft-preservation-supplementary.log`. The newer-input case establishes baseline loss; the proposed policy instead blocks new edits while saving and must use a different final disabled-control assertion, not promise editable preservation.

These tests ran as temporary synthetic fixture files only, with no staging or product source change. They do not exercise a real database, encryption, authenticated browser or production account. No full gates, new implementation or performance claim follows from the investigation.

## First source review correction

Root identified an uncontrolled split-selector portal: disabling only its trigger did not close open options, and option Enter could reach row-save handling. Keep the selector controlled by the existing row, suppress/close while saving and prevent its portal keyboard events from triggering row saves; use synchronous open refs for the row key boundary. This is the same recorded row path, not a new feature. Captured effect-instance lifetimes qualify table/row completion after cleanup, matching the existing quick-add pattern. Category choices are hidden while disabled; retained local query/open state may resume after a failed save, preserving the prior choice rather than claiming reset. Native pending button name is Saving expense. No full gates or shipment is claimed yet.

## Second source review refinement — before delete remediation

Root identified that the same table's delete completion also publishes notices after unmount. Add both generated deferred delete success/error baselines and captured-instance guards within the same eight paths; no action/query changes. The row's onSave callback owns failure reporting; rejected standalone callbacks are contained while pending state settles, not advertised as a row-owned error message. Preserve actual option-Enter selection and split-dialog staging without premature saves. No delete source remediation has been applied at this recording boundary.

The separate delete-lifetime baseline ran against the still-unmodified delete handler: both actual mounted deferred outcomes failed (`116-delete-lifetime-baseline.log`). Captured-instance delete notice guards were applied only after that proof. The source path inventory remains eight. Temporary external baseline copies are removed after preservation; no full gates have run yet.

## Independent keyboard review refinement — before category remediation

The independent reviewer identified category choice Enter bubbling to the row after the synchronous open-ref closes, potentially dispatching the previous category before its state update. Add an actual choice-selection baseline before correcting the already-recorded category component; retain explicit category-submit behavior. Add a two-row deferred real optimistic settlement control. The two combined delete tests initially used an unrelated mock and are corrected to exercise the actual deferred boundary; this is test wiring, not a second product finding. Exact eight paths remain unchanged.

Root also requested category Escape and explicit-submit keyboard controls: handled category Enter/Escape must stay within that widget instead of cancelling/saving its ancestor row. This refinement is recorded before editing the category handler, within the same component path. The actual choice Enter baseline failed with one upsert of the old category; all19 other new cases passed (116-category-baseline.log).

The category keyboard baseline now establishes all three actual failures before handler edits: choice Enter dispatches the previous category (`116-category-baseline.log`: 1 failure/19 passing controls), and category Escape removes the draft while explicit existing-row selection prematurely dispatches (`116-category-escape-submit-baseline.log`: 2 failures/20 skipped). Handled category Enter/Escape now stop ancestor propagation while preserving selection, explicit onSubmit and default quick-add behavior. Final corrected tests remain pending; no full gates or shipping claim.

## Final focused verification and source freeze

Corrected verification passed 130 tests across seven files (`116-targeted-final.log`), including all22 new mounted cases and existing expense editing, workflows, lifecycle, table filtering, spec048 quick-add and spec110 paste contracts. TypeScript and zero-warning scoped ESLint also passed (`116-typecheck-final.log`, `116-scoped-lint-final.log`). Baseline files retain their separate proof accounting; the two combined delete failures were inert test wiring and are not counted as additional product defects.

Real QueryClient tests use the existing optimistic hook and generated action mocks: a pending ID has one editor, success exposes one persisted row, failure retains the stable draft ID, and two out-of-order saves preserve the failed sibling for same-ID retry. These are UI/cache contracts, not actual authentication, ciphertext, database, cross-session exactly-once or production proof. Actual Radix option Enter stages Shared without premature upsert, category choice/submit/Escape stay local, and native disabled controls affect only the saving draft. Category query state is intentionally retained while choices are suppressed during saving. The callback owner reports failure; the standalone row only contains rejection and settles pending state.

Impeccable harden/craft-floor guidance was reviewed for visible local pending status, truthful control names, native disabled behavior and preserving the incumbent compact interface. Removed obvious table section/JSX narration, retained the non-obvious filter reset contract and row local-state rationale. README documents independent drafts, current-day creation, retry identity and dispatched-write limits. No new tooltip, disclosure, layout, dependency or skill installation is necessary.

Application and test source is frozen pending final independent/root acceptance; full five gates, normal hooks, exact-head CI and merge remain pending. The eight-path manifest is external `116-scoped-hashes.json`. No shipment or exhaustive project verification is claimed.

## Independent acceptance before full gates

Root's final review of the three product component diffs found no remaining scoped blocker. The independent reviewer verified all eight frozen hashes and accepted the category, portal, concurrent optimistic and lifetime boundaries. External report `116-independent-source-review.md` SHA256 `a58629b8e0a1ce7ae369c00bbef8d35a370dbaef806e234a99a38e0d35f79515` retains the qualified read-only evidence. Product/test source is unchanged; only this acceptance recording is appended. Root released the heavy slot for all five synthetic gates and unchanged normal delivery hooks. Coverage and delivery results remain pending below.

## Complete local gates before delivery

All five gates passed sequentially in the isolated synthetic fixture: full route/formatter/zero-warning lint/TypeScript check (`116-full-check.log`), coverage (`116-full-test-ci.log`) and normal Next.js16.3.8 build (`116-full-build.log`). The full suite passed144 files/1,432 tests in351.45s. Coverage:93.09% statements (4379/4704),89.11% branches (3004/3371),91.44% functions (1336/1461),93.79% lines (4024/4290). Every existing security/aggregate threshold passed unchanged. Product/test hashes are unchanged after both accepted reviews; only factual evidence is appended. No real env, confidential record, provider account or database was used. Normal commit/push hooks, exact-head CI and verified merge remain required;116 remains unshipped.

## Verified delivery closeout

PR39 exact head 33d2f04872d3a7ef1a15a1e18e99f26cf7f05ce4 merged as 64e2dc9392fb6d4fd8bb3748b86963ebe3f47d85 at 2026-10-10 18:14:57 UTC. Required CI 38074504124 succeeded at 18:11:13 UTC, and preview checks succeeded. Root verified public production deployment FaqbJcZDZQcpC5VGaBiEE62tC8mr SUCCESS at 18:15:37 UTC. Normal unchanged hooks passed: 144 files/1,432 tests; coverage 93.09% statements, 89.11% branches, 91.44% functions and 93.79% lines. Private production workflows were not accessed. This closeout changes no historical approval or scoped behavior claim.
