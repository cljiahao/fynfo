---
id: '141'
slug: expense-review-simplification
area: fix
status: shipped
shipped: 2026-10-14
impl_pr: https://github.com/cljiahao/fynfo/pull/61
author: Codex
created: 2026-10-14
---

# Simplify expense entry, statement review and spending comparison

Owner requests less scrolling/clutter, focused restore/rule dialogs, compact date
fields, repayments hidden by default, bulk expense selection and clearer PDF entry.
Follow-up requests integrate the separate spending-review panel with the chart.
Owner-authorized UI remediation under Constitution §7.4 and AGENTS §1.5.

Scope/inventory: import-review component and save hook own draft UI/selection;
merchant rule components own suggestions/editor; expense-entry owns quick-add/reuse;
expense-table currently owns misplaced PDF trigger; chart and anomaly-review own
monthly visualization/comparison; expenses page composes these. Corresponding
synthetic tests and README are included. No dependencies, schema, crypto or
protected-file changes. No change to save eligibility, refund accounting, 20-item
batch maximum, duplicate checks, retry identities or anomaly calculation.

Batch: bound the review dialog, fit the PDF page and scroll drafts; repayments
remain recoverable through filters. Filters show expenses/review-needed, refunds,
expenses+refunds and all rows. Bulk select only valid unsubmitted expense rows
in the filtered result; cap at 20 and label larger sets Select next 20 expenses.
Info popovers retain explanations, while actionable field errors stay visible.
Restore dialog compares current description/category with extracted description
and initial Other category; explicit confirm only. Rules open in a dialog.
Quick add / Import statement toggle preserves the manual draft; reuse switches
back to quick add. Source comparison remains page navigation (no coordinates
retained); no inaccurate highlight is drawn. Date inputs retain native keyboard
and calendar support at compact widths.

Spending review becomes Compare months in the chart. Explain purpose and show
results in a dialog, keep calculation/availability detail on demand and retain
history readiness, mutation and privacy invalidation. No recommendation claims.
Research: https://www.nngroup.com/articles/onboarding-tutorials/ and
https://www.nngroup.com/articles/progressive-disclosure/ support contextual help
and separating primary workflow from optional detail.

Acceptance: synthetic filter/bulk eligibility+limit+privacy tests; restore preview,
cancel/confirm and rule modal; quick-add draft retained across toggle; spending
comparison integration/readiness/privacy; bounded desktop/mobile browser QA,
independent review and required repository gates. Rollback: revert this change.
Constitution §2 encryption/auth retained; §3 existing stack; §4 tests/build;
§5 synthetic data only; §7.4 scoped remediation. Prior merge approval was for140.

## Verification record

81 focused tests across statement review/save/privacy, rule suggestions/editor,
spending comparison and expense reuse passed. Independent review found and
verified fixes for reuse focus before visibility, rule-dialog return focus and
compact-date sizing at the 1024px breakpoint. No remaining source-review findings.
Desktop synthetic browser check confirmed viewport-bound dialog, full-page PDF,
scrolling drafts, bulk selection, restore preview, rule editor and chart comparison.
Real browser reuse focus was verified. Impeccable detector reported no findings.
Mobile interaction verification is pending: a native confirm from an earlier
synthetic rendering blocked browser input. The redundant rule-close confirmation
has since been removed; closing retains the draft. No personal statement data
was used. Full repository gates run before PR.

The first full coverage run passed 2055 tests and exposed two harness issues:
the chart totals test lacked the query provider required by its new comparison
child, and the dense 21-selection test exceeded its 10-second allowance. Added
a disabled-query provider to that isolated chart test and raised only the dense
test's allowance to 20 seconds, retaining every assertion. Both files passed
all 29 tests with V8 instrumentation; aggregate coverage requires the full suite.

Final verification: all 2057 tests across 182 suites and every local gate passed.
CI and Vercel preview passed for commit 0d7eb58. A fresh synthetic browser cleared
the stale prompt; mobile checks at 390x844 passed for entry, extraction, default
repayment exclusion, bulk selection, full source-page fit, rule dialog open/close
and restore preview/confirmation. Owner authorized merge on 2026-10-14; PR61
merged as 84b82a7. No schema application was required.
