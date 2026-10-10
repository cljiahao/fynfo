# Approved roadmap progress — 2026-10-09

Owner approved the confirmation review's features/improvements and delegated
routine decisions. Implementation scope and conversational authorization are
recorded in spec072. The continuation heartbeat `continue-fynfo-improvements`
runs in this chat hourly while the local machine and app are available. Stop it
when the roadmap is completed; do not use it to bypass pending scoped approvals.

| Work                                                                        | Status                                           | Next verification or dependency                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-time/returning vault distinction, confirmed creation, truthful stages | Merged/deployed in PR7                           | Existing race-safe POST remains authoritative; authenticated no-store metadata exposes only initialized state                                                          |
| Skippable first-record prompt and optional reserve disclosure               | Merged/deployed in PR7                           | Synthetic dismiss/remount, collapsed controls and existing workflow regressions                                                                                        |
| Profile readiness and opaque optional-read failures                         | Merged/deployed in PR7                           | New failed-read tests proved red against prior profile/planner actions; missing rows remain null                                                                       |
| Monthly financial review with sources and exact-month asset comparison      | Merged/deployed in PR7                           | Gross income explicitly before CPF/tax; no inferred savings rate; impossible shared splits hide spending total                                                         |
| Complete histories and export reads                                         | Flat and nested merged in PR9/PR10               | Separate parent/child pages; bounded household ID filters; fixtures over1000rows; point-in-time backup remains pending                                                 |
| Atomic saves, concurrent edit conflicts, retry idempotency                  | Draft spec077; approval pending                  | Snapshot/expense/relief child replacement needs transaction and revision contract; scoped migration approval before executable migration changes                       |
| Quote/FX availability and financial rule accuracy                           | Pending                                          | Price currency/date and source status, mixed-currency cost basis and official tax/CPF fixtures; no silent defaults or advice                                           |
| Dashboard latency measurement/aggregation                                   | Pending                                          | Unlock-to-ready request/decryption timings using synthetic fixtures; no production speed claim from reduced rendering work alone                                       |
| Synthetic browser workflows                                                 | Pending                                          | Reuse available tooling first; new browser dependency/CI edits require separately scoped approval                                                                      |
| Backup/restore and recovery proof                                           | Pending                                          | Current JSON is decrypted export, not encrypted backup or proven restore. Validate version, complete pagination, conflicts and transactional import before mutation    |
| Confirm-to-save recurring expense templates                                 | Pending feature contract                         | Stored recurrence schedule and deterministic per-occurrence identity; preserve encrypted financial fields, no automatic payment/save, no silent shared-split carryover |
| Budgets and annual reserves                                                 | Pending                                          | Owner-entered limits and explicit recorded-spend comparison; derive annual reserves without claiming a forecast; reuse review totals                                   |
| Named planning scenarios                                                    | Pending                                          | Reuse simulator; separate hypothetical values from actual records and explain fixed CPF assumptions                                                                    |
| Encrypted revision history/undo                                             | Pending concrete migration proposal              | Retention/deletion and owner authorization; append encrypted revisions in the same transaction as a save; restore creates a new revision                               |
| Email account/recovery clarity                                              | Pending provider contract                        | Existing email sign-in assumes an account; Google entry works through existing OAuth. Verify recovery callbacks and safe reauthentication before adding a flow         |
| PIN reset/recovery explanation                                              | Warning implemented; full recovery proof pending | Creating a new canary does not re-encrypt old records. Never imply a password reset restores forgotten-PIN records                                                     |

## Review notes

Current local verification:108files/813tests passing;92.82%lines,
92.59%statements,90.03%functions,86.98%branches. Existing coverage thresholds
are unchanged. Formatting, route logging, lint and typecheck pass; integration
and final build/push checks remain required before merge. Source review checked
auth-state failures, stale metadata, PIN mismatch, missing profile, first-use
eligibility including trades, and impossible shared splits. Onboarding metadata
fetching lives in its feature hook. The first-use regression waits for real query
readiness rather than assuming all reads finish together.

The fresh pass found profile and planner reads returning null on database errors.
This defeated existing retry UI and let export treat failed optional reads as
absent rows. Batch A replaces `single` with `maybeSingle` and throws opaque read
errors. New regressions fail on the previous actions with “promise resolved null
instead of rejecting”. Test fixtures that previously assumed synchronous default
tax estimates now await actual profile readiness.

Monthly review detects other-person shares exceeding an expense amount instead
of silently displaying negative personal spending. The existing expense boundary
does not yet enforce the combined split sum; investigate that in the accuracy/save
batch, including rounding and historical rows. Prior schema remains unchanged.

The existing export card already explicitly warns that the JSON contains
plaintext and excludes household data. Preserve this warning in future backup
work; it does not establish recovery support.

No migrations, dependencies, crypto protocols, protected files, private records
or real environment files changed. Current financial formulas and historical
pagination limitations are not marked resolved. DOM fixture tests do not replace
a real browser viewport/accessibility walkthrough; authenticated production
records remain excluded.

## Integration and accuracy follow-up

PR7 merged on2026-10-09 as d47faa7bf631f71f96bd7c079dce4e95c27a74a3 after
all GitHub CI and preview checks passed. Vercel reported success for the merged
commit. The umbrella roadmap remains open.

