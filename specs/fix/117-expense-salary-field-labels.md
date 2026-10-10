---
id: 117
slug: expense-salary-field-labels
area: fix
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.6'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec 117: Associate expense, salary and planner field labels

## Problem

Quick Add shows Category, Item / Brand and Notes labels without associating them to their inputs. Inline expense Amount is an unnamed spinbutton. The salary dialog shows Gross Salary and Bonus labels without input associations. The live planner and isolated scenario reuse two unnamed Tithe/Allowance percentage spinbuttons; their visible labels target the checkboxes only. This prevents reliable accessible-name navigation and label-click focus despite visible field descriptions. Root identified the gaps during generated five-route browser inspection and selected the initial nine-path ordinary accessibility remediation under the owner's audit request, Constitution §7.4, on2026-10-11. Root accepted the additional three-path planner extension on2026-10-11. PR39/116 merged as64e2dc9392fb6d4fd8bb3748b86963ebe3f47d85 before this record was published; root authorized parallel implementation in the isolated117 worktree. Full gates and delivery wait119 merge and integration. This records ordinary owner audit scope, not agent feature approval; the approved field stays blank.

## Constitution check

- Preserve encrypted actions, identity/vault order, current data/query contracts and financial behavior (§2.1–§2.3). No encryption-touching path changes.
- Reuse existing internal components and named exports, native labels, IDs and aria names (§2.6, §3.2). No new dependency, primitive, suppression or inline styling.
- Actual mounted baseline regressions, all five gates and an independent review qualify the accessibility behavior (§4.1, §4.2, §4.4, §7.4).
- No protected file, schema, migration, crypto or dependency change (§8.2). No overrides or constitutional amendment.

## Solution shape

### Exact candidate inventory

Exactly fourteen root-selected ordinary paths: the original twelve label paths were recorded before executable edits; linked metadata paths13–14 were added before their edits as documented below:

1. `specs/fix/117-expense-salary-field-labels.md` — this complete scoped audit and evidence.
2. `src/features/expenses/components/expense-quick-add.tsx` — associate visible Category, Item / Brand and Notes labels using the component's existing useId prefix; preserve existing Date/Amount feedback associations.
3. `src/features/expenses/components/expense-type-select.tsx` — optional `inputId?: string`, forwarded to its native Input; default absent preserves other callers. Do not change inputRef, disabled or keyboard behavior.
4. `src/features/expenses/components/editable-expense-row.tsx` — give amount its concise accessible name “Amount (SGD)” via aria-label; column header remains visible, no layout or added label column. Query rows within their table row to distinguish repeated names.
5. `src/features/salary/components/salary-form.tsx` — use an instance-local useId prefix for Month, Gross Salary and Bonus native IDs/htmlFor. Retain the visible names and current form registration, numeric parsing, readonly-month behavior and dialog lifecycle.
6. `test/features/expenses/expense-quick-add.test.tsx` — native accessible names, label-click focus and two-instance unique associations alongside048 rapid entry controls.
7. `test/features/expenses/expense-editing.test.tsx` — named inline amount plus native optional category-ID behavior; existing keyboard/split/disabled controls remain.
8. `test/features/salary/salary-interactions.test.tsx` — actual dialog names/label focus and scoped two-instance unique IDs using existing real form/Query boundary; current saved payload/close timing/read-error controls unchanged.
9. `README.md` — concise field-accessibility contract alongside expense/salary documentation, without claiming all application controls are audited.
10. `src/features/assets/components/planner-results.tsx` — add only `aria-label="Tithe percentage"` and `aria-label="Allowance percentage"` to the respective native number inputs. No new IDs, checkbox label changes, numeric handlers, values, limits or disabled-policy changes.
11. `test/features/assets/investment-interactions.test.tsx` — existing actual SalaryPlanner mounted behavior, now qualifying names/disabled states and identical deduction output/settings callbacks using named controls.
12. `src/features/assets/__tests__/planning-scenarios.test.tsx` — existing actual live-planner-plus-scenario mounted isolation test, scoped percentage names in both instances, correct draft changes without live mutation, and existing save-pending fieldset qualification.
13. `specs/fix/119-overview-ssr-query-key-boundary.md` — ordinary linked shipped metadata, only after root verifies119 merge/checks/public production; preserve its historical scope evolution and qualified proof.
14. `docs/audit/2026-10-09-roadmap-progress.md` — verified119 delivery and117 preparation/progress only; no roadmap-complete or unmerged117 shipment claim.

Public API change is only the optional category `inputId` prop, default compatible. Existing client components already need interactive state; no new client boundary. No action/hook/server schema, DB field, RLS, encryption or dependency changes. No static option list or new constants are required. Before implementation, compare final merged116 source to its frozen hashes; if baseline changed, inspect/rebase the ordinary scope instead of assuming the earlier fixture is current.

