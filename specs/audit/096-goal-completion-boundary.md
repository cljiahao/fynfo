---
id: '096'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies: ['§1.1', '§3.2', '§4.1', '§4.2', '§4.4', '§7.4', '§8.2']
---

# Goal completion uses the monetary target

## Owner scope and evidence

Clarence authorized ordinary codebase accuracy remediation and confirmation reviews; root coordinated this bounded batch on2026-10-10. Source basis is merged main68106d5f33fd060cd403a30e5950018f25475776. This record documents §7.4 authorization, not approval for new features or persistence contracts.

computeGoalProgress rounds whole display percentages: target100 with contributed99.5 returns pct100 and remaining0.5. GoalCard uses pct>=100 for Funded/Goal reached, incorrectly hiding the outstanding amount. Its sole completion consumer is GoalCard; getGoals uses the helper for contributed/remaining/display percentage. Creation schemas already require positive finite target and contribution values. Intl currency formatting rounds presentation, not the stored monetary contract.

## Paths and proposed change (recorded before implementation)

- src/features/household/components/goal-card.tsx: determine completion from finite contributed and finite positive target with contributed>=target. Keep displayed percentage unchanged, with no float tolerance or new rounding protocol.
- test/features/household/goal-card.test.tsx: mounted regression using the actual progress helper, exact/overfunded/zero/nonfinite boundaries and near-target decimal evidence.
- test/features/household/household-workflows.test.tsx: replace the existing impossible zero-target/pct100 Funded fixture with a valid reached target; preserve workflow coverage.
- README.md: concise statement that rounded progress does not establish completion.
- specs/audit/096-goal-completion-boundary.md: scoped evidence/results.

No schema, cryptography, auth, dependency, protected-file, progress-bar layout or household ownership change. Existing dynamic inline-width styles are separately recorded drift; this batch does not introduce or expand them. No helper extraction: only one actual completion consumer exists.

## Acceptance and rollback

The99.5/100 mounted regression must fail before the status fix; corrected output retains0.50 to go and omits Funded/Goal reached. Exact and overfunded positive finite targets remain funded. Zero/negative/nonfinite targets or nonfinite totals do not claim completion. Preserve existing percentage/remaining math and contribution controls. Run formatting/lint/typecheck, full test:ci and production build in the isolated synthetic fixture, retain every coverage metric above80% and stricter existing floors, then independent review. Single scoped revert restores prior UI status; no stored rows change.

## Skills / documentation

Impeccable harden and craft-floor guidance applied to truthful boundary states in the incumbent Operate interface. Context discovery was already reviewed earlier in this session and restricted for privacy; it is not rerun. Existing project verification workflow retained. TemplateCentral/frontend-design were unavailable in this runtime; no substitute installation or skill edit. README and inline comments reviewed; no new narration comment needed for the direct predicate.

## Results

Baseline mounted tests failed5 of11 cases on the unchanged card (096-baseline-proof.log); corrected focused tests passed30 across3 files (096-focused.log). All five gates passed in the isolated fixture: check (format/lint/typecheck), test:ci121 files/997 tests, and optimized Next16.3.8 build (096-gates.log). Coverage: statements93.20%, branches88.60%, functions90.76%, lines93.50%; existing stricter floors passed unchanged. Fixture source/test filenames match tracked source plus the named new regression. Root and a second independent reviewer found no scoped blocker. Low-impact status behavior is proved with the mounted actual card/helper, with no new layout or controls requiring separate browser preview.

Remaining limits: percent is still rounded presentation and can display100% before completion; the actual remaining amount stays visible. Subcent remaining values can display0.00 under the existing currency formatter. Invalid legacy/nonfinite derived amounts may still display invalid currency/progress; this batch prevents a completion claim, not every historical-data readiness defect. Existing dynamic inline styles remain separately recorded drift. No exhaustive audit, performance gain or household backup claim.
