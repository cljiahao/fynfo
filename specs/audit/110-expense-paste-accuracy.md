---
id: '110'
slug: expense-paste-accuracy
area: fix
status: shipped
author: Codex
created: 2026-10-10
approved:
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/36
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§3.4'
  - '§4.2'
  - '§7.4'
constitution_overrides: []
---

# Audit 110: Expense paste accuracy and truthful save outcomes

## Authorization and preparation boundary

Owner-authorized ordinary remediation under Constitution §7.4 and the existing audit direction. Root reviewed the concrete contract and authorized implementation on 2026-10-10 after PR35 merged. Branch `impl/110-expense-paste-accuracy` starts from verified main `c8714072d1ccd2b5630646439cf7a200bd511fbd`; the prior 108 branch is retained. Draft status and blank approval record ordinary audit authorization, not self-approval of a new feature. No dependency, migration, crypto or protected-file change is authorized.

Shipped 048's historical approval and its immediate reset/rapid-entry tradeoff remain unchanged. This later audit refines calendar/money accuracy and submitted-versus-settled wording; it does not rewrite048's approved text/hash.081 authorizes scoped continuation, while079's local PDF feature/dependency proposal remains separately unapproved. This is not the owner's final integrated whole-project confirmation sweep.

## Problem

Spreadsheet paste can silently move an impossible expense date or truncate malformed money before the server sees it. The actual merged parser normalizes2026-02-30 into2026-03-02, interprets10.20 as a date, accepts1.2.3 as1.2 and accepts400 digits as Infinity. Invalid pasted fields can then fall back to a prefilled date/positive amount and auto-save a different positive expense. Multi-row paste announces all dispatched rows as added before writes settle, even when one subsequently rolls back. These are current-flow correctness defects; a new bank import or ledger is unnecessary to fix them.

## Evidence and baseline

Reviewed baseline `ee6e001957f1bb62a2e64479c00765cfc7e32396` using scoped tracked-source reads and full AGENTS/CONSTITUTION. Actual pure parser was transpiled in memory with installed fixture TypeScript/date-fns, using generated strings only. No private statement, credential, production database or new dependency was used.

External evidence: `110-expense-import-contract-review.md` SHA256 `036334b2bd5bb0768540f3a403d30de9ff84e05883f61b7b611b89faa4529539`; `110-expense-paste-synthetic-proof.json` SHA256 `9b5c8171d8fbfee322f6250f814614cb82f0fc74f6fc347e45bb2033bc877cd1`. Both reside beside this draft. Git parser SHA256 `6e7605f316a0a0da344656bc612e084fa011fc5126adbcbe2767fcab6cf1f7d8`. Recheck baseline integration after 108 merges before implementation; preserve this historical evidence.

- `src/features/expenses/lib/paste-parser.ts:8–23,75–95`: native Date rollover/arbitrary date heuristic precedes loose partial parseFloat money; no finite qualification.
- `src/features/expenses/components/expense-quick-add.tsx:69–97`: missing parsed fields merge with existing form state before auto-save. Explicit negative money currently becomes unmatched notes, so a prefilled positive amount can be reused. This UI consequence is source-derived and requires mounted regression proof.
- `expense-quick-add.tsx:119–140`: per-row promises run in background, while synchronous accepted counts are announced as added.
- `test/features/expenses/expense-workflows.test.tsx:294–314`: actual hook/query cache test expects2 added while one rejected row rolls back, leaving one persisted-result optimistic row.
- `test/features/expenses/paste-parser.test.ts:8–19,47–68`: valid dates/grouped money covered; rollover, numeric-date confusion and malformed/non-finite money absent.
- `schemas.ts:18–30` and `expense-calendar-dates.test.ts:42`: strict server boundary already rejects impossible original dates and non-finite money, but cannot recover an original token already transformed into a valid different value.

## Constitution check

