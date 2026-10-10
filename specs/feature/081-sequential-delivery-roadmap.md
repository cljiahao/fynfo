---
id: '081'
area: feature
status: approved
created: 2026-10-09
approved: 2026-10-09
author: Codex
---

# Sequential Fynfo delivery roadmap

## Owner direction

On2026-10-09 Clarence approved working through the prioritized feature/improvement
table, one verified PR at a time: confirmation sweep, green CI, merge, then next
batch. Keep the UI minimalist, sleek, fast and secure; use Impeccable when useful,
accessible tooltips for supplemental help, named disclosures for optional controls,
and modals/dedicated pages when task size warrants. Inputs, errors and material
assumptions stay visible. Record evidence when skipping an unnecessary or duplicate
feature rather than adding it for checklist completion.

This records direction and ordinary implementation authorization; it does not
blanket-approve unknown dependencies, protected-file changes, crypto protocols or
unreviewed migrations (§7.4/§8). Reviewed atomic spec077 is now approved separately
by the owner's sequential go-ahead. Production SQL remains owner-executed before
application merge. Specs079/080 remain draft integration contracts with unresolved
dependency/source access and persistence questions.

## Delivery batches

| Batch | Work                                                                            | Readiness                                                                                                                         |
| ----- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A     | Atomic snapshots, expenses and relief replacements                              | Shipped spec077 / PR13 after owner migration confirmation                                                                         |
| B     | Concurrent edit detection and safe retries                                      | 082 shipped / PR14; 083 verified / PR15 awaits distinct owner revision SQL confirmation                                           |
| C     | Quote/FX freshness, unavailable data and consistent investment currencies       | Shipped spec084 / PR17; provider metadata and accounting limits recorded                                                          |
| D     | CPF eligibility, age and rounding accuracy                                      | Spec088 monthly full-rate corrections shipped / PR18; eligibility/profile contract still separate                                 |
| E     | Measured dashboard latency and fetching architecture                            | 085/086 baseline shipped / PR16; 093 stale-read integrity shipped / PR22; 087 proposal unselected                                 |
| F     | Synthetic browser flows and accessibility                                       | Source/test page inventory and synthetic per-PR checks; broader actual Next workflows remain                                      |
| G     | Proven backup/restore, recovery checklist and PIN limitations                   | 092 qualified export shipped / PR21; 091 coherent export/restore draft, migration unapproved                                      |
| H     | Account signup/password recovery and callbacks                                  | 089 auth shipped / PR19; 095 identity lifetime shipped / PR24; 094 provider-readiness draft                                       |
| I     | Refund, transfer and card-repayment classification                              | Ledger/schema proposal where required                                                                                             |
| J     | Local PDF extraction, side-by-side editable review, mobile/keyboard and cleanup | Draft079; dependency approval required                                                                                            |
| K1–K4 | UOB, DBS, Citibank and HSBC adapters                                            | Verify each variant with synthetic/public fixtures                                                                                |
| L     | Import duplicate checks, explicit save selection and outcome summary            | A/B plus defined import identity                                                                                                  |
| M     | Merchant names and categorization rules                                         | Scoped persistence contract                                                                                                       |
| N     | Historical dividend scan and entitlement boundaries                             | 090 historical estimates shipped / PR20; 097 ledger readiness / PR25 and099 provider failures / PR27 shipped; actual evidence O/P |
| O     | Authorized dividend evidence source/payment dates                               | Draft080; verified provider permission                                                                                            |
| P     | Expected versus received dividends and statement reconciliation                 | Separate event/status persistence contract                                                                                        |
| Q     | Statement/record balance reconciliation                                         | Explicit currencies/account coverage                                                                                              |
| R     | Confirm-to-save recurring templates and bills/subscriptions calendar            | Encrypted schedule/occurrence contract                                                                                            |
| S     | Budgets, recorded spending and annual reserves                                  | Reuse monthly-review calculations                                                                                                 |
| T     | Monthly closing checklist                                                       | 100 derived review steps shipped / PR28; certification/closing state separate, no duplicate ledger                                |
| U     | Encrypted revision history and undo                                             | Atomic append/retention/schema approval                                                                                           |
| V     | Explain totals using contributing records and assumptions                       | 102 contributing-records increment in progress; reuse existing histories                                                          |
| W     | Liabilities and repayment details                                               | Define schema and net-worth contract                                                                                              |
| X     | Personal goals                                                                  | 096 shared-goal completion fixed / PR23; private goal ownership/persistence remains separate                                      |
| Y     | Named planning scenarios                                                        | 103 encrypted named-scenario proposal draft; isolated from actuals                                                                |
| Z     | Explain wealth changes and unresolved differences                               | Accurate flows and valuation prerequisites                                                                                        |
| AA    | Investment concentration against owner targets                                  | Accurate currency/exposure data                                                                                                   |
| AB    | Expense anomaly review                                                          | Suggestions only, explicit review                                                                                                 |
| AC    | Financial timeline                                                              | Reuse source records                                                                                                              |
| AD    | Global search and quick actions                                                 | Owner-scoped queries, bounded result sets                                                                                         |
| AE    | Account archival with historical preservation                                   | Define account identity/lifecycle                                                                                                 |
| AF    | Amount hiding for screen sharing                                                | Consumer/design proposal only; edit, chart, portal, accessibility and export proof required                                       |

## Verification and handoff

Record paths/contracts before edits; meaningful regressions and a second review.
Run all existing gates in the isolated synthetic fixture with every aggregate
coverage metric above80% and stricter floors intact. README/comments per batch;
only claim measured speed improvements. Never read real env, credentials, cookies,
PINs or confidential statements. No hook bypass. Merge only green required checks;
record shipped metadata and actual Git state before starting the next batch.

If a concrete owner/provider action blocks rollout, finish reviewable work and
report that action; do not weaken safety or merge unavailable RPC callers. The
continuation automation follows this record and stays quiet on unchanged state.
Disable it only when all authorized work is completed or evidence-backed skips
are recorded. New discoveries go into scoped follow-up records, not silent scope
expansion. Existing completed PR7–PR12 batches are recorded in roadmap progress.

## Parallel preparation authorization — 2026-10-10

Clarence explicitly requested continuing work in parallel worktrees. Independent
scoped batches may be investigated, implemented and verified concurrently;
merges remain individually gated on green required checks and any specific
production readiness approval. This supersedes the earlier preparation sequence,
without authorizing new dependencies, migrations, protected edits or crypto
contracts. Snapshot spec083 still awaits its distinct owner SQL confirmation.
