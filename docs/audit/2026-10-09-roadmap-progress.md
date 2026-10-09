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
| Complete histories and export reads                                         | Next hardening batch                             | Paginate top-level and nested relations; stable tie-break order; fixtures over1000rows; preserve owner RLS and opaque errors                                           |
| Atomic saves, concurrent edit conflicts, retry idempotency                  | Pending concrete migration proposal              | Snapshot/expense/relief child replacement needs transaction and revision contract; scoped migration approval before executable migration changes                       |
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