- §2.1/§2.2/§2.3: reuse existing authenticated/vault-guarded encrypted expense actions; no new financial storage, plaintext backend path, browser persistence, API or action. No logs containing pasted text or amounts.
- §3.4: existing kebab-case feature modules and named exports retained; no additional client boundary or primitive.
- §4.2: reproduce the real defects with meaningful parser and mounted actual-hook/query regressions, rather than a test mirroring helper implementation.
- §7.4 and AGENTS §1.5: scoped ordinary accuracy remediation, README/comment review, independent second pass, complete gates before delivery. No HARD override, dependency, SQL/schema, crypto protocol or permission-protected edit is authorized.

## Source inventory and exact write scope

Exactly eight paths may change: the two product paths, existing expenses/constants.ts for static date/money grammar data, three existing test paths, README and this audit record. Static grammar/constants remain feature-owned.

| Path                                                     | Purpose and actual consumer                                                       | Proposed change                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/features/expenses/lib/paste-parser.ts`              | Pure tabbed quick-add parsing; consumed by Quick Add and parser tests             | Explicit calendar-safe date grammar; complete finite positive money; optional invalid-field issues               |
| `src/features/expenses/components/expense-quick-add.tsx` | Existing expense paste/manual form; consumes parser and existing useUpsertExpense | Visible invalid paste feedback before stale fallback; per-paste settled result summary, immediate reset retained |
| `test/features/expenses/paste-parser.test.ts`            | Existing parser boundary regression suite                                         | Reproduced invalid cases and valid-format compatibility                                                          |
| `test/features/expenses/expense-workflows.test.tsx`      | Mounted Quick Add/table with real mutation hooks/QueryClient; actions only mocked | Deferred settlement/rollback/overlap and stale-field invalid-paste regressions                                   |
| `test/features/expenses/expense-quick-add.test.tsx`      | Existing immediate-reset/incomplete-entry tests                                   | Preserve reset/rapid-entry compatibility and visible invalid-paste behavior where useful                         |
| `src/features/expenses/constants.ts`                     | Existing feature-owned static values                                              | Add explicit month names and date/money grammars                                                                 |
| `README.md`                                              | Current expense calendar/action/operational contracts                             | Explain strict paste parsing and submitted-versus-confirmed outcomes without import/dedupe guarantees            |
| `specs/audit/110-expense-paste-accuracy.md`              | Ordinary scoped audit, evidence, verification and delivery history                | Record root authorization, exact paths, checks/review/limitations; mark shipped only after merge                 |

Read-only consumers used to bound behavior: expense types/schema/constants/lib/utils; expense actions and optimistic hooks; table/editable row; chart, asset salary-plan, monthly-review and profile export; historical048/077/022, draft079,081; initial/atomic replacement migrations. Their purpose is preserving existing positive expense/ID/split/aggregate semantics. They are not write scope. No speculative abstraction, new file/module, bank adapter or replacement mutation layer is needed. If implementation requires a path outside this table, stop that extension and bring evidence to root before editing.

## Solution shape

### Explicit date and complete money qualification

Keep the parser's current content-based spreadsheet convenience while accepting dates only from recognized date-shaped grammars. Preserve valid ISO with the current supported single/two-digit month/day normalization, SG day/month/year, unambiguous US month/day/year (`04/27/2026`), and explicit English named-month forms (`Apr 7, 2026`, `7 Apr 2026`, with April/Apr and supported comma variants). Build the canonical YYYY-MM-DD string from explicit year/month/day components and qualify the exact calendar date. Avoid new Date plus local format, which can introduce timezone day shifts; no UTC/local instant is needed to represent the selected spending day. Valid leap days remain valid. Ambiguous slash dates retain SG preference. A failed SG calendar literal must not silently switch interpretation; use US only where the second component exceeds12 and the first component is a valid month1..12, then independently qualify its literal calendar day. Arbitrary numeric tokens such as10.20/12.00/2026 must never become dates. No arbitrary Date(s) fallback outside the supported date grammars.

Accept complete unsigned positive finite decimal money tokens, preserving valid ungrouped numbers and correctly grouped thousands such as `$1,200.50`; optional existing dollar marker and harmless surrounding whitespace remain supported. Preserve the existing accepted fractional form `.50` and complete trailing-decimal forms where covered by baseline controls. Qualification uses the full money grammar and Number.isFinite after conversion; zero is invalid for this positive-expense flow and must not fall back to a stale positive amount. Consume the full token; reject repeated decimal separators, bad comma grouping and non-finite overflow. Do not introduce a new decimal precision cap, rounding operation or currency/account inference. Existing selected first valid amount behavior is not a bank-column mapping guarantee. Explicit negative or credit-marker amount candidates are unsupported for this positive expense flow, never absolute-valued. Ordinary merchant/note text is not automatically an invalid financial field merely because it cannot parse.

### Optional invalid-field issues before fallback

Retain current ParsedRow fields `date/type/item/info/amount`, adding optional `issues` only when recognized financial candidates are invalid or unsupported. Proposed exact local issue contract: `issues?: Array<{ field: 'date'; code: 'INVALID_DATE' } | { field: 'amount'; code: 'INVALID_AMOUNT' | 'UNSUPPORTED_CREDIT' }>` inside the existing parser file. It contains no raw statement/token and does not alter ExpenseData. Valid current rows omit the issues property, preserving existing object fixtures. Root reviews this representation before edits; no new public barrel/action/schema contract is needed.

Recognized date-shaped impossible tokens, numeric/currency-shaped malformed/non-finite tokens and explicit signed-negative/credit amount candidates must retain an issue instead of disappearing into unmatched item/info. Any such issue prevents single-row auto-save before existing-field fallback and excludes a multi-row candidate from writes. Show concise visible invalid/unsupported feedback, not a hidden tooltip or a success claim. The user can correct retained form values and explicitly submit under the existing positive expense validation. Do not automatically carry the invalid raw token into a saved amount/date or leak it in logs.

Genuinely omitted fields preserve current fallback semantics. A row with a valid amount but no date may use the selected current date under the existing single-row convenience; ordinary unmatched item/notes remain useful. An actually omitted amount may retain a deliberately typed existing amount. Header-only rows still return no usable values and trigger no save. Valid complete single-row paste keeps existing auto-submit; valid incomplete paste remains editable. Visible invalid-field state must clear predictably on a fresh valid paste or explicit correction, without silently auto-submitting the invalid paste while an older field remains present.

### Truthful per-paste completion

Preserve immediate form reset and optimistic rows for accepted single/multiple entries. Keep independent Enter submissions usable while earlier writes are pending, as 048 requires. Do not gate the whole form on one mutation's isPending or restore an old failed entry into a newer draft. Keep existing manual/single-row success callbacks dependent on their own resolved promise.

For each multi-row paste, capture its own accepted-row promises and synchronous skipped/invalid count. Optional immediate notification describes submission/pending, never already-saved count. Once that paste's promises settle, report confirmed saves from successful resolutions and unsuccessful/unconfirmed results from rejected promises, plus skipped rows. With zero confirmed saves, do not show a saved-success notification. Overlapping pastes and reverse-order settlement must not share counters or rely on the last mutation observer's status. Use existing actual hook rollback unchanged. Consolidate batch failure notification if aggregating; avoid duplicating the same failures in per-row and aggregate messages. No batch atomicity is promised.

A rejected transport may leave persistence uncertain; wording must not guarantee that no database write occurred. Existing rollback means the optimistic row is removed from this list, not a durable absence certificate. No automatic replay, retained receipt, deterministic ID or exactly-once claim is introduced. Repeated identical paste still produces fresh expense IDs; intentional equal expenses must not be silently collapsed. Duplicate detection remains separate roadmap L work.

### Comments and documentation

Review comments in the two changed product files: retain the quick-add reset/optimistic contract and necessary grammar/SG ambiguity constraints; update narration that accepted rows are already added before settlement. README distinguishes current spreadsheet paste from the unimplemented PDF review/backup restore workflows, and records positive-expense-only parsing plus honest pending/confirmed/uncertain outcomes. Preserve historical approved specs and existing action/storage/coverage contracts.

## Out of scope

PDF extraction/worker, bank adapters, review preview/Save Selected UI, classification ledger, signed expense persistence, refund links, transfers, card repayments, currency/accounts, merchant rules, import metadata/receipts/duplicate matching, durable retries, CAS, new dependencies, SQL migrations/RLS/grants/crypto, exports, action/hook changes, global pending-entry blockade, UI primitive changes, protected files and whole-project completion certification.079 dependency approval and109 salary CAS approval are separate. No real statements or live financial fixtures.

## Acceptance

- [ ] Refresh current merged baseline after 108; record the exact eleven scoped paths before implementation and synchronize only tracked nonsecret files into the isolated fixture.
- [ ] Pure parser regressions reject2026-02-30,31/04/2026, nonleap29/02, malformed `$1,2.3`,1.2.3,1,2.50 and non-finite400-digit money; a rejected token cannot normalize into a different valid field.10.20 and12.00 parse as amounts, not dates;2026 remains money when applicable.
- [ ] Compatibility preserves valid ISO, SG07/04/2026, unambiguous US04/27/2026, Apr7/7Apr named dates, valid leap day and `$1,200.50`/`.50`, full English month and comma compatibility; no new precision/rounding rule or timezone day shift.
- [ ] Mounted actual-hook QueryClientProvider tests with prefilled date/positive amount: explicit invalid calendar, malformed/non-finite money and unsupported negative/credit-style tokens show visible feedback and cause zero stale-field saves. Ordinary omitted date/amount retains intended fallback; header-only causes zero saves; incomplete valid entry remains editable.
- [ ] Deferred actual mutation promises prove no “saved/added” confirmation before settlement; all-success, partial-failure and all-failure outcomes report exact confirmed/unconfirmed/skipped counts. Existing optimistic insert/rollback is verified in cache, not merely a mocked hook callback.
- [ ] Two overlapping pastes settle in reverse order: each summary owns its promises; a late failure never replaces a newly typed form; immediate reset and rapid independent Enter entry remain intact. Repeated identical inputs are not silently collapsed and no durable dedupe is claimed.
- [ ] Single valid paste/manual submit resets immediately, while its success waits for its own promise; no callback replacement loses an earlier failure when a later entry succeeds. Keep existing048 compatibility tests.
- [ ] Synthetic browser proof of valid paste, visible invalid paste with prefilled fields, mixed batch results, immediate reset/keyboard entry and responsive feedback; no private data or raw file upload.
- [ ] Read changed README/comments and record independent fresh source/test review; resolve concrete findings and identify residual unknown-write/dedupe limits.
- [ ] All existing `pnpm format:check`, `pnpm lint` (max-warnings 0), `pnpm typecheck`, `pnpm test:ci` and `pnpm build` pass; existing aggregate metrics remain above 80% and stricter security floors unchanged. No heavy job before root's coordinated slot.
- [ ] Normal hooks, commit/push, exact-head CI/deployment and root-coordinated PR delivery; no hook bypass. Audit hash/history and scoped paths are reviewable; mark shipped only after merge.

## Risk & reversibility

- Blast radius: current quick-add parsing and notifications only. Stricter recognition can accidentally reject legitimate formatted text or falsely classify merchant text as invalid; valid-format/omitted-field fixtures and mounted checks are required. Existing Date parsing is runtime-dependent, so explicit grammar and calendar qualification must replace that dependency, not merely add one rollover example.
- Other risks: a final aggregate can accidentally count another paste's promises, emit duplicate notices, or lose an earlier rejection through shared observer callbacks. Exercise overlapping deferred saves with the real hook and cache. Keep immediate reset and avoid stale completion restoring fields.
- Reversibility: ordinary Git revert of this single scoped batch; no data/schema migration or destructive SQL needed. Existing rows remain untouched by deployment; rollback restores prior parser/notification behavior and its known defects.
- Backout: root coordinates normal revert, complete applicable gates and green CI; preserve audit evidence, historical approvals and residual defect descriptions. No reset/force push or secret/protected change.

## Open questions and decisions

- Resolved by root 2026-10-10: ordinary paste remediation is the smallest next batch; PR35 merged before branch creation; root reviewed and recorded this scope before application edits.
- Resolved: preserve048 immediate reset, unblocked independent Enter and historical approval/hash; refine submitted-versus-settled wording without rewriting history.
- Resolved: supported omitted fields keep current fallback; explicit invalid financial candidates must visibly block auto-save; valid complete single-row auto-submit remains.
- Resolved before edits: root reviewed the optional issue representation and supported grammar against existing fixtures. This is local parser accuracy, not a bank adapter or new financial model.
- No schema/dependency question blocks this ordinary batch. Future truthful refund/transfer/repayment storage and durable import identity need a separately reviewable contract and owner approval; remain explicitly unresolved.

## Implementation and verification record

Historical external preparation before implementation: no executable work or gates had occurred at that stage. Implementation is now authorized and the actual evidence follows below. Append actual authorized implementation paths/decisions, regression results, independent review, full gates and exact delivery evidence here after root records the batch. Do not claim exhaustive security review, roadmap completion or durable import idempotency.

## Root contract refinement before application edits

The eighth scoped path is `src/features/expenses/constants.ts` for static month and grammar constants. Invalid date or amount issues block automatic and manual Enter/Add until the affected field is explicitly corrected or a fresh valid paste clears the issue; omitted fields retain fallback. All asynchronous notification callbacks are instance-lifetime guarded: unmount or the actual 095 identity/vault teardown suppresses late toasts while consuming promise outcomes. Multi-row counts are per-paste settled confirmed/unconfirmed/skipped outcomes, without a durable absence or exactly-once guarantee.

## Linked ordinary documentation integration

Root authorized recording the already merged PR35 closeout alongside this batch on 2026-10-10, avoiding another independent hook cycle. Exact additional documentation paths are `specs/fix/108-overview-read-cohorts.md`, `specs/feature/081-sequential-delivery-roadmap.md`, and `docs/audit/2026-10-09-roadmap-progress.md`. Final scope is eleven paths (eight current-remediation paths plus three linked ordinary delivery records). Root confirmed the reviewed donor was ready; all three files were copied with identical source/destination SHA256. Historical approvals are unchanged; this is merged metadata, not a protected governance edit.

### Implemented scoped verification so far

- Baseline parser and actual-hook tests reproduced 16 failures (28 existing passes), including rollover/numeric-date confusion, partial/nonfinite money, stale fallback/manual submission and premature confirmation. `110-red-baseline.log` retains the evidence. Five additional malformed explicit-currency/nondecimal candidate regressions failed before that refinement (`110-money-candidate-red.log`).
- Initial expanded focused suites passed 85 tests across the three recorded existing files (`110-focused-final.log`); targeted TypeScript passes (`110-targeted-typecheck.log`). Real hook/QueryClient tests cover overlap, rollback, stale field blocking/correction, omitted/header behavior, rapid keyboard entry and actual 095 vault identity replacement/unmount suppressing old notifications.
- A test-only mock tuple assertion was corrected with meaningful nth-call assertions. The realistic rapid-entry test selects the refocused category before the next Enter; no production keyboard behavior was changed. Existing pending Add-click guard is retained.
- An ordinary sandbox pnpm invocation failed runtime realpath resolution and attempted dependency-status repair, which failed before installation. Supported escalated execution then used the same pinned installed dependencies. No dependency or lockfile change occurred.
- Impeccable harden/clarify and craft-floor guidance was reviewed for this narrow Operate refinement: keep incumbent tokens/layout, make errors visible and associate them with affected controls; do not redesign the form. TemplateCentral/frontend-design plugin skills remain unavailable and are not claimed as invoked. Fynfo governance/comment conventions remain authoritative.
- External synthetic browser scope: actual Quick Add, parser and mutation/cache hooks from the frozen fixture, real Sonner notifications, generated deferred action adapters only. Loopback port 4314; no authentication, raw statement, persistent storage or production verification. Public fixture controls and DOM metadata permit valid/invalid/mixed settlement and unmount observations. Existing compiled style artifact is reused; layout/behavior proof is qualified separately from the final production build.

- Independent review reproduced an introduced numeric merchant/reference false positive (7-11 and 123-456); both controls failed before correction in `110-merchant-red.log`. The narrowed candidate preserves internal-hyphen merchant/reference text while signed and parenthesized amounts remain unsupported. Three common Sept date aliases also failed before correction (`110-sept-red.log`) and now remain compatible. Final focused/types/lint evidence follows below.

### Final source and synthetic browser qualification

The final focused suites passed 94 tests across three files, with targeted typecheck and scoped lint passing. Six implementation/test SHA256 values are frozen in `110-frozen-source.json` (manifest SHA256 `615a9b49be26512cc5154b5f2d2e4b7645e2c8364c7df81e4d65ab018b662138`); root independently checked the managed tree and actual fixture. Source is unchanged during the final full gates.

Independent source/test/document review passed after closing the merchant/reference and Sept compatibility findings. `110-independent-final-review.md` SHA256 `4a233c1f0f9c16087eaf1b163e161c867dcea3469de832b849821b57f46deae2` and `110-independent-review-hashes.json` SHA256 `4ba358fa7f6383ed13198e79c58181c1b1c0c0e4099a29b144ce82dad90296d3` retain the bounded review. No reviewer ran production/private workflows or approved a merge.

Root qualified the actual frozen form/hooks using loopback generated deferred actions and real clipboard Control+V. Valid paste auto-submitted/reset without an early saved notice; impossible February dates and malformed decimals blocked Enter/Add despite prefilled positive fields. Correcting the affected amount restored submission; two rapid keyboard entries remained usable while the existing Add click guard stayed pending. A mixed batch reported one confirmed, one unconfirmed and one skipped after settlement, with the failed optimistic row removed. Numeric merchant `7-11` stayed valid, credit-marker input remained blocked, and a fresh valid paste cleared issues. Unmount before a late rejected promise produced no immediate accessibility-tree toast.

Browser evidence: `110-browser-workflows.json` SHA256 `5a4acd217272ded0983d41a531f9aedbcce6b67038ddc5b7ba2214d925c2d010`; inspected `110-credit-desktop.png` and `110-credit-mobile-final.png`. The final mobile form measured 327 px and the document 375 px within the reported 390 px viewport, with readable feedback. Initial overflow came from external diagnostic preformatted output and was corrected only in fixture CSS. Later transient toast arrays often expired; explicit immediate observations are evidence, not a claim that every empty later array proves lifetime safety. Mounted tests separately prove consumed late outcomes and actual 095 identity teardown. The fixture is UI/cache/notification proof, not authenticated database durability, bank parsing, complete screenshot coverage or production verification.

The owned preview server was stopped, browser tab closed and viewport reset. No private app/session, statement, persistent fixture data, credentials or new package was used. No universal speed or exactly-once guarantee is added by this accuracy batch. Final full gates and normal delivery results follow below.

### Complete local gates

All five required gates passed serially with synthetic configuration and unchanged floors: route checks, Prettier, zero-warning ESLint and TypeScript (`110-check.log`), full coverage (`110-test-ci.log`) and the production Next.js 16.3.8 Turbopack build (`110-build.log`). Coverage ran 141 test files and 1,342 tests: 93.08% statements, 89.29% branches, 91.24% functions and 93.62% lines. Existing stricter security thresholds passed. Each gate exit code was checked before the next command; the overall sequence exited 0.

The final browser, independent review and full gates accepted the same frozen six implementation/test hashes. Only evidence/documentation recording changed afterward; normal scoped formatting/diff checks and unchanged commit/push hooks follow. PR36 merged exact head `81696acfd6b16b163e08d5f683f6173e7e38a940` on 2026-10-10 at 15:45:25 UTC as `5c19555ddbcf448dfc41cd5f70d3c6a1da4ddb2c`, after required CI run 38064677924 and Vercel preview success. Root also verified the merged commit public Vercel production deployment status is successful. No roadmap completion or private-account verification is claimed.
