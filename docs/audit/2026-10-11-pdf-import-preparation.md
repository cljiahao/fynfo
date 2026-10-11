# PDF and import preparation — 2026-10-11

Status: preparation only; no implementation approval claimed.

## Authority and source boundary

The owner authorized this separate chat and worktree for concrete proposals and synthetic fixtures only. Inspected branch `prep/pdf-import-roadmap`, clean initial HEAD `b7a3f09590dcfc7d10d07fa5299dc15053f356ef`. Scope is this document and `docs/audit/pdf-import-fixtures/**`. No dependencies, migrations, schema, crypto, protected files, application code, pushes or merges. Parent-owned 129/130/131 and shipped 121/127/128 are untouched. No real env, credentials, cookies, PINs or financial records were accessed. No build, runtime tests or browser jobs were run.

Read AGENTS.md, CONSTITUTION.md, roadmap081, roadmap progress, specs001/022/079/091/092/103 and actual profile export, scenario, expense action/schema/parser and domain type source. Constitution §§2.1–2.4, 3, 4, 5, 6.3, 7.4 and 8 remain binding. Approval fields in existing drafts remain unchanged.

## What is shipped

`src/features/profile/lib/export-data.ts` exports plaintext JSON version **3**, app `fynfo`, ISO `exportedAt`, and nine personal domains: profile, snapshots, expenses, salary, taxReliefs, trades, dividends, plannerSettings, scenarios. Filename remains `fynfo-backup-YYYY-MM-DD.json` using UTC date. This is JSON export, not PDF export. No PDF report renderer exists in the inspected export path.

`use-export-data.ts` runs nine independent readers with Promise.all, suppresses overlapping invocation synchronously, avoids late download after unmount and releases anchor/object URL in finally. A failed domain prevents download. Snapshot export strips storage revision fields. Scenario export includes ID, creation request ID, revision and timestamps plus the encrypted-at-rest payload decrypted by `getScenarios`. Profile copy visibly names plaintext, household exclusion, lack of restore and concurrent-edit inconsistency. These are source observations and retained historical proof, not a fresh download or private persistence check.

The existing expense paste parser handles tab-separated text with real-date and positive-money qualification and explicit unsupported-credit issues. `upsertExpense` encrypts fields and uses `replace_expense_record` for one expense and splits. Per-record atomic replacement does not supply a cross-record import transaction, compare-save protection or durable import receipt. Scenario actions enforce a ten-record cap, payload size/finite-plan checks and revision guards.

No references to `pdfjs`, `import-review`, `restore_personal`, `personal_restore` or `get_personal_export` were found in inspected source/migrations/package.json. Spec079 and spec091 remain drafts. Historic022 removed server statement upload and its dependencies; the proposed local-only replacement does not reinstate that surface.

## Required correction to recovery proposal

091 describes version2/eight domains and predates shipped scenarios. Do not implement its old contract unchanged or overwrite its historical text/approval. A separately reviewed revision must cover version3/nine domains, scenario encryption, ten-record capacity, ID remapping and new revision initialization. Historical version1 has seven domains; version2 adds dividends; version3 adds scenarios. Legacy absence must be visible, never interpreted as complete coverage of current data.

The fixture contract below is a proposal, not an implemented validator. Current export construction itself performs no strict envelope validation. Existing ordinary domain schemas may transform values or allow unknown fields; importing through them alone does not prove lossless roundtrip.

## Proposed delivery batches