Spec073 records the next reversible tax correction: non-resident employment
uses15% or higher progressive tax without personal reliefs; modern top brackets
start with calendar income year2023; the80000 combined personal relief cap
includes CPF. Four regressions reproduced on original source. Fixed20% CPF,
relief eligibility, historical intra-year ceilings and rebates remain explicit
limitations. No citizenship/CPF eligibility is inferred from tax residency.

## Flat-history remediation — spec074

Salary, trades, dividends and tax-relief reads now use bounded pages with exact
counts and stable ID tie-break order. Advance by actual returned row count;
a lower API cap is not treated as end of history. A 1203-row encrypted salary
regression returned only125rows before remediation. Large encrypted fixtures
for every affected domain pass; owner/year filters are retained on every page.

Snapshots/entries, expenses/splits, distinct people and household contributions
remain pending. Parent pagination alone does not prove embedded-child completeness.
Count changes or later read errors fail closed; same-count concurrent changes
still require a transactionally consistent backup contract. No complete-export
or speed improvement was claimed. PR9 merged with green CI and deployment;
the isolated suite passed840tests with all aggregate metrics above80%.

The prior tax batch shipped in PR8 on2026-10-09 with green CI and deployment.
Its isolated suite passed824tests with92.84%lines and87.03%branches; full details
are recorded in the shipped spec073. The broader roadmap remains open.

## Nested-history remediation — spec075

Parent and child queries are paged separately for snapshots, expenses and
household goals. Personal children retain inner-join owner filtering; household
contribution requests use bounded goal-ID lists plus existing membership RLS.
Distinct-person suggestions page the split table with owner filtering. Original
synthetic regressions failed on11of12cases, including125returned rows instead
of1003. Isolated full gates pass111files/853tests:92.90%lines,92.66%statements,
90.12%functions,87.44%branches with stricter floors unchanged. Second review
checked query scope, child grouping, empty histories, later-page failures and
export consumers. PR10 merged on2026-10-09 after all CI/preview checks passed as
3c5554c89207f15c16f2554b9fefc697829b63f1. No migration or performance gain is claimed.

## Save preparation — spec076

Tax-relief replacement deleted old rows before encrypting the new list. Two
regressions reproduced on original source: later encryption failure had already
issued deletion, and duplicate keys were accepted despite the database unique
constraint. Prepare all ciphertext and validate unique keys before any mutation.
This preserves ordinary successful saves and empty-list clearing. Full isolated
gates pass111files/855tests:92.90%lines,92.67%statements,90.14%functions and
87.44%branches with stricter floors unchanged. Second review checked validation,
encryption ordering, owner/year scope, consumer failure handling and README.
PR11 merged on2026-10-09 after all CI/preview checks passed as
9d7f5a456a837be516727d064eaef0780e51da9c. Database insertion failures and
concurrent writers still require the separate transaction contract in draft
spec077. Scoped owner approval was requested for that additive migration and
its callers; implementation and production execution have not occurred.

## Expense allocation validation — spec078

Shared saves now reject shares above the bill before any database call. Equal
splits distribute whole-cent remainders rather than independently rounding each
person. The split dialog shows the actual personal remainder in both modes,
keeps invalid drafts editable and explains blocked confirmation. Inline Enter/
blur saves also preserve overallocated drafts with the same corrective message.
Settled shares remain part of the bill; self expenses keep ignoring stale splits.
Historical records are unchanged and nonatomic replacements remain unresolved.

Four regressions reproduced on prior behavior. Final isolated gates pass
113files/880tests with92.95%lines,92.69%statements,90.19%functions and87.57%branches.
Second review checked safe-cent bounds, floating-point sums, tiny bills, owner
allocation order, settlement preservation, row blur timing, schema consumers
and README/comments. Synthetic desktop/mobile component preview verified visible
errors, exact allocation, manual remainder and confirmation without account access.
Full browser workflows and atomic migration approval remain pending. PR/merge
completed in PR12 on2026-10-09 after all CI/preview checks passed, as
8f1da30b8922180d938fbb8ef8cf85b1d94c0b86.

## Atomic financial replacements — spec077

Snapshots, expenses and annual reliefs now prepare ciphertext before one
authenticated invoker RPC. Parent/child replacements roll back together, ownership
is database-derived, and snapshot parent IDs survive retries and renames. Relief
years serialize under READ COMMITTED, including first saves to an empty year.
Anonymous/service-role execution is revoked; existing RLS and table grants remain.
Last-writer-wins and direct owner table-write access remain explicit limitations.

Fresh PostgreSQL17.10 fixtures passed malformed/oversized/duplicate payloads,
cross-owner collisions, failed final-child rollback, empty/rename replacements,
preserved IDs and observed concurrent complete saves. Identity-before-vault action
tests passed. Full isolated gates and unchanged Git hooks passed115files/885tests:
92.91%lines,92.66%statements,90.19%functions,87.65%branches; security floors unchanged.
Second review and README/comment checks are recorded in spec077.

