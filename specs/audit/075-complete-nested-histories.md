---
id: '075'
status: shipped
shipped: 2026-10-09
impl_pr: https://github.com/cljiahao/fynfo/pull/10
created: 2026-10-09
author: Codex
---

# Complete nested financial histories

## Authorization and evidence

Clarence's audit/remediation request and approved roadmap072 authorize this
existing-contract correction under constitution §7.4. Snapshot and expense
reads embed children in an unbounded parent request. Household goals and
contributions each use one unbounded request, with all goal IDs in one URL.
Distinct-person suggestions also depend on an unbounded embedded read.

[Supabase range](https://supabase.com/docs/reference/javascript/range) is
inclusive and requires deterministic ordering. [PostgREST embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html)
documents foreign-key joins and `!inner` filtering of root rows through a
related parent. Paging parents does not prove child completeness.

## Paths and contract before implementation

Update asset snapshot, expense and household goal actions, their action tests,
new nested-history regressions, `test/helpers/fake-supabase.ts` and helper tests,
README and roadmap progress. Reuse `src/lib/read-all-rows.ts` with exact counts,
bounded pages and unique plaintext ID ordering. Preserve DTOs, authentication
then vault/household key gates, encryption and RLS (§2/§3/§5).

Read parents and children separately. Personal child pages use an inner parent
join with owner filtering on every page, avoiding unbounded ID lists. Single
snapshot children use the ID of the owner-verified parent. Household contribution
pages use bounded goal-ID batches of100 from the already membership-RLS-scoped
goal list; membership RLS also applies to every contribution page. Group rows
in memory, without sorting ciphertext. Missing parents skip child reads.

Extend the test helper only to record selects and drive per-table late read
failures. Update embedded fixtures to actual parent/child table fixtures rather
than fabricating joins or bypassing server limits. No dependency, migration,
crypto or protected-file edit is involved. Backend work uses authoritative
query contracts; it does not invoke unavailable templateCentral/frontend skills.

## Verification and rollback

Prove large-history regressions red on original source; test more than1000
parents and more than1000 children on one parent, lower server caps, final
records, grouping, every-page owner/ID filters, stable ordering, distinct people,
absent parents and opaque later child failures. Review existing consumers,
README and comments and perform a second pass. Run all quality gates in the
isolated synthetic fixture with all coverage metrics above80% and existing
stricter floors unchanged. PR/merge only after green CI. Revert code to roll
back; no stored data changes.

## Limits

Separate paged requests are not a transactionally consistent export. Count
changes fail closed, but equal-count concurrent edits can escape detection.
Counts and extra child requests cost work; no latency improvement is claimed.
Export still excludes household data and has no proven restore. Atomic saves,
revision/conflict handling and backup contracts remain later scoped work.

## Results and second review

All isolated gates pass:111files/853tests,92.90%lines,92.66%statements,
90.12%functions and87.44%branches. Coverage floors are unchanged. Formatting,
route logging, lint, typecheck and optimized build pass. Original action code
failed11of12new regressions; capped parent/contribution reads returned125of1003
rows. Single-snapshot testing also models capped embedded children separately
from the complete child-table fixture. The new helper records query contracts
and late failures; it does not simulate RLS or execute PostgREST joins.

Second review checked existing foreign keys and child-owner/household-membership
RLS policies, every-page filters, fresh builders, plaintext unique ordering,
grouping and contributor identity. Empty histories skip child reads. Later child
failures reject the whole result. Snapshot entry decryption is shared by single
and history consumers. Mutations, schemas, keys and public DTOs are unchanged.
README now describes independently paged children and preserves concurrent-edit,
household-export exclusion and recovery limitations. Export action failures
still prevent download. No private records or real env contents were accessed.

These fixtures establish application paging and query construction, not a live
authenticated browser walkthrough or database query replay. No performance
gain is claimed. PR10 merged on2026-10-09 after every CI and preview check passed,
as3c5554c89207f15c16f2554b9fefc697829b63f1.
