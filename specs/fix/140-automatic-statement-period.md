---
id: '140'
slug: automatic-statement-period
area: fix
status: owner-authorized
author: Codex
created: 2026-10-14
---

# Upload without entering a statement period

Owner explicitly requests monthly statement upload without manual from/to dates.
Owner-authorized onboarding remediation under CONSTITUTION §7.4 and AGENTS §1.5.

Scope: import-review period detection utility, review component, corresponding
synthetic parser/component/privacy/save tests and README. Existing PDF text is
already extracted locally; no new service, dependency, schema or crypto change.

Recognize explicitly labelled Statement Period, Statement Date and Statement Month
headers with full years. Never infer from current time, filenames, due dates or
unlabelled account/transaction numbers. Accept only one consistent date anchor or
range; invalid/conflicting headers require manual fallback. Explicit ranges stay
exact. A statement date/month supplies a conservative qualification window from
the first day of the preceding month through that date/month end. This is an
inferred transaction window, not a claim about the bank's exact billing-cycle start.
Older rows remain unresolved; retain actual transaction dates including year
rollover. Existing date-range validation and save guards remain authoritative.

Default setup asks for bank and PDF only. Keep date controls in a collapsed manual
override; reveal them when detection fails and retain the selected file for retry.
Show the detected basis within setup for correction. A new file clears inferred
period state so dates cannot leak between statements. Explicit manual input takes
precedence. Privacy hiding masks dates and cancels stale extraction as before.

Acceptance: explicit periods, named/numeric statement dates, statement months,
January rollover, leap dates, split labels, conflicting/invalid/no-year/due-date
headers, automatic upload, manual fallback and a second file with different dates.
Independent review, focused tests, all repository gates and a bounded synthetic
browser pass. Rollback is a code revert; saved expense shape is unchanged.
Sections: §2 gates/encryption retained; §3 existing stack; §4 tests/build; §5 only
synthetic evidence; §7.4 requested bounded improvement. No merge approval inferred
from the earlier completed release.

Independent review found that correcting dates after extraction discarded the
file needed for retry. Retain the selected PDF only in component memory until
clear/close or replacement; date correction can re-extract without another file
selection. Regression covers automatic extraction, correction, retry and clear.

Verification: 61 targeted parser, review, save and privacy tests passed. Independent
review confirmed its correction finding resolved with no outstanding blockers.
Synthetic desktop (1440px) and mobile (390px) browser checks verified collapsed
optional dates, automatic extraction, preserved comparison, direct correction
retry and clean reopen. Impeccable static detector reported no findings. No real
statement data was used in fixtures. Full build/coverage gates run before PR.