Clarence confirmed applying the migration on2026-10-09. PR13 merged with green
CI/preview checks as89009a7c7750caa0217cfed7ba9c53612735e539. Production readiness
is owner-reported; no production records or credentials were accessed. Batch B
starts with investigating snapshot stale-edit protection and safe failed-save
handling; concrete schema approval remains required before implementation.

## Snapshot draft preservation — spec082

Dirty snapshot forms now retain month/account/amount edits across history and
individual-query refreshes. Untouched cached editors still refresh, and explicit
navigation initializes the intended new/existing context. RHF useWatch replaces
the existing compiler-incompatible watch calls without a suppression. No layout,
schema, dependency, crypto or protected files changed.

Both draft-loss regressions failed before the fix. The full synthetic suite and
unchanged pre-push hooks pass115files/889tests:92.92%lines,92.66%statements,
90.17%functions,87.69%branches; stricter floors unchanged. Four workers reproduced
two existing expense timeouts; two workers passed the identical suite with
unchanged assertions, timeouts and isolation. This is a measured host comparison,
not a universal speed claim. Second review corrected untouched-cache freshness
and checked explicit context changes, subscriptions, totals and README/comments.
PR14 merged after all required CI/preview checks were green on13f9ed5, as
19a6122be3434d9a7adcbc313ae78e0b74519ac2 on2026-10-09.

