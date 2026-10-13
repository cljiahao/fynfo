---
id: '139'
slug: uob-statement-review
area: fix
status: owner-authorized
author: Codex
created: 2026-10-13
---

# UOB extraction and quieter statement review

Owner-authorized remediation under CONSTITUTION §7.4 and AGENTS §1.5.
The owner reported missing SGD billed values, a second date in descriptions,
and an overloaded review modal. They supplied a screenshot showing separate Post
Date / Trans Date columns, Description of Transaction, and Transaction Amount SGD.
Only synthetic counterparts may enter fixtures; do not copy the attachment,
personal/card details, reference numbers or actual purchases into the repository.

## Evidence and bounded changes

The parser strips one date only, recognizes a narrow global currency header,
and drops continuation lines after the first amount. Add a page-qualified UOB
two-date layout: use transaction date, remove both date prefixes, take the sole
amount on the main transaction line under the SGD column, and retain recognized
reference/foreign-currency continuation evidence. Keep ambiguous columns and
credits blocked. No guessed conversion or changes to stored expense shape.

The modal presents setup, long explanations, the PDF, full row classifications,
merchant tooling and source notes at once. Preserve incumbent tokens and controls;
collapse setup after extraction and disclose secondary classification/rule tools
per row. The owner's follow-up explicitly requests Impeccable refinement with
side-by-side comparison: desktop shows the PDF beside editable rows; mobile keeps
a view switch. Focusing a row shows its source page and excerpt. Keep source
comparison outside secondary details, with quiet selection styling and independently
scrollable desktop panes. Keep blockers, save outcomes, duplicate confirmation, privacy guards and
explicit saving visible and functional. No dependency/schema/crypto changes.

Affected files: import-review parser/components; corresponding parser, review,
privacy and import integration tests; README if wording requires correction.

## Acceptance and rollback

Synthetic UOB rows cover two dates, split headers, foreign amounts beneath SGD,
credits, summaries, page boundaries and unsupported ambiguity. Existing bank
fixtures remain valid. UI checks cover collapsed secondary information, inline
editing, source navigation, source-note preview, rules, privacy and explicit save.
Run meaningful regressions, normal quality gates and independent review. Inspect
desktop/mobile in one bounded visual pass, fix findings together, confirm once.
Rollback is a code revert; no data migration or stored record rewrite.

Constitution: §2 auth/encryption/mutations unchanged; §3 existing stack; §4 tests
and build; §5 no private fixture data; §7.4 bounded owner-requested remediation.
Publication/merge of this follow-up is not covered by the earlier release merge.

## Verification record

85 focused parser/review/import/privacy tests passed, including positioned PDF
text through row reconstruction. Independent read-only review found no blocking
issues and recommended that positioned-text regression, which was added.
Synthetic desktop/mobile UI checks passed; 390px document width and scroll width
both 390px, modal width and scroll width both 341px. Explicit selection, duplicate
review and one confirmed save were checked against memory-only actions. Setup,
rules and per-row secondary details collapse; blockers remain visible. The
fixture server was stopped. Full gates follow before publication is proposed.

## Side-by-side refinement verification

The owner requested original PDF comparison remain visible while simplifying the
review. Desktop now uses two independently scrolling panes; the source page and
excerpt follow the focused draft. Compare source stays beside Include expense.
Mobile retains the Statement / Extracted view switch. Setup and saved rules share
a compact toolbar; descriptions have more width than billed amounts.

A bounded synthetic browser pass confirmed row editing, source tracking, mobile
comparison, duplicate review and one confirmed memory-only save. At 390px, document
and scroll widths were both 390px; modal widths were both 341px. Desktop panes had
equal client/scroll widths of 517px. Screenshots contain synthetic data only. The
preview server and browser tab were closed after verification. The Impeccable static
detector reported no findings.

Independent review identified initial source-page mismatch when transactions start
after a cover page. Initialize from the first candidate's source page and cover it
with a regression. Reviewer confirmed the finding closed with no other blockers.
Source navigation remains page plus excerpt; no precise PDF bounding-box highlight
is claimed. This follow-up has not been published or deployed.