### Actual source evidence

- Quick Add `expense-quick-add.tsx`304–320 Category,321–333 Item / Brand and334–345 Notes have no htmlFor/native ID. Date246–262 and Amount346–365 already use generated IDs and feedback relationships: preserve those passing controls.
- Category component currently exposes inputRef/disabled but no inputId; native Input at90 onward has no ID. Other callers must keep default behavior; optional ID forwarding is the smallest association change.
- Inline `editable-expense-row.tsx`295–309 amount Input lacks an accessible name; the Amount table header is not itself a native input label. Its numeric steps/amount conversion/pending guard remain untouched.
- Salary `salary-form.tsx`130–152 Gross Salary/Bonus Label have no htmlFor and their Inputs no IDs. Month117–125 currently uses fixed `salary-month`; instance-local IDs preserve its association and prevent collisions when two dialogs are mounted.
- `planner-results.tsx`127–135/150–160 native number inputs have no aria-label/labelledby/associated Label. Tithe/Allowance Label122–125/145–148 targets each checkbox ID, so naming the checkbox does not name the percentage input. Consumers are actual `salary-planner.tsx`327 onward and `scenario-dialog.tsx`265 onward, the latter supplying its own idPrefix. Concise aria names need no IDs and preserve default checkbox IDs plus existing scenario prefix isolation. Repeated names are intentional; scope queries with `within` each planner/dialog, rather than claiming globally unique names.
- Existing actual mounted live deduction test is `investment-interactions.test.tsx`194 onward, currently accessing percentage inputs by array index. Existing actual mounted live-plus-scenario label/ID isolation is `planning-scenarios.test.tsx`104 onward; extending it avoids a mocked PlannerResults-only test that could miss real consumer wiring.

These are current source observations. Baseline tests below have not been executed by this preparer and no failure count is claimed. The separate unconfirmed-input recovery proposal is now118 and remains pending a concrete owner decision because it changes048's explicitly approved failed-input-loss tradeoff. This label-only batch preserves immediate reset and failed-save behavior.

## Out of scope

- Quick Add draft recovery, retry buttons, unconfirmed collection, persistence or changing048 rapid reset/110 paste contracts.
  -116 stable IDs/projection/pending controls, existing-record concurrency, server cancellation and duplicate guarantees.
- Salary CAS, amount parsing, validation, save lifetime, loading, dialog design or new form abstraction.
- Full application accessibility audit, new label text/visual layout beyond the named fields, shared primitives, performance claims, telemetry, dependencies, schema, crypto and protected files.

## Acceptance

