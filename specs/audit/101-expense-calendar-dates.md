---
id: '101'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies: ['§1.1', '§3.2', '§4.1', '§4.2', '§4.4', '§7.4', '§8.2']
---

# Expense calendar date boundary

## Owner scope and evidence

Clarence authorized ordinary accuracy/security remediation and continuing parallel work. This bounded record uses §7.4 and does not approve a new feature, dependency, migration or encryption contract.

The expense schema checks an ISO-shaped string and Date.parse. JavaScript normalizes impossible dates such as February30 and April31, so the boundary accepts them before the save converts to an ISO timestamp. The isolated baseline proves four schema failures and one actual-action failure, with five valid controls passing. It does not establish that production stored an invalid row; database constraints may independently reject inputs.

## Paths and solution (recorded before implementation)

- src/features/expenses/schemas.ts: validate the literal first10 date characters with the installed Zod4 ISO-date schema as well as the existing Date.parse check. Preserve accepted valid timestamp forms, offsets, original strings and save normalization.
- test/features/expenses/expense-calendar-dates.test.ts: impossible dates, leap-year and month boundaries, preserved date/timestamp values, and actual-action rejection before obtaining auth/encryption/database context.
- README.md: concise expense-calendar boundary contract.
- specs/audit/101-expense-calendar-dates.md: evidence and delivery results.

No historical rewrite, date canonicalization change, shared utility abstraction, database migration, dependency, protected edit or encryption change. Only expense write validation changes. No new inline narration comments are needed.

## Acceptance and rollback

Impossible date-only and timestamp prefixes reject; valid leap/month-end dates and supported timestamps retain their original schema values. Rejection occurs before context, encryption or DB work. Run all five existing gates with aggregate coverage above80% and unchanged stricter floors, then a fresh independent review. Revert the scoped commit to restore the old validation; no stored rows change.

## Guidance and open questions

Installed Zod4 ISO-date behavior was verified with synthetic values and researched against [Zod ISO dates](https://zod.dev/api#iso-dates). Project next-verify workflow retained; no UI change calls for design work. TemplateCentral is unavailable in this runtime and was not installed or claimed as used. README/comments reviewed for enduring contracts. No unresolved scoped implementation question.

## Results

The unchanged baseline failed five meaningful cases with five valid controls passing (101-lab/baseline.log). Corrected focused tests passed27 across the actual schema/action files (101-focused.log). All five gates passed in the isolated synthetic fixture:125files/1074tests and optimized Next16.3.8 build (101-gates.log). Coverage:93.42% statements,88.85% branches,91.00% functions,93.73% lines; all existing stricter floors passed unchanged. A fresh independent review found no blocker. The change has no visual UI behavior requiring separate browser proof.

Limits: timestamp normalization in the existing save remains unchanged; this validation does not establish a new timezone/accounting-day contract or rewrite legacy records. No production database or private records were accessed.
