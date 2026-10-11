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

| Batch | Work                                                                            | Readiness                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A     | Atomic snapshots, expenses and relief replacements                              | Shipped spec077 / PR13 after owner migration confirmation                                                                                                                            |
| B     | Concurrent edit detection and safe retries                                      | 082 shipped / PR14; 083 shipped / PR15; distinct revision SQL confirmed 2026-10-10                                                                                                   |
| C     | Quote/FX freshness, unavailable data and consistent investment currencies       | Shipped spec084 / PR17; provider metadata and accounting limits recorded                                                                                                             |
| D     | CPF eligibility, age and rounding accuracy                                      | Spec088 monthly full-rate corrections shipped / PR18; eligibility/profile contract still separate                                                                                    |
| E     | Measured dashboard latency and fetching architecture                            | 085/086 baseline shipped / PR16; 093 integrity shipped / PR22; 108 cohorts / PR35 and119 SSR key correctness / PR40 shipped; bounded121 workflow proof; further streaming unselected |
| F     | Synthetic browser flows and accessibility                                       | Bounded actual Next page sweep and122/125 corrections verified in121; broader accessibility/private boundaries remain                                                                |
| G     | Proven backup/restore, recovery checklist and PIN limitations                   | 092 qualified export shipped / PR21; 091 coherent export/restore draft, migration unapproved                                                                                         |
| H     | Account signup/password recovery and callbacks                                  | 089 auth shipped / PR19; 095 identity lifetime shipped / PR24; 094 provider-readiness draft                                                                                          |
| I     | Refund, transfer and card-repayment classification                              | Ledger/schema proposal where required                                                                                                                                                |
| J     | Local PDF extraction, side-by-side editable review, mobile/keyboard and cleanup | Draft079; dependency approval required                                                                                                                                               |
| K1–K4 | UOB, DBS, Citibank and HSBC adapters                                            | Verify each variant with synthetic/public fixtures                                                                                                                                   |
| L     | Import duplicate checks, explicit save selection and outcome summary            | A/B plus defined import identity                                                                                                                                                     |
| M     | Merchant names and categorization rules                                         | Scoped persistence contract                                                                                                                                                          |
| N     | Historical dividend scan and entitlement boundaries                             | 090 historical estimates shipped / PR20; 097 ledger readiness / PR25 and099 provider failures / PR27 shipped; actual evidence O/P                                                    |
| O     | Authorized dividend evidence source/payment dates                               | Draft080; verified provider permission                                                                                                                                               |
| P     | Expected versus received dividends and statement reconciliation                 | Separate event/status persistence contract                                                                                                                                           |
| Q     | Statement/record balance reconciliation                                         | Explicit currencies/account coverage                                                                                                                                                 |
| R     | Confirm-to-save recurring templates and bills/subscriptions calendar            | Encrypted schedule/occurrence contract                                                                                                                                               |
| S     | Budgets, recorded spending and annual reserves                                  | Reuse monthly-review calculations                                                                                                                                                    |
| T     | Monthly closing checklist                                                       | 100 derived review steps shipped / PR28; certification/closing state separate, no duplicate ledger                                                                                   |
| U     | Encrypted revision history and undo                                             | Atomic append/retention/schema approval                                                                                                                                              |
| V     | Explain totals using contributing records and assumptions                       | 102 contributing records shipped / PR30; reuse existing histories                                                                                                                    |
| W     | Liabilities and repayment details                                               | Define schema and net-worth contract                                                                                                                                                 |
| X     | Personal goals                                                                  | 096 shared-goal completion fixed / PR23; private goal ownership/persistence remains separate                                                                                         |
| Y     | Named planning scenarios                                                        | 103 shipped / PR33; exact production SQL owner-confirmed 2026-10-10                                                                                                                  |
| Z     | Explain wealth changes and unresolved differences                               | Accurate flows and valuation prerequisites                                                                                                                                           |
| AA    | Investment concentration against owner targets                                  | Accurate currency/exposure data                                                                                                                                                      |
| AB    | Expense anomaly review                                                          | Suggestions only, explicit review                                                                                                                                                    |
| AC    | Financial timeline                                                              | Reuse source records                                                                                                                                                                 |
| AD    | Global search and quick actions                                                 | 106 personal-record search shipped / PR32                                                                                                                                            |
| AE    | Account archival with historical preservation                                   | Define account identity/lifecycle                                                                                                                                                    |
| AF    | Amount hiding for screen sharing                                                | Consumer/design proposal only; edit, chart, portal, accessibility and export proof required                                                                                          |

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
contracts. Snapshot spec083 is shipped after its distinct owner SQL confirmation and green updated-head CI.