- [ ] Publish the exact fourteen root-selected paths and scope, with original twelve label paths recorded after verified116 merge and two linked119 metadata paths recorded before their edits. Keep authorization historical and shipment fields blank until delivery.
- [ ] Actual Quick Add baseline: getByRole textbox names Category, Item / Brand and Notes fail on current source; existing Date button and Amount (SGD) spinbutton associations pass. No mocked missing export/import failure counted.
- [ ] Actual inline row baseline: getByRole spinbutton name Amount (SGD) fails on current source; existing numeric editing/save payload behavior passes as a control.
- [ ] Actual salary baseline: getByRole spinbutton names Gross Salary and Bonus fail on current source; Month label association and existing exact saved payload/close-after-settlement controls pass. Fixtures exercise the real form branch, not existing read-error-only test.
- [ ] Corrected native label clicks focus Quick Add Category/Item/Notes and salary salary/bonus inputs. Date label still focuses its button; Amount invalid feedback retains aria-invalid/describedby after110 invalid paste.
- [ ] Two Quick Add instances and two salary dialogs have nonempty unique IDs and label targets resolving inside their own component/dialog. Scoped names preserve accessible discovery without ambiguous global queries.
- [ ] Actual live planner baseline: named Tithe percentage/Allowance percentage spinbutton queries fail on current source while existing Tithe/Allowance checkbox-name queries and enabled/disabled numeric values pass. Do not count a missing module/import as evidence.
- [ ] Corrected live and scenario consumers expose both percentage names, including disabled controls. Tithe remains disabled exactly when titheEnabled is false; Allowance follows its own existing toggle. Existing numeric values/min/max, setters, outputs and autosave payloads remain identical.
- [ ] Actual simultaneously mounted live planner and scenario dialog use scoped name queries; scenario percentage edits affect only its draft, no live callback or settings write. Busy scenario fieldset remains disabled and fresh prefixes/checkbox labels retain existing unique-ID proof. No additional input ID is introduced for aria-label-only inputs.
- [ ] Category default caller remains enabled with unchanged keyboard selection/submission/Escape and ref forwarding. Optional inputId appears only on the supplied native input.
- [ ] Existing expense quick-add/editing/workflow/draft-preservation, salary interaction and auth095 tests stay green; no output payload/state/ID/amount/date changes.
- [ ] Per-batch README/inline-comment review removes no necessary non-obvious constraint and introduces no claims about unrelated controls or database security.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` and `pnpm build` pass with every existing strict coverage floor unchanged and every aggregate metric above80%.
- [ ] Second independent read-only review of frozen paths/source/test/prose passes. Browser label focus qualification if native component uncertainty remains. Exact-head CI and unchanged normal hooks pass before merge.

## Risk & reversibility

- **Blast radius:** native field names/focus in expense quick add/inline row, salary form and shared live/scenario planner percentage inputs. Planner controls must preserve passing values/toggles/output/settings payloads; aria attributes alone do not establish consumer behavior. Incorrect IDs could target another instance or break invalid-feedback relationships; actual two-instance and preserved-feedback controls qualify those paths.
- **Reversibility:** focused ordinary code/test/docs revert; no data/schema migration or record rewriting.
- **Backout plan:** revert only117 source/test/docs. Keep116 and048/110 delivery history unchanged. Returning to prior label gaps changes no stored financial data.

## Open questions

- Root selected initial nine-path label-only ordinary remediation on2026-10-11, then accepted planner paths10–12 after full external extension review. Implementation started only after116 verified merge and coordinated timing;119 retains delivery priority. No new feature/dependency/SQL approval is requested by this audit.
- Candidate paths are exact and bounded; root reviews this full external extension before author handoff/repository publication. No extra closeout metadata path is implicit.
- Owner/root must decide118 recovery separately;117 does not authorize it or modify048 approval.

## Preparation evidence and limits

Read full SPEC_TEMPLATE, current components and existing actual consumer tests. Reviewed source hashes: Quick Add `b6004975f86375d0922043709794e1112fc0d155a4515f90e114e6c6bddc6e7e`, frozen116 category `6a518921d4760f90674dae84322f384d7d3f21fab6ced1a9ad98bc3de374931c`, frozen116 inline row `1e6c83cdd32f383c4a1d45ace40e8784aeaa3241af43ebe182e3a6c9d05b1327`, salary form `e822dcad633dd81a1c3e05d7121e7ff0a961970c3808e1893f1a0bdd4606dc52`, PlannerResults `be57d3077ac29ed9d01ac39445034c8623d3425a568bc1bd38739785fdd047da`, existing live interaction test `cfdb40606a7d9ab1e573eb0f87c62542e306a928ba6466e5a177e648c7d7e5de`, existing scenario test `a6d5782cb93f4be5df63cc9c7f20557ac1fe56e57f74f9a63d412038e8e67907`. No app edits/tests/heavy jobs/private inputs occurred in this preparation. Impeccable craft-floor accessibility guidance supports native label association within the incumbent interface; no new UX feature/layout or skill installation follows. This is bounded preparation, not final whole-project confirmation.

## Implementation boundary — 2026-10-11

Root selected all twelve paths after full draft review. Record published before executable changes on impl/117-expense-salary-field-labels from merged11664e2dc9. Preserve earlier preparation text as historical; proposed extension questions are resolved by this selection. No118 implementation is authorized. Synthetic baseline and focused checks follow; full gates/commit/push wait119 merged-main integration. No implicit116 closeout metadata paths are included.

## Baseline and focused implementation proof

Fresh external `fynfo-117-fixture` was created from tracked source at merged11664e2dc9, with the existing090 dependency junction. Only tracked nonsecret source/configuration and placeholder `.env.example` were copied; no real environment or private input was accessed. The119-owned085 fixture and integrated Next lab were not modified.

Actual five-file mounted baseline (`117-baseline-red.log`) produced10 meaningful failures and55 passing controls: three Quick Add names, unique Quick Add targets, inline amount name, two salary names, salary target isolation, and live/scenario percentage names. Existing action shape/rapid reset/read errors and mounted behavior controls passed. Initial sandbox-only Vite realpath EPERM produced zero executed tests and is not defect evidence; supported escalation ran the actual baseline, with no hook bypass. No product source edit preceded that real baseline.

Only five product files change native IDs/htmlFor/aria-labels plus salary useId. Existing values, numeric handlers, limits, toggles, save/reset/paste/pending/controller logic and checkbox IDs remain. Existing tests now prove label-click focus, multiple instance targets, optional category ID/ref/default behavior, exact inline saved payload, unchanged live deduction/settings payloads, isolated scenario percentage draft/save payload and disabled busy fields. README and comments were reviewed in scope; documented non-obvious pending/rapid-entry/invalid-feedback constraints remain, without claiming unrelated controls were audited.

Corrected focused verification passed116 tests across seven files (`117-targeted-final.log`), including existing048/110/116 and actual095 teardown workflow qualification. TypeScript passed (`117-typecheck.log`). These are synthetic mounted UI/cache/action-mock contracts, not actual auth/SQL/encryption/production proof. Full five gates, hooks, frozen independent review,119 integration and exact-head CI/merge remain required; no shipment or new performance claim.

Zero-warning scoped ESLint passed (117-scoped-lint.log). Scoped twelve-path formatting is checked before the managed-source hash freeze. Product/test source is frozen for independent review; full gates remain held for119.

## Linked119 closeout scope — recorded before edits

Root recorded external `117-linked-119-closeout-scope.md` before any linked metadata edits, adding the two ordinary document paths13–14. Final117 delivery inventory is fourteen paths; its label product/test contract stays exactly unchanged. At this recording boundary119 PR40 head3cc6acaddc4482fa7629e26f63361509eec79e54 has local gates/hooks passing and preview success, but CI/merge/public production verification remain pending. Do not mark119 shipped or populate its closeout until root provides verified exact merge evidence. Preserve the earlier twelve-path source freeze as historical.

After verified119 merge, normally integrate that exact main into117 without rewriting history; resolve README within both reviewed scopes, retain the label product/test bytes, sync the separate117 fixture, and run required full gates/normal hooks. No product/test scope expansion, feature approval, dependency, SQL, protected operation or additional metadata path follows from this record. Root retains delivery priority and merge verification.

## Exact119 integration boundary — 2026-10-11

Root verified PR40 merge496f637d3e4f19069b6a53183131242683449973 at2026-10-10T19:10:11Z and released117 local integration. A scoped stash preserves all original117 files and remains retained. Normal merge fast-forwarded117 from64e2dc9 to exact496f637; stash apply automatically combined README without conflict. Reviewed label product/test bytes were preserved exactly, then only tracked nonsecret integrated sources/configuration and placeholder `.env.example` were synchronized into117's isolated fixture. No history rewrite, reset, deletion or hook bypass occurred. Linked119 metadata records verified merge/checks/local hooks; its public production remains pending at this handoff. Fresh freeze/review and full gates follow before delivery.

Root subsequently verified119 public production SUCCESS updated2026-10-10T19:10:47Z; linked closeout records that result without any private authenticated workflow claim.117 source/test bytes stay unchanged. Integrated source uses119's unchanged neutral Query keys and actual OverviewPrefetch; no label-controller interaction change is introduced.

## Full local gates and isolated runtime qualification — 2026-10-11

Root and a second independent reviewer accepted the integrated fourteen-path source/diff before full gates. The retained check passed route logging, formatting, zero-warning lint and TypeScript (`117-full-check.log`). Full coverage passed144 files/1445 tests (`117-full-test-ci.log`), statements93.10%, branches89.11%, functions91.49%, lines93.81%, retaining every existing strict floor. Normal `pnpm build` passed after external runtime qualification (`117-full-build-isolated-closure.log`): Turbopack compiled8.8s, TypeScript10.9s and17 pages generated. These are synthetic local gates, not authenticated production, auth/RLS or whole-project accessibility proof. Exact-head CI and normal delivery hooks remain required;117 is not shipped.

Earlier build attempts failed on an external fixture boundary, first the090 dependency junction and then a stale090 path during PostCSS traversal. All failed logs are preserved. Root authorized materializing already-installed pinned public dependencies inside117, preserving the original junction, remapping only generated launcher/metadata fixture-name paths with exact backups and setting the public module-search path explicitly for synthetic subprocesses. Actual pnpm resolution qualified Next/PostCSS/Tailwind/Node/Oxide under117. Retained runtime junction/cache backups were moved outside the project under checked task-root paths; the subsequent fresh normal build passed. Tailwind automatic source scanning supports the retained-junction hypothesis, while the experiment proves only this fixture correction. No package implementation, project dependency/configuration, source behavior, protected file or existing hook was changed. The green check/coverage were retained instead of repeated during runtime-only diagnosis.

The exact generated Husky runners copied into the external117 fixture match the approved085 originals byte-for-byte. Existing tracked pre-commit/pre-push scripts remain unchanged and must run normally. All fourteen scoped files remain the only delivery paths; external runtime/proof artifacts are not product additions. The scoped stash remains retained.118 recovery and091 schema/dependency decisions remain pending their separate owner decisions.