| Batch                            | Exact proposed scope                                                                                                                                                                                                         | Approval and release boundary                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: local JSON inspection         | New profile `lib/export-validation.ts`, public schema exports as needed, pure synthetic tests, README and scoped spec; no restore control or action                                                                          | Obtain scoped feature/spec selection first. Existing Zod only; no DB, crypto or dependency change. Reject unsupported files without writes.                                                                                  |
| 2: local PDF review without save | `src/features/import-review/{components,hooks,lib,types.ts,constants.ts,index.ts}`, expenses composition/barrel, synthetic tests, README; package.json, pnpm-lock.yaml, pnpm-workspace.yaml only for reviewed PDF dependency | Approve exact pinned dependency/optional footprint separately; then isolate installation and serialized verification. Start with constructed variant, no four-bank support claim.                                            |
| 3: selected expense save         | Review UI plus existing expense action adapter, per-row outcomes, own-record duplicate review and tests                                                                                                                      | Separate explicit selection. Stable per-row IDs for memory-only retries, re-read uncertain IDs before offering retry; concurrent edits/duplicates across sessions remain unproven. No claim of durable exactly-once imports. |
| 4: coherent personal export      | Revised091 B, profile feature action/decryption/validation, one owner-filtered STABLE invoker read RPC in one new additive migration, SQL security tests                                                                     | Scoped migration approval and disposable local replay; include all nine domains/children/scenarios. Owner applies production SQL before caller merge.                                                                        |
| 5: empty-vault restore           | Revised091 C, dedicated Profile review, server revalidation/encryption, atomic restore/status RPCs and receipt table with RLS/restricted grants                                                                              | Separate sensitive schema/security approval. No implementation in this preparation chat; no populated-vault merge/replace or key recovery.                                                                                   |

Recommended next implementation batch: **1**, versioned local inspection and fixture-driven strict validation. It resolves version drift without PDF dependencies or DB writes. Batch2 can follow scoped PDF approval independently of restore; batch3 must retain honest uncertain-save behavior. Batch5 waits for demonstrated transaction isolation/ownership/retry semantics, not merely complete frontend review.

## PDF dependency options and tradeoffs

| Option                                           | Benefit                                                            | Cost / decision                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Continue existing paste only                     | No dependency or attack surface expansion                          | No PDF rendering/provenance; cannot satisfy full079.                                                                         |
| PDF.js low-level browser API with bundled worker | Local text extraction and original-page rendering; best fit for079 | New dependency and resources; measure lazy route/worker transfer, memory and deadlines. Recommend subject to exact review.   |
| Browser native PDF embed plus manual paste       | No extraction library                                              | Inconsistent controls/provenance, no reliable text extraction, difficult page/row synchronization. Only a fallback proposal. |
| Remote/server parser or OCR                      | Could cover image-only documents                                   | Conflicts with local-only scope; excluded. Local OCR also introduces another dependency and is deferred.                     |

079 names `pdfjs-dist@6.4.299` and narrow omission of optional `@napi-rs/canvas`; its recorded metadata is historical, not freshly verified here. Registry URL access through web failed on2026-10-11. Before approval/install, recheck exact registry version/license/engines/integrity/transitive graph and advisories through primary sources, and inspect resolved lockfile changes. Do not substitute latest or claim vulnerability-free status. Browser workflow must use local resources, XFA off, no scripting/viewer/link/annotation activation, no obsolete `isEvalSupported` promise. PDF.js documents separate worker and browser builds; pnpm documents narrowly named optional omission. These support design choice, not exact-version security proof.