## Stabilization milestone — verified 2026-10-11

Audit121 reconciles the owner-selected existing-page stabilization milestone after PR42 export disclosure, PR43 saved-relief consistency and PR44 combined equity/control/error-retry fixes. PR44 merged `03dadad7b1bfd835da4b597d68a7b8997621f0f3` from exact `b384ba3c07dc2a19540f8324819760c60f8eaab0` after required CI 38112259967 SUCCESS and preview checks; public production deployment SUCCESS was verified at 2026-10-11T04:44:26Z. Unchanged normal hooks passed 144 files / 1,476 tests, with S93.18% / B89.28% / F91.70% / L93.89% and stricter floors unchanged. No private production workflow was accessed.

The integrated actual Next synthetic observations cover selected existing saves/redirects, record edits/deletes, scenario draft isolation, household goal UI, public negative auth, server-rendered retry and mobile/control cases. Explicit fixed-memory identity/vault/actions/provider adapters and observed download, origin, accessibility and concurrency limits remain recorded in121. Nine final product overrides match merged source after explicit LF normalization; expected matrices and earlier fixture failures are not substituted for observations. E/F are qualified milestones rather than universal latency, security or accessibility completion.

Further feature delivery remains authorized in the recorded order after the remaining stabilization verification is resolved.118,109,079,091,080 and protected harness follow-ups retain their own scoped decisions; general go-ahead does not approve migrations, dependencies, crypto protocols or protected CI. The whole roadmap is incomplete. Continuation is not disabled merely because this bounded stabilization milestone is recorded. Governance126 separately changes verification timing only; unchanged normal hooks/full gates and exact-head green CI remain mandatory.

Vault route coverage remains a concrete assurance gap: the unchanged 125 coverage report gives `src/app/api/vault/route.ts` 79.34% statements, 77.08% branches, 71.42% functions and 80% lines. Existing tests cover GET/POST but omit exported DELETE and some authenticated failure paths; the route has no targeted file floor. Root selected separate prospective 127 test/config remediation with at least 81% in each route metric; production code/protocol stay unchanged. This is missing verification, not evidence of an exploit, and is not fixed or shipped by 121.

## Current stabilization delivery boundary — 2026-10-11

121 confirmation shipped in PR46 and127 vault lifecycle coverage shipped in PR47 after exact-head greenCI, independent source/document review and unchanged normal hooks.127 passed144 files / 1,486 tests with globalS93.52/B89.54/F91.76/L94.24 and vault-routeS96.73/B95.83/F85.71/L96.66; its exact 81% floor and incumbent stronger floors remain enforced. Production vault code/protocol is unchanged. Prior pending127remarks are historical; these two delivery items no longer block new-feature preparation.

The roadmap itself remains incomplete. Remaining synthetic/production/provider/recovery and financial-model boundaries retain their recorded qualifications;079dependency,109migration,091crypto/schema,080source/persistence and protected governance/CI decisions are not approved by this closeout. Amount-hidingAF remains a consumer/design proposal before implementation, including charts, portals, accessible content, editors and exports. Continue coherent approved batches and the final post-roadmap confirmation sweep; preserve the existing continuation schedule and do not create a duplicate.
