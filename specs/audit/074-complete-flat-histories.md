---
id: '074'
status: owner-authorized-remediation
created: 2026-10-09
author: Codex
---

# Complete flat financial histories

## Authorization and evidence

Clarence authorized whole-project audit/remediation and the roadmap072 on
2026-10-09. This batch corrects truncated existing read contracts under
constitution §7.4; it is not a new feature or migration approval.

Salary, trade, dividend and tax-relief history actions issue a single unbounded
select. Export reuses those actions. Server row limits can truncate histories
without an application error. [Supabase range](https://supabase.com/docs/reference/javascript/range)
uses inclusive zero-based offsets and requires deterministic ordering.
[PostgREST pagination/count](https://docs.postgrest.org/en/v14/references/api/pagination_count.html)
supports exact counts and may return fewer rows than requested.

## Affected paths and contract

Add `src/lib/read-all-rows.ts`; update existing salary/relief/equity/dividend
actions, `test/helpers/fake-supabase.ts`, pagination/action regressions, README
and roadmap progress. Preserve public return shapes, authentication then vault
gate, owner filters, RLS and encrypted-field opacity (§2/§3/§5). No protected
files, dependencies, migrations or cryptographic changes.

Fetch bounded500-row pages with an exact count and unique ID tie-break order.
Advance by actual returned rows, not requested size, so lower server limits do
not truncate. Require a stable valid count and reject missing/empty/oversized
pages instead of yielding a partial list. All callbacks construct a fresh
builder with unchanged owner/year filters. Propagate opaque errors; no private
row values are logged. Do not sort encrypted fields.

## Acceptance and rollback

Synthetic fixtures over1000 encrypted rows for each flat history must return
all records, including the final record. Verify inclusive ranges, lower server
limits, deterministic tie-breaks, filters on every page, no extra request after
exact completion, empty histories and late failures. Prove a large-history
action regression red on original source. Preserve test helper behavior when
range/count are unused; its server-limit simulation must not fabricate complete
responses to unpaginated queries.

Run full gates in the isolated nonsecret fixture, preserve every existing
coverage threshold and >80% aggregate metrics. Review consumers/comments/README
again before PR; merge only on green CI. Revert code to roll back; no data change.

## Residual limitations

This is flat-history batch A. Snapshots/asset entries, expenses/splits,
distinct-person reads and household goals/contributions require their own paged
relationship contract next. Do not claim whole export completeness yet.
Offset pagination is not a transactionally consistent point-in-time backup:
same-count concurrent replacements can escape detection. Exact counts cost DB
work; no latency improvement is claimed. Snapshot-consistent export requires a
separately approved database contract if needed.

## Guidance and results

Use current primary Supabase/PostgREST contracts. This backend batch does not
invoke frontend design or install unavailable templateCentral skills. Existing
Fynfo deviations and secret exclusions remain binding.

Consumer comment review also affects `profile/hooks/use-export-data.ts`: replace
the claim of a complete JSON backup with its actual decrypted personal-vault
export contract. This changes documentation only, not export behavior.

Final isolated gates pass:110files/840tests;92.86%lines,92.63%statements,
90.08%functions,87.11%branches. Existing coverage floors remain unchanged.
Formatting, route logging, lint, typecheck and optimized synthetic build pass.
The original salary regression returned125rows instead of1203; all affected
domain regressions now pass. No real env files or confidential records accessed.

Second review verified inclusive ranges, actual-length advancement, fresh
builders and filters on every page, unique plaintext tie-break ordering,
exact-count failure handling and export consumers. The test helper preserves
nonpaged response shapes and separately verifies range/count/server-limit
semantics. README and export comments explicitly retain nested-history and
point-in-time backup limitations. PR/green CI integration is still required.