Sources checked: [PDF.js getting started](https://mozilla.github.io/pdf.js/getting_started/), [pnpm settings](https://pnpm.io/settings). Preserve existing `blockExoticSubdeps` and `allowBuilds`; no global optional omission or build-script relaxation. All package/config changes remain approval-gated.

## Format and validation contract

JSON: UTF-8, exact app, integer versions1/2/3 only, valid ISO export timestamp, required version-specific domain names, strict known fields. Version1 adapter explicitly adds empty dividends/scenarios with warnings; version2 adds empty scenarios with warning; version3 requires both. Reject future versions and missing current domains. Accept existing null profile/planner and empty arrays; reject secrets, auth IDs, household data or ciphertext fields. Do not infer file authenticity, owner binding or snapshot coherence from the envelope.

Validate actual calendar dates/months, finite domain amounts, enums/currencies, expense split allocations, duplicate month/relief identities and provided row IDs. Optional trade/dividend IDs must remain optional because exported types permit them; assign new identities at restore preparation, not during inspection. Preserve decimal values, source ordering and strings; distinguish permitted legacy values from current write constraints visibly, rather than silently coercing. Exact string/row limits require source/host measurements before approval;091's 10000 total rows,768KiB ciphertext and1MiB plaintext remain unmeasured proposed ceilings. Include children and scenarios in counts.

Scenario records: validate existing record metadata and schemaVersion1 payload/model/currency, maximum ten, payload <=8192 UTF-8 bytes and finite computed plan. Preserve payload/capturedAt/sourceSnapshotMonth on future restore. Remap scenario ID and creationRequestId, initialize new revision/timestamps under the deployed insertion contract; do not replay source concurrency tokens. Canonical equality compares scenario payloads and explicitly excludes remapped storage metadata. If historical timestamps must be retained, require a separately reviewed provenance format rather than silently overloading new storage timestamps.

PDF extraction output is distinct from Fynfo export: memory-only review candidates with source page/excerpt, original text/amount strings, statement period, transaction/posting dates separately, billed currency/amount versus original foreign currency/amount, classification, issues and editable fields. A candidate is not an ExpenseData until reviewed positive SGD expense with valid date/category. No refund sign flip, automatic FX conversion, credit/dividend double save or account-number persistence. Save date policy and statement-year rollover require explicit evidence; do not infer year from current clock.

## Minimalist review UI brief

Impeccable Shape/Operate guidance used for planning only; incumbent Profile card, dialog primitives and expense row editing are visual authority. Context discovery script skipped under established privacy constraint; no UI edited or skill installed. Household remains excluded from personal export/restore.

Use a dedicated statement-review surface: desktop source page and editable rows side by side; mobile named Statement/Extracted tabs retain edits/selection. Source descriptions remain accessible after merchant renaming. Primary action is explicit Save selected, with ready/excluded/unresolved/possible-duplicate counts. File locality, ambiguity, field errors, selection state and each save outcome stay visible; optional provenance details use a named disclosure. Keyboard page/row controls, native labels and focus restoration are required. No auto-save on extraction or navigation.

Restore is a separate Profile task: plaintext warning, nine domain counts, legacy omissions, signed-in target confirmation and empty-target restriction precede confirmation. A missing reply is uncertain, not success/rollback. Lock, signout, replace-file, cancel and navigation clear sensitive memory/URLs/workers; close during a pending save cannot imply write cancellation. Review states include corrupt, image-only, unsupported layout, password required/unsupported, capacity, worker timeout, stale context, invalid rows, empty selection, duplicate, saving, partial confirmed outcomes and uncertain transport.

## Acceptance and honest blockers

- Pure fixture assertions: versions/required domains, malformed JSON, unknown fields, invalid calendar/amount/split, duplicate identity, scenario capacity/size and no silent transforms. All invalid inputs cause zero writes. Fixtures are constructed expectations, not evidence a parser already passes.
- PDF binary fixture stage after approved dependency:10MiB/100page boundaries, bounded text/rendered pixels, worker deadline and active-page rendering; corrupt/password/image-only/XFA/oversize cases. Construct actual PDFs and verify original page text matches extraction. Current text fixtures do not prove PDF layout extraction or bank support.
- Bank adapter stage: individually named constructed UOB/DBS/Citi/HSBC-inspired variants, wrapped descriptions, multi-page headings, rollover, foreign/billed columns, credits/refunds/transfers/repayments, repeated same-date/amount purchases. Only documented tested variants receive support labels.
- Browser/network inspection: no file/password/unselected text leaves device or reaches logs/analytics/storage; local resource request graph; keyboard/mobile/provenance/edit/cancel/lock/timeout cleanup; selected save fields only through auth→vault→existing encrypted mutation boundaries.
- Future restore: nine-domain canonical roundtrip in disposable synthetic DB with unchanged crypto, same/fresh target keys; role/owner negatives, domain failure rollback, lost reply/status, identical replay/conflicting replay, two restores and concurrent ordinary writes. Verify PostgREST isolation before promising atomic empty-target semantics. Include scenario capacity/default-profile/planner empty checks.
- Preserve aggregate >80% and all incumbent stricter security floors, including vault route81% each metric; unchanged hooks/check/test:ci/build, independent second review and exact-head greenCI. Coordinate heavy gates with parent; no checks claimed here beyond source/diff/fixture syntax inspection.

Outstanding: dependency exact metadata/security/lockfile footprint, measured request/resource bounds, real PDF binary/layout proof, bank-variant evidence, durable import identity/concurrent-edit decision, revised091 nine-domain SQL/security contract, transaction isolation local proof and owner migration approval. Plaintext portability does not recover forgotten-PIN ciphertext or household keys. No confidential statement samples are needed.

Preparation rollback: remove only the newly added preparation document/fixtures. No data or application behavior has changed. No commit/push/merge or shipped claim is made.

## Preparation checks

PowerShell parsed all three JSON files successfully, enumerated the expected nine export domains and checked every statement expectation's page/line reference against its constructed source. Git status showed only this new document and the new fixture directory; branch and HEAD remained unchanged. `git diff --check` reported no tracked diff errors, but newly untracked files are not covered by that command. No format:check, application tests, build or browser inspection ran. No exact PDF registry metadata or dependency security verification is claimed from the failed registry fetch.

## Subsequent owner selection and confirmation sweep

The earlier preparation-only statements describe that completed stage. The owner subsequently requested a confirmation sweep and explicitly selected local JSON validation/review, with no writes or new dependencies. Spec132 records that approval and exact paths before application edits. Existing079/091 approvals, original export behavior, parent worktrees and source HEAD remain unchanged.

The second source sweep identified duplicate JSON member ambiguity, transformation risks from write schemas, malformed UTF-8 substitution, stale async read disclosure, scenario metadata/version drift and the difference between review/device bounds and future restore/host capacity. Implementation rejects duplicate members (including escaped names), uses non-transforming strict contracts and fatal UTF-8 decoding, returns only counts/timestamp/legacy warnings, and invalidates replaced/cleared/unmounted reads. Invalid/unsupported historical values fail visibly rather than silently becoming current-write-compatible data. No runnable-scenario, authenticity, ownership, coherent backup or recoverability guarantee is made by format qualification.

The Profile export card now includes inline local review with native labeling, reading/error/summary/clear states and visible limitations. Existing JSON export hook/lib/actions/filename/version are untouched. No file content, rows or names enter result state, logs, storage, server actions or query caches. Transient browser memory may remain until garbage collection; no secure-erasure or physical read-cancellation claim.

Focused synthetic verification passed four Profile suites /83 tests, including unchanged export regressions, after tooling-only Windows filesystem and ESM resolution failures were corrected. Strict UTF-8 was found and fixed during the second source review, with its own regression. Scoped TypeScript verification over the new code/tests and imported UI dependencies passed with zero diagnostics. Scoped ESLint passed with zero rule findings. Matching existing installed Zod4.3.6/React19.2.5/Vitest4.1.7/TypeScript5.9.3/Prettier3.8.2/ESLint9.39.4/jsdom29.1.1 packages were read from the existing installation; no package installation, dependency/config changes or other-checkout edits occurred. Synthetic tests used an empty env directory and supported sandbox escalation after Windows denied filesystem resolution; no automatic-review rejection or hook bypass occurred.

The first whole-source custom type resolver failed because it did not preserve transitive package declaration resolution; that tooling failure is not a product defect or a full-project typecheck result. The corrected scoped compiler preserves standard resolution first and supplies the external dependency fallback only when needed. No full coverage report, normal pnpm check/test:ci/build, hooks, CI, actual browser network/mobile/visual proof, commit, push or merge is claimed. Heavy verification remains deferred while the other session owns serialized verification; keep132 unshipped until those release checks pass on the integrated source. PDF dependencies and restore migrations remain separately unapproved.

## Approved PDF implementation and second review

The owner subsequently confirmed local expense extraction/review for all four
banks, requested completion and explicitly approved the exact pinned6.4.299
dependency footprint recorded in spec133. That approval supersedes the historical
PDF dependency blocker above. Installation preserved all existing dependency
versions and hook/build restrictions. The lock adds only PDF.js and its exact
integrity, with the single named optional canvas omission; no native canvas was
installed. No migration or financial write is authorized or implemented.

The new import-review feature is composed into Expenses. PDF bytes remain in the
browser; a dedicated local worker reconstructs positioned text and renders only
the selected source page with annotations disabled. Bounded byte/page/text/item/
pixel/time limits, explicit period validation, conservative SGD qualification,
credit/transfer exclusions, duplicate warnings and visible source provenance
prevent uncertain rows from becoming silently accepted expense suggestions.
Unsaved draft edits stay beside the original page. Clear/replacement/close
destroys worker/document/rendering and rejects late results. Existing VaultGate
unmounts the protected subtree on lock/identity invalidation, applying this same
cleanup path without changing auth or crypto code.

The separate second source pass found and corrected PDFWorker constructor typing
by using its typed create API, mobile pagination wrapping and unsafe decimal
truncation. Extra decimals, debit suffixes and amounts beyond safe cent precision
now remain unresolved. Tests cover these findings plus size-before-read, late
read/extraction results, clear/close, source navigation, drafts, resource bounds,
password refusal and stalled-open cleanup. Constructor/worker resources are
same-origin only; no viewer/scripting/link layer or statement POST is introduced.
Dynamic dependency loading is absent from the server rendering path.

Actual existing Edge browser verification used an isolated synthetic React page
with existing Vite/Tailwind tools and no account/env/session access. All four
constructed binary PDFs passed extraction, expected amounts/classification,
source provenance and real worker page rendering. Desktop and390px mobile
layouts were visually inspected; edits survived mobile view switching, dialog
overflow checks passed and Escape restored focus after the close animation.
The observed graph contained37 local GETs, no uploads and no page errors.
Early harness failures were tooling adapter/browser availability issues; two
premature focus/pixel assertions were corrected to await completed transitions/
rendering. The final browser pass succeeded after the money parsing correction.

Normal `pnpm check` passed unchanged route checks, whole-project formatting,
zero-warning ESLint and TypeScript. Generated copied PDF vendor assets are ignored
by owned-source formatting/linting, matching their Git generated-output treatment;
application rules/floors/hooks are unchanged. Parent was observed idle before
sequential heavy gates. Full coverage/build results are recorded below when
complete. No push, merge, deployment, CI result or real-bank-layout qualification
is claimed. Support remains bounded to constructed variants; protected/image-only,
other real layouts and an adversarial/XFA corpus remain unqualified.

### Final local gates

`pnpm test:ci` passed149 suites /1574 tests in285.06seconds. Unchanged global and
per-file security floors passed: statements93.71%, branches89.76%,
functions91.65%, lines94.38%. The PDF loader's unit line coverage is70/71,
parser94/98 and review103/116; this is synthetic branch/lifecycle evidence,
not hostile-document or real-bank qualification. `pnpm build` passed production
compilation, TypeScript and all17 generated routes with explicit synthetic
public Supabase placeholders and telemetry disabled. No private env file was
read. The generated worker's SHA256 matched the installed pinned distribution.

Supplemental `node scripts/verify-harness.mjs` reported two pre-existing manifest
hash mismatches: `AGENTS.md` and `.claude/skills/next-verify/SKILL.md`. Both paths
and the manifest have no worktree diff from HEAD; no protected file was edited or
re-blessed. This additional integrity discrepancy remains for human review and
the existing harness regeneration procedure. It does not invalidate the passing
application checks, but must not be described as a green harness integrity result.

The final source remains in the isolated preparation branch, uncommitted and
unmerged. Specs132/133 stay approved rather than shipped; no PR, CI, deployment,
financial write or universal bank support is claimed. Temporary browser harness
and rendered QA scratch files were removed from this worktree after inspection;
the synthetic binary fixtures and executable unit/component regressions remain.

### Delivery closeout (2026-10-12, Singapore)

The owner explicitly authorized implementation, PR and merge once clean. The
feature and binary fixture portability correction passed active commit hooks and
the complete pre-push build/check/test sequence again:149 suites /1574 tests,
94.38% line coverage and unchanged security floors. PR49 passed all GitHub CI
and Vercel preview checks and merged as
`d2324ff4d7f8c6a4445885267538f7c39012b155`. Specs132/133 are now marked shipped
with that PR link. Earlier uncommitted/unmerged/local-only-gate statements above
describe their dated preparation stages; they are superseded by this delivery
record. No real-bank qualification, save/restore workflow, protected harness
reconciliation or independently verified production deployment is claimed.