Clarence separately approved spec083 implementation after this merge; production
SQL execution remains owner-only and requires distinct readiness confirmation.
Read-only contract review found the delete/recreate ABA case: different parents
can share month/revision1. The proposed addendum requires original parent ID plus
revision in compare-save/delete calls, adding no further column. Its concrete
owner decision was approved on2026-10-09 under constitution §8.3. Spec083
implementation follows this closeout; no production migration has been run.
Research supports SELECT FOR UPDATE's current-row comparison under READ COMMITTED,
text casts for lossless counters and returned expected errors for Server Actions:
[PostgreSQL17](https://www.postgresql.org/docs/17/transaction-iso.html),
[PostgREST column casting](https://docs.postgrest.org/en/stable/references/api/tables_views.html#casting-columns),
[Next.js expected errors](https://nextjs.org/docs/app/getting-started/error-handling).

## Snapshot comparison and recovery — spec083, verified but not shipped

Clarence approved the revision migration/callers and the original-parent-ID
addendum on2026-10-09. Snapshot creates use a unique insert; edits/deletes compare
identity plus lossless revision under an owner row lock. Coherent edit reads bind
version to all ciphertext children. Legacy RPCs advance revisions. Drafts remain
visible after conflicts or uncertain outcomes, with explicit review; no force
writes or automatic mutation retries. Recovery rejects unrelated rename targets,
cancels older in-flight reads and ignores obsolete completions after navigation.
Export format remains unchanged. The mobile month header and accessible control
names were corrected within the owner's audit scope.

All isolated gates pass116files/906tests:93.00%lines,92.62%statements,
90.17%functions,87.92%branches; security floors unchanged. Two relevant regressions
fail on shipped main. Fresh PostgreSQL fixtures prove owner/role boundaries,
atomic revision/data rollback, one concurrent winner, delete/recreate protection,
bigint/child-count correctness, coherent concurrent reads and pre-migration record
preservation. Second review and synthetic desktop/mobile recovery proof are in
spec083. No authenticated/private browser or production-record access occurred.

Application merge waits for owner confirmation of
supabase/migrations/20261009000001_snapshot_edit_revisions.sql. Spec077's earlier
migration confirmation is distinct. Do not repeat completed spec082 or ask again
for spec083 implementation/identity approval. Older deployments and direct table
writers remain documented comparison limits; durable retry/history work is later.

## Parallel delivery closeout — 2026-10-10

The owner requested parallel worktrees; isolated accuracy, latency and CPF
fixtures used tracked source and placeholder configuration only. No private
accounts, secret files or production financial records were read. The existing
hooks were retained. Initial fixture Husky wrappers were absent after installation
without Git metadata; official Husky setup restored them, the unchanged pre-commit
was explicitly rechecked, and subsequent commits/pushes used normal hooks. No
hook bypass or protected-file edit occurred.

Spec085/086 shipped in PR16 after green exact-head CI as
5ec95fbed1c413218ca7571aacee7904f3a00040. The opt-in history benchmark and deterministic
prefetch regression establish a baseline, not a production speed improvement.
A synthetic real Next16 transport lab measured five alternating samples: separate
450ms functions median995.7ms versus one internally concurrent function501.4ms.
Server timing confirms separate calls queued; the lab uses no account/database
and does not prove a selected Fynfo architecture. Spec087 is a proposal only:
bounded caches must avoid arbitrary snapshot edit-string collisions, preserve
freshness/errors and full-history consumers, and demonstrate representative
benefit. Small histories can be slower if extra reads are introduced.

Spec084 shipped in PR17 after green exact-head CI as
574731f10885c115a806619962757b55105c67d6. Missing prices/currencies no longer become
fabricated valuations; SGD/USD summaries remain native, real FX is required for
conversion, incomplete derived budgets clear, and unsupported/overflowing returns
are withheld. 116files/910 local tests passed:93.00%lines,92.72%statements,
90.20%functions,87.53%branches; stricter floors unchanged. Four regressions fail
against shipped source, followed by exact fixture restoration. Independent review
and synthetic desktop/mobile/keyboard proof passed. Historical partial-sale cost
accounting and provider metadata limits remain explicit; no exhaustive financial
accuracy claim is made.

Spec088 is under final verification for monthly CPF wagebands, rounding, actual
month ceilings and recorded-versus-projected labels. It does not establish
citizenship/PR or other age eligibility, change persistence, or silently update
the separate flat20% deployment planner. Snapshot spec083 remains verified and
unmerged pending owner confirmation of its distinct revision SQL; spec077's prior
confirmation does not apply to it.

## Accuracy, authentication and historical dividend delivery — 2026-10-10

Spec088 shipped in PR18 as96eab4d407f9f103a33f7caed7b9d312151b644f after green exact-head CI. Monthly full-rate age55-and-below CPF planning now handles low wage bands, whole-dollar rounding, actual2023 month ceilings and recorded/projected labels.116files/910tests passed;92.99%lines,92.72%statements,90.23%functions,87.95%branches. Three meaningful baseline failures, independent reviews and synthetic desktop/mobile proof passed. Eligibility/PR/other ages, unsupported low-band partial AW-cap cases and the separate assets planner remain explicit limits.

Spec089 shipped in PR19 as298befa76b71a9db59be76fe3bbae524a501eb6f after green exact-head CI. Safe returned/thrown login failures allow retry; callback/proxy response reconstruction preserves refresh cache metadata and cookies.119files/926tests passed;93.32%lines,93.02%statements,90.60%functions,88.00%branches. Existing-provider baseline regressions, independent review and actual Next public-route desktop/mobile proof passed using placeholders only. No private sign-in/provider session was used. Signup/password recovery remains draft094 with hosted non-secret configuration and identity-lifetime prerequisites.

Spec090 shipped in PR20 asd60aac3247a8b6d10bde9e8d2df84d8a18896941 after green exact-head CI. Historical scanning includes sold tickers, excludes ex-date purchases and retains prior shares sold on the ex-date.117files/938tests passed;93.06%lines,92.79%statements,90.23%functions,87.78%branches. Three mounted red regressions, independent review and actual-dialog synthetic desktop/mobile/edit/select/import proof passed. Browser import used memory-only adapters. The five-year provider feed, inferred currency, ex-date/payment-field mismatch, special distributions and empty-on-provider-failure limitations remain; this is not verified received income or authorized dividends.sg integration.

Spec092 ordinary export qualification/cleanup is locally verified and awaits PR delivery. Synthetic actual-hook download contained all eight nonempty fixture domains; mobile390px has no horizontal overflow and domain failure leaves visible opaque retry feedback. Temporary browser/server/viewport resources were cleaned. Export still has no restore and independent domain reads are not a coherent backup. Spec091 remains an unapproved additive coherent-read/empty-vault-restore proposal, with exact privilege/isolation/capacity proof required before migration approval.

Spec087's external bounded-selection lab repeated12/120/1200month fixtures: full-reader mean1.26–1.35/13.67–15.37/175.51–184.91ms versus bounded0.45–0.61ms, pages2/7/68 versus4. The production decryption/pagination is real but DB selection is simulated; no browser/provider/production latency gain or architecture selection is claimed. Missing calendar months, year rollover and a612-child case pass. QueryClient lifecycle proof found a pending pre-write read can publish after default invalidation. Spec093 now tests and corrects that race across20 non-optimistic mutations; it is locally verified and not yet shipped. Existing background refresh, optimistic expenses, retained hydration replay and parent/child read coherence remain separate contracts.

Clarence reiterated continuing until tasks are complete while asleep. Parallel ordinary delivery continues; no new dependency/migration/crypto/protected approval is inferred. Spec079's pinned PDF.js dependency plus narrowly omitted optional native canvas footprint awaits a concrete owner answer. No parser was installed. Snapshot083 still requires distinct confirmation of20261009000001_snapshot_edit_revisions.sql; earlier077 confirmation does not authorize application merge. These records do not claim the entire roadmap or exhaustive security review is complete.

## Export, read freshness and identity delivery — 2026-10-10

Spec092 shipped PR21 as68106d5f33fd060cd403a30e5950018f25475776 after all exact-head required checks passed. Same-tick duplicate exports and failed-download resource leaks are fixed; plaintext, household exclusion, absent restore and non-atomic read limitations remain visible.118files/944tests;93.14%lines,92.84%statements,90.34%functions,87.90%branches. Two reviews plus actual-hook synthetic download/failure and desktop/mobile proof passed.091 coherent export/empty-vault restore remains an unapproved migration contract.

Spec093 shipped PR22 as916190dee307c106d1ce23b709130e02a94d598b after green exact-head checks. Twenty successful non-optimistic mutation hooks cancel pre-write reads before invalidation; actual-query baseline 20 failures and20 failed-write controls distinguish the observed race.121files/991tests;93.39%lines,93.08%statements,90.66%functions,88.23%branches. Existing awaited/background completion choices and optimistic-expense behavior are preserved. Already-dispatched Server Functions, coherent parent/child reads and retained hydration replay remain separate.

Spec096 shipped PR23 as3d048b23f8bc379e53fb92de9e12760909333edb at04:54:40UTC after green exact-head CI/preview checks. A goal at99.5 of100 now keeps its unfunded status despite displayed percentage rounding.121files/997tests;93.50%lines,93.20%statements,90.76%functions,88.60%branches. Two source reviews and meaningful mounted boundary/invalid-input regressions passed. Shared-goal correctness does not establish private personal-goal ownership; sub-cent formatting remains separate.

Spec095 shipped PR24 as31482852ce64e8685ae54fa30d61d43c4f890e92 at04:55:55UTC after green exact-head checks. Server-verified identity binds protected UI lifetime; detected signout/account changes clear client queries, hide old editors immediately and block late unlock replies. Uncertain initial session fails closed with manual sign-in; same-account refresh preserves drafts.121files/993tests;93.65%lines,93.35%statements,90.90%functions,88.58%branches, with original floors retained and new explicit security-file floors. Actual-component synthetic desktop/mobile proof confirmed draft preservation, terminal account-switch/signout/initial-null states and cache0 after old read/unlock replies. It does not prove hosted-provider or retained-RSC behavior. Initial automatic push review lacked destination evidence; verified credential-free cljiahao/fynfo origin and standing owner authorization allowed the normal-hook retry, which passed. No bypass occurred.

Spec097 shipped PR25 as13dd5b5681fe8beca6a6526e929c69fc7bb647f5 at05:01:44UTC after green exact-head checks. Distribution history loading/failure no longer becomes a false empty/yield state or unverified cached total; historical Scan requires successful deduplication context, while manual Add remains available.121files/990tests;93.51%lines,93.21%statements,90.78%functions,88.71%branches. Three baseline readiness failures, true-empty control, root review and synthetic actual-component desktop/mobile proof passed; successful retry is proved by mounted tests, not the preview's fixed-error adapter.

The source/test inventory covers every11page and5HTTProute file at its explicitly pinned merged-main baseline; broader authenticated Next/browser/database workflows remain open. Source redirects have no newly proved wrong destination. Missing profile RHF error rendering alone was not accepted as a defect because normal numeric input already enforces matching min/max/integer constraints; browser-native confirmation remains useful. External reuse and52-candidate amount-hiding inventories guide scope and are not full-feature completion claims.

Parallel098 protects dividend suggestion/editor lifetime and removes numeric global notifications;099 separates unavailable provider feeds from valid empty scan results;100 provides factual monthly-review next steps inside the existing disclosure. A fresh101 external schema/action experiment reproduced impossible calendar dates passing expense validation (five failures/five valid controls); no real stored corruption is claimed and source remediation has not begun. All further executable batches require recorded scope, full gates and second review before delivery.

Draft080 is now preserved alongside079:090's shipped historical estimate corrections do not grant a dividend evidence source license or actual-receipt status model. Dividends.sg's primary indexed terms rechecked2026-10-10 still require written permission for automation; no dataset collection or outreach occurred.079's exact PDF dependency/configuration decision,083's distinct revision SQL confirmation,091's coherent restore migration and094's non-secret hosted configuration remain unresolved. No secret/private account access, dependency installation, unapproved migration or protected-file edit occurred. The full roadmap remains incomplete and continuation stays active.

## 2026-10-10: dividend lifecycle, provider readiness and review guidance shipped

- 098 / PR26 merged46f0f4913e3123cbbd6a76333b0c1a3dcad5db86 at05:28UTC after exact239274ba62ca070ccf2dc1dbdaed1e49a63c09d5 CI/Vercel success. Late suggestions/saves cannot affect another editor lifetime; actual-form delayed completion/browser-mobile qualification and1075tests. Coverage93.47 statements/88.82 branches/91.10 functions/93.78 lines.
- 099 / PR27 merged dc91392eec1b9fb54254c72e602379dfe337a50d at05:30UTC after exact53f95ba42e84762de1e78ca97ef50b2fd7e76e69 green checks. Provider/whole-envelope failures are opaque errors; partial scans withheld and retry is available. Successful empty market data explicitly remains coverage-limited.1072tests, coverage93.45/88.89/91.02/93.74. Synthetic retry produced a reviewableSGD20 candidate; no live source accessed.
- 100 / PR28 merged03de9f96ed740907d2ef07ea53b5b414de3ce649 at05:30UTC after exact1bb6b2e5cfa8f093ed22258a80abf4d9d8779b6c green checks. Existing disclosure gives truthful salary/expense/snapshot next steps; zero and absence stay distinct.1069tests, coverage93.41/88.87/90.99/93.72. Actual-component retry, keyboard and390px checks passed without new queries or certified-closing claims.

101 / PR29 expense calendar-date boundary merged d082928910e59d2fb9533e0d8237fbf8c659de63 at05:43UTC after exact2216a5b9bffc8f15834aeae78b7c5844a95e6163 CI/Vercel success. Full125files/1074tests passed; coverage93.42/88.85/91.00/93.73 and existing security floors unchanged. Invalid dates reject before context/encryption/database, with valid timestamp semantics unchanged.102 source-backed monthly totals selected next without additional reads.103 named-scenario persistence is a draft requiring scoped approval.104 scan-to-received proposal records actual-payment-date/net-amount/currency and durable dedupe limitations; no implementation selected.083 still awaits its distinct revision migration confirmation,079 its precise PDF dependency decision,091 coherent recovery SQL/privacy approval and094 provider readiness. No whole-roadmap, private-production workflow or exhaustive audit completion claim.

Delivery coordination: parallel source/reviews remain useful; subsequent heavy coverage/build jobs are serialized to avoid host contention. Automatic push review rejected100 before execution for missing destination evidence; root verified exact credential-free Fynfo origin, ADMIN permission and prior owner-authorized destination, and the evidence-based retry passed unchanged hooks. No denial or hook was bypassed.

## 2026-10-10: PR15 production revision migration confirmed

Clarence confirmed running the exact 20261009000001_snapshot_edit_revisions.sql after opening its complete local file. This satisfies the distinct spec083 production prerequisite. PR15 remains unmerged while current main is integrated and required gates are rerun. Preserve both identity/revision comparison and spec093 cancellation of pre-write replies, refreshing only confirmed writes. Keep spec092 complete export/error/lifetime tests and add the original concurrency-metadata omission regression. No migration or protected-file contract change; no production records or credentials accessed.

## 2026-10-10: contributing monthly records shipped; scenario scope approved

102 / PR30 merged `e22c0838747e7ede31d1824cd5d705175d5cd6c1` at 06:08:58 UTC after exact `f217129690e8c0d9c4e57f880f1ec340ab9a7275` CI and Vercel success. Monthly totals and bounded source rows share the selected cents projection; salary components, expense personal shares and two exact-month snapshots appear inside the existing disclosure. No additional queries or private split names. All five local gates and unchanged hooks passed: 129 files/1,104 tests, coverage 93.50% statements, 89.22% branches, 91.08% functions, 93.79% lines. Independent review and synthetic keyboard pagination, mobile wrapping, invalid-split qualification and retry proof passed. Browser month-reset remains unclaimed due native-driver limitations; actual mounted tests prove it. This is explanation, not certified reconciliation or an audit ledger.

105 trade-history inferred-currency correction passed fresh review and all five gates (1,101 tests; 93.51/89.16/91.12/93.80), with normal commit/push hooks passed and exact head e0be4e446118225b247bf9a96578afd346c2aa06 merged as PR31 / 9fcfcddc8cf49af15419b8c3634e2a45a22b5afa at 06:30:12 UTC after all required CI and Vercel checks passed. Existing unknown ticker mapping stays explicitly inferred, never verified settlement currency or FX conversion. Mobile proof initially failed because the screenshot API distorted capture; proper getScreenshot and inspected 390px DOM geometry show the readable helper and incumbent table scrolling. Final built-CSS desktop/mobile proof passed with that qualified scope. 106 open-only personal-record search passed focused tests and two source reviews; full gates remain pending. Fair route-reference bundle comparison found a material expense-route increase, so the recorded open-only dynamic task split was selected before final verification; no measured production latency claim. Actual synthetic hooks show no closed reads, one cold read per source, bounded results, cached-error withholding, reset after late replies and terminal account-switch hiding. Disabled preview navigation and writes do not prove hosted workflows.

Clarence explicitly approved spec103's exact encrypted scenario table/RPC/payload/export contract on 2026-10-10, recorded against reviewed raw draft SHA-256 `2498ba2643b102354f0c1b7e33dd749c6c2800226c5c4567fcb9698e20d8aadc`. Implementation is assigned separately; production migration remains owner-only, with actual isolated SQL proof and exact production readiness required before application merge. The owner started Docker Desktop after the initial daemon failure. A fresh PostgreSQL17/PostgREST14.14 synthetic runner passed initial ownership, concurrent request/CAS/delete/capacity, incarnation and BIGINT JSON/overflow tests; reproducible harness and UI verification remain in progress. No production credentials or records were read. Unrelated 079 dependency, 080 source/status and 091 recovery decisions remain pending. The full roadmap remains incomplete; continuation stays active.

## 2026-10-10: snapshot conflict protection and personal-record search shipped

PR32 merged at 07:10:10 UTC (e950bea2967626740ee636def166c42f2d071f24) after all exact-head checks passed. PR15 merged at 07:28:34 UTC (52edfff730d4dbd33a2d6d00d8c5cafc6e72f1d2) after owner confirmed its distinct revision SQL and all refreshed CI/deployment checks passed. Snapshot integration: 132 files/1,139 tests; statements93.45%, branches89.38%, functions91.07%, lines93.85%, strict security floors unchanged. Its normal hooks pass and production Vercel status is success. Scenario103 remains separate: implementation and isolated SQL proof approved/verified; production103 SQL is still owner-only and unconfirmed. Final scenario integration/gates and synthetic087 browser measurements continue; the entire roadmap is not complete.

## 2026-10-10: owner paused scheduled continuation

Clarence asked to turn off unnecessary scheduled wakeups while the current work was active. App automation continue-fynfo-improvements was updated to PAUSED through the supported tool and verified. This pauses future scheduled wakeups, not the active implementation batch, and does not mark the roadmap complete. Once the chat is idle, remaining work needs a new owner message or an explicitly resumed schedule. Current103 production migration remains separate and unconfirmed; no private configuration was inspected. Integrated103 source preserves083 export projection; independent review passes, final gates remain active. External087 browser instrumentation is being prepared so the CUA surface can observe only approved public synthetic timings through rendered DOM; no product speed claim.

## Delivery record closeout scope — 2026-10-10

Root delegated an ordinary-document-only closeout batch on `impl/081-102-105-closeout`: this progress record, `specs/audit/105-trade-history-currency.md`, `specs/feature/081-sequential-delivery-roadmap.md`, `102-monthly-review-contributing-records.md`, `103-named-planning-scenarios.md`, `106-personal-record-search.md` and `specs/fix/083-snapshot-edit-conflicts.md`. Preserve all prepared edits and original approval hashes/history while integrating merged main; update delivery metadata, exact103 confirmation and the owner-requested hourly continuation/final integrated sweep requirement. Acceptance: factual PR/head/date review, scoped formatting/diff review and an independent pass; rollback is the retained path-scoped integration stash. No executable, protected configuration or new feature edits.

## 2026-10-10: private scenarios shipped; hourly continuation resumed

PR33 merged exact reviewed head `d0761f22746a94b7642018c8241e0ceaa02fde04` at07:59:51 UTC as `82d311cbb02e93b5f46ca1e81536387f744c5b15`, after all required CI and Vercel checks passed. Root confirmed the production deployment succeeded. Clarence confirmed "migration done" directly to the exact103 SQL handoff; the owner-only production prerequisite is satisfied. The encrypted owner-only ten-slot scenario feature, isolated planner dialog and exportv3 shipped with real fresh PostgreSQL/PostgREST RLS/concurrency proof, independent exact-head review and normal hooks. Integrated main included083 snapshot export projection and106 search;138 files/1,227 tests passed, coverage92.85% statements/88.9% branches/90.91% functions/93.41% lines, unchanged security floors.

After the earlier pause, the owner left and explicitly requested continuation. The continuation schedule was re-enabled hourly on2026-10-10; the previous pause entry remains historical. The roadmap is still incomplete. Remaining tasks and separately scoped provider/dependency/production decisions retain their own approval requirements; no credential or private-record discovery is authorized.

The owner additionally requires a final project-wide integrated confirmation sweep after all roadmap tasks are completed and merged: synthetic page flows, saves and redirects, calculations, security, performance, documentation and coverage, with explicit remaining blockers. Current103 delivery and its isolated proof do not substitute for that later sweep. Continue remaining roadmap work and evidence-backed blockers rather than marking the roadmap complete.

## 108 delivery closeout scope — 2026-10-10

Root delegated an ordinary documentation-only closeout under Constitution §7.4
on `impl/081-108-closeout`, based on merged main
`c8714072d1ccd2b5630646439cf7a200bd511fbd`. Exactly three files are in scope:
this progress record, `specs/feature/081-sequential-delivery-roadmap.md` and
`specs/fix/108-overview-read-cohorts.md`. Record merged PR35 and verified local
metrics; preserve blank separate approval metadata, prior history and remaining
SSR/workflow work. Acceptance is scoped formatting/diff review and an independent
factual pass, with no executable edits or heavy runtime gates. Rollback is a
scoped documentation revert. The retained original 087 path-scoped stash
`83e4a9a74d018dfdcacff4f017796c32028a552e` remains untouched.

## 2026-10-10: verified overview read cohorts shipped

PR35 merged at 14:59:52 UTC as
`c8714072d1ccd2b5630646439cf7a200bd511fbd`, after exact published head
`154c07fb80f927e0691ea44b5333e9ae8efae657` passed required CI run
`38044385694` and Vercel checks. Root verified the merged commit's public Vercel
production deployment status is successful; private production behavior was not
tested. Spec108 is now
shipped under the recorded ordinary §7.4 audit authorization; its separate
approval field stays blank. All five local gates and unchanged normal hooks
passed: 141 files/1,278 tests, coverage 93.01% statements, 89.02% branches,
91.22% functions and 93.58% lines, with stricter security floors unchanged.
Independent source/tests/documentation review passed.

Five existing overview histories coalesce into one guarded streamed action while
retaining independent query keys, readiness/errors/retries, cancellation and
optimistic expense rollback. The rejected four-source prototype remains recorded
as counterexample evidence. Thirty alternating public synthetic component samples
showed inferred outer Server Function calls of seven versus three, one completed
read per source and earlier core-card disclosure in the slow-trades control.
That control's salary median increased by 17 ms; this is not a universal speed
gain. The fixture's emitted initial JavaScript union increased by 559 gzip bytes.
Generated-data guards, fixed delays and diagnostic polling do not establish
production latency, whole-dashboard readiness, private-account workflows or a
coherent database snapshot.

Roadmap E's bounded108 client fetching remediation is verified and shipped.
Initial SSR await-all behavior remains unchanged; broader actual Next workflows
and the owner's final integrated project-wide sweep remain open. Other roadmap
features and their scoped approvals are still outstanding. This closeout does
not mark the whole roadmap complete or delete retained 087 work.

## 111 remediation and linked 110 closeout scope — 2026-10-10

Root accepted the scoped equity calendar-day correction after PR36 merged.
Branch `impl/111-equity-calendar-dates` starts from
`5c19555ddbcf448dfc41cd5f70d3c6a1da4ddb2c`; recorded scope is exactly
`specs/fix/111-equity-calendar-dates.md`, `src/features/equity/schemas.ts`,
`test/features/equity/equity-calendar-dates.test.ts`, `README.md`,
`specs/audit/110-expense-paste-accuracy.md` and this progress record. Ordinary
Constitution §7.4 remediation retains blank separate approval and existing valid
timestamp/storage contracts. The last two files close out already merged 110;
no protected/governance or other metadata edit. Existing 108 donor and original 087
path-scoped stashes remain retained. 111 delivery is not claimed yet.

## 2026-10-10: expense paste accuracy and save outcomes shipped

PR36 merged at 15:45:25 UTC as `5c19555ddbcf448dfc41cd5f70d3c6a1da4ddb2c`,
after exact head `81696acfd6b16b163e08d5f683f6173e7e38a940` passed required
CI run 38064677924 (completed 15:44:47 UTC) and Vercel preview checks. Root verified
public merged-commit Vercel production status is successful; private production
workflows were not accessed. All five local gates and unchanged normal hooks
passed: 141 files/1,342 tests, coverage 93.08% statements, 89.29% branches,
91.24% functions and 93.62% lines, with strict security floors unchanged.

Actual parser/form regressions and independent review qualify impossible dates,
malformed money and credit markers without normalizing them into a different
positive expense. Invalid fields remain visible despite prefilled values; mixed
paste batches report confirmed/unconfirmed/skipped outcomes after settlement.
Synthetic actual-form clipboard/rapid-entry/lifetime proof used fixed generated
values and memory-only boundaries, not private provider/database/account access.
PDF bank extraction, durable duplicate prevention and the final integrated whole
project sweep remain separate. The whole roadmap is not complete.

## 112 ordinary calendar-read and quarter precision scope — 2026-10-10

Root accepted combined external draft SHA256 `4bfad856dbde32caaa3d0c5d9b5ea048e1a13c67472c53413254c7a3048abfcd` after 111 merged. The scope was recorded before edits: `specs/fix/112-year-zero-months.md`, `src/lib/utils/month.ts`, `src/features/assets/hooks/use-chart-data.ts`, `src/features/salary/components/salary-chart.tsx`, `test/features/month-record-compatibility.test.tsx`, `README.md`, `src/features/assets/lib/investment-math.ts`, `test/features/assets/investment-math.test.ts`, and the two linked ordinary closeout paths `specs/fix/111-equity-calendar-dates.md` and this progress record. Preserve raw records, writes, export and positive-year display contracts; no SQL, dependency, protected edit or new-write policy. 112 is not shipped yet.

## 2026-10-10: equity calendar validation shipped

PR37 merged exact head `0f2a22533d2c3eff792a544a5479363ebf6f2c3b` as `349bf026da12980eb62a99274d4221d8ccfe6727` at 16:25:47 UTC, after required CI 38067279606 success completed 16:24:35 UTC and Vercel preview success. Root verified public merged-commit production deployment success; private account workflows were not accessed. All five local gates and unchanged normal hooks passed: 142 files/1,379 tests, coverage 93.08% statements, 89.30% branches, 91.24% functions and 93.62% lines. Both reviews accepted the same minimal validation contract. Meaningful baseline 20 failures/17 controls and corrected 112 focused tests qualify rejection before guarded work, not production persistence. Year-zero database inputs, existing normalized records and the final integrated sweep remain open.

## 2026-10-10: calendar label resilience and quarter precision shipped

PR38 merged exact head `5e60b81e83e04fe41ff9ad31278da17d2aa80e65` as `1c9857c014038e755c54140cb9d50398103c3223` at 17:23:27 UTC after CI 38071070671 SUCCESS completed 17:20:31 UTC and Vercel preview success. Root verified public production deployment status SUCCESS; private account workflows were not accessed. Local five gates and unchanged normal hooks passed: 143 files/1,410 tests, coverage 93.08% statements, 89.31% branches, 91.24% functions and 93.62% lines. Raw legacy months/amounts remain available without normalization; positive-year labels and inclusive local quarter-end milliseconds are preserved. This does not complete the roadmap or establish all chart labels are visible at every viewport.

## 116 ordinary expense draft preservation scope — 2026-10-11

Root selected the existing owner-authorized ordinary remediation under Constitution §7.4. Before executable edits, the audit recorded exactly eight paths: `specs/fix/116-expense-draft-preservation.md`, `src/features/expenses/components/expense-table.tsx`, `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-type-select.tsx`, `test/features/expenses/expense-draft-preservation.test.tsx`, `README.md`, and linked ordinary closeout `specs/fix/112-year-zero-months.md` plus this progress record. Stable draft IDs/current-day creation, row-only pending controls, sibling preservation and late notice qualification preserve actions/encryption/query contracts. The generated actual-component baseline found 4 failures/1 control plus 5 supplementary failures; no production duplicates or durable write cancellation are claimed. 116 is not shipped yet.
