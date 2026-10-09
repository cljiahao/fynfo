---
id: '078'
status: shipped
shipped: 2026-10-09
impl_pr: https://github.com/cljiahao/fynfo/pull/12
created: 2026-10-09
author: Codex
---

# Expense split validation and exact-cent allocation

## Authorization and evidence

Clarence's audit request and roadmap072 authorize this reversible correction
under constitution §7.4. Shared expense saves currently accept allocations above
the bill. The split dialog independently rounds equal shares: paid-for splits of
10.01 among three people total10.02, while10.00 totals9.99. Its paid-for summary
claims zero personal cost even when custom allocations leave a remainder.

## Recorded paths and contract before implementation

Update expense `schemas.ts`, new `lib/split-amounts.ts`, `components/split-dialog.tsx`,
expense action/dialog and arithmetic tests, README and roadmap progress. Keep
the existing server action's validation before auth/encryption/database calls.
Shared allocations must be finite, nonnegative, safely representable in whole
cents and total no more than the bill, using the monthly-review cent rounding
convention. Self expenses retain their existing ignored-child behavior. Allocate
equal shares in integer cents, assigning remainder cents in existing list order;
when splitting with the owner, the owner's share is the last allocation.
Preserve people, settlement flags and manual edits. Show actual remaining personal
cost in both modes. Disable confirmation with a visible corrective message for
invalid allocations; server validation remains authoritative. No automatic
rewriting of historical records, dependency, migration, crypto or protected edit.
Preserve auth/vault/RLS contracts (§2.1–§2.3, §3, §5).

Second-pass scope before editing: also update `components/editable-expense-row.tsx`
and `test/features/expenses/expense-editing.test.tsx`. Reducing a shared bill via
Enter or debounced blur currently submits incompatible existing shares and gets
a generic mutation error. Use the same allocation check before these submissions,
show its corrective message and retain the edited draft. Do not change valid
blur timing, cancellation, cache rollback or dialog-confirm behavior.

## Acceptance and rollback

Prove excessive-allocation action and dialog regressions red on original code,
including zero database calls and preserved invalid draft. Test exact sums for
indivisible paid-for totals, tiny bills, owner sharing, valid manual remainders,
settled shares, self expenses, invalid numbers and safe-integer bounds. Review
README/comments and perform a second pass. Run project next-verify gates in the
isolated synthetic fixture with all coverage metrics above80% and stricter
floors unchanged. PR/merge only with green CI under standing owner authorization.
Revert code to roll back; stored records are unchanged. Existing atomic-save,
concurrency, historical invalid-spending and recovery work remains open.

## Guidance

Use inspected next-verify gates and Impeccable harden/craft-floor guidance:
visible errors, input preservation, accessible controls and truthful summaries
within incumbent dialog tokens. No new visual world or skill installation.
Previously unavailable templateCentral/frontend-design skills are not invoked.

## Results and second review

Four regression cases failed before their corresponding fixes: server boundary
accepted excessive combined shares, dialog allowed confirmation, paid-for equal
shares exceeded10.01, and lowering the inline bill submitted excessive shares.
All now pass. Ignored stale splits on self expenses still do not produce child
inserts. Settlement flags survive allocation and settled amounts remain included
in budget checks. The shared helper contains no auth/data access. README and
concise comments describe cent ordering without claiming atomic saves.

Final isolated gates pass113files/880tests:92.95%lines,92.69%statements,
90.19%functions and87.57%branches; stricter security thresholds are unchanged.
Formatting, lint, route logging, typecheck and optimized build pass. Unchanged
commit/push hooks also passed. A standalone preview of the real
split component with compiled app styles passed desktop1280x720 and mobile390x844
checks: visible invalid-total warning/disabled confirm, exact-cent paid-for
allocation, actual manual remainder, named fields and successful confirmation.
No authentication bypass, production browser access or confidential data. This
component preview does not establish full authenticated browser workflows.

No migration, new dependency, crypto change, protected path or historical data
rewrite. Transactions/concurrent revisions remain pending draft077 approval.

PR12 merged on2026-10-09 after all CI/preview checks passed, as
8f1da30b8922180d938fbb8ef8cf85b1d94c0b86.
