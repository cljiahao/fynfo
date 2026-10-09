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
