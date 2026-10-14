---
id: '142'
slug: automatic-merchant-rules
area: fix
status: owner-authorized
author: Codex
created: 2026-10-14
---

# Simplify rule editing and apply matching rules to drafts

Owner-authorized remediation under Constitution §7.4 and AGENTS §1.5: remove
the confusing source-note preview, align classification and modal actions,
clarify rule fields and automatically apply saved rules to similar draft rows.

Inventory: statement-review owns row rendering and edits; merchant-rule-manager
owns the editor; merchant-suggestion owns conflict choices; matching and draft
helpers own deterministic matching and manual precedence. Existing tests cover
these components, privacy, duplicate checks and interrupted saves. README records
the import contract. No dependency, schema, encryption or server action changes.

Batch: remove only the source-note preview control (retain the saved audit note);
put classification, restore and create-rule controls in one wrapping row. Order
rule fields as name/bank, matching words/type, merchant/category. Explain the
separate management name and expense item, use exact/contains words terminology,
default new rules active and expose active/paused control when editing.

Automatically apply only confirmed, unambiguous saved rules to unsaved draft
fields that have not been manually edited or restored. Preserve immutable source
matching, locked save attempts and duplicate-review invalidation. Conflicts keep
explicit choice; auto-application never saves expenses. Rule deletion/pausing does
not silently restore draft values. This owner request supersedes the earlier
per-row Apply interaction; financial persistence contracts remain unchanged.

Acceptance: regressions for all matching rows, new saved rules, manual/restore
precedence, conflicts, privacy, frozen attempts and duplicate checks; compact
desktop/mobile browser inspection; required gates and independent review.
Rollback: revert this change. Constitution §§2–5 security/quality invariants
retained. Impeccable distill/craft-floor applied within the incumbent UI.

## Verification

51 focused tests across six suites passed. Independent review found that an
explicit conflict choice needed manual-field protection against later rulebook
changes; fixed and covered by a choose-B/pause-B regression. Reviewer confirmed
the fix and reported no remaining blockers. Synthetic browser checks at 1280x900
and 390x844 confirmed compact row controls, field order, retained match preview,
active-rule editing and automatic updates to both matching expense drafts.
Source comparison remains page-only. No private statement data used. Full normal
commit/push gates run before PR; this change is not yet merged.

## Owner-requested label clarification

Owner confirmed keeping six rule inputs and separating per-expense notes from
rule output. Rename Merchant name to Item / Brand in the editor and Description
to Item / Brand in PDF review/restoration; align conflict replacement copy and
README. Rule name remains a management label. No data mapping changes or extra
inputs. Update existing label-based regressions and run normal gates. Rollback:
revert this copy-only batch.
