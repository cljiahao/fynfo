---
id: '083'
area: fix
status: approved
created: 2026-10-09
author: Codex
approved: 2026-10-09
constitution_satisfies:
  ['§2.1', '§2.2', '§2.3', '§4', '§5.2', '§5.4', '§6.3', '§7.4', '§8.2']
---

# Snapshot compare-and-save and uncertain outcomes

## Evidence and delivery scope

Spec077 makes replacements atomic, but a stale editor can overwrite a newer
snapshot. Spec082 preserves dirty drafts; it does not compare database versions.
Start roadmap B with snapshots, then apply the verified pattern to expenses and
relief years in separate scoped batches. Do not add a generic revision-history
system or claim durable/exactly-once retry behavior.

## Approved additive migration

Create `supabase/migrations/20261009000001_snapshot_edit_revisions.sql`:

- Add `revision bigint NOT NULL DEFAULT 0` to `public.monthly_snapshots`.
  Existing snapshot IDs, months, children and ciphertext are preserved.
- Replace the existing spec077 snapshot RPC definition to increment this revision
  inside each successful transaction. Keep its signature/grants/RLS unchanged;
  legacy application saves still advance the version during deployment overlap.
- Add `get_asset_snapshot_for_edit(p_month text) RETURNS jsonb`: authenticated
  SECURITY INVOKER, empty search_path. Derive identity, validate month and return
  only the owner's parent/month, string revision and encrypted entries through
  one SQL statement snapshot. Return null for an absent owner record. Aggregating
  children in that statement must not inherit PostgREST embedded-row truncation.
- Add `replace_asset_snapshot_if_current(p_month text, p_original_month text,
p_new_id text, p_expected_revision text, p_expected_snapshot_id text, p_entries jsonb) RETURNS void`.
  Validate scalar/version and bounded JSON contracts before writes. Existing
  edits lock the owner's original parent and compare its revision before calling
  spec077's transaction. Missing/changed originals or occupied rename targets
  fail without modifying children. A create requires null expected revision and
  inserts the unique owner/month parent without a conflict UPDATE; if it already
  exists, reject rather than overwrite unseen data. Call spec077 using that
  created parent's month as the original, preserving the new ID. Any failure
  rolls back the new parent as well. Parent locking and the unique constraint
  must cover simultaneous first saves; an absent-row check alone is insufficient.
- Add `delete_asset_snapshot_if_current(p_month text,
p_expected_revision text, p_expected_snapshot_id text) RETURNS void`: lock the owner parent and reject a
  changed/missing version before cascade deletion.
- Revoke PUBLIC, anon and service_role execution on the new RPCs; grant only
  authenticated. No SECURITY DEFINER, table-grant/RLS relaxation, new dependency,
  ciphertext interpretation, crypto protocol or destructive data migration.
  Notify PostgREST to reload its schema cache after commit.

The database counter travels as a decimal string to avoid JavaScript bigint
precision loss. Counter overflow fails the transaction, never wraps. Direct
owner table writes remain an existing capability; this does not claim universal
conflict detection against writers bypassing the application RPCs.

## Application and UX paths

Update snapshot actions/types/hooks/form/table and narrowly required shared error
mapping, tests, README and roadmap records. Fetch edit data with the coherent
read RPC. Keep the baseline version captured when the form initializes; background
refetches must never attach a newer token to an older dirty draft. History carries
the parent revision for delete confirmation; child paging remains unchanged.
Require expected versions for edits/deletes, and map conflict errors to a safe
domain code without exposing database messages. Missing RPCs fail closed.

Preserve the draft on failure. Keep a concise visible explanation and explicit
reload/review action; discard only through an explicit choice. Avoid automatic
mutation retries and force-overwrite controls. After an ambiguous create failure,
refresh existence before enabling a new explicit save; never blindly upsert an
existing month. A repeated edit that already committed is safely rejected as
stale and resolved by reviewing the latest data, rather than replaying a write.
Impeccable Operate/harden guidance governs this small recovery flow.

## Acceptance and rollback

Fresh synthetic PostgreSQL tests: concurrent edits of one revision allow one
winner, concurrent creates allow one parent without unseen overwrites, stale
delete/rename and missing parents fail, child failure rolls back revision and
data, and anon/cross-owner/version-invalid inputs are denied. Exercise coherent
encrypted read/version pairs and unchanged legacy snapshot transactions.
Component regressions cover dirty baseline preservation, conflicts, uncertain
responses, reload choice, duplicate create, explicit navigation and redirects.
All gates, >80% aggregate metrics/security floors, second review and green CI.

Owner applies the reviewed additive migration before application callers merge,
as in spec077. A source revert remains compatible with the added column/functions.
Correct SQL forward only; no destructive rollback. Production execution remains
owner-only and no credentials or confidential records are requested.

## Recorded owner decision

On2026-10-09 Clarence answered “Approve implementation” to the scoped question
naming this revision column, authenticated read/compare-save/compare-delete RPCs,
legacy revision advancement and snapshot callers/UX. Implement after spec082
merges. Production migration execution remains owner-only and application merge
waits for confirmation that this distinct migration was applied. No unrelated
dependencies, crypto protocols or protected-file changes are authorized.

## Approved identity-bound comparison addendum

Second contract review found an ABA case: delete a month, then recreate it. Both
parents can have revision1, so a stale editor holding only month/revision1 could
modify the replacement. Parent IDs already differ; no extra column is needed.

Add an additional `p_expected_snapshot_id text` argument on both new compare
save/delete RPCs. The coherent edit read and history return the existing parent
ID, and callers capture/pass it with the baseline revision. Existing edits and
deletes require both identity and revision to match under the parent lock; new
creates require both expected values null. A replaced record conflicts even if
its counter equals the deleted record's counter. Add a synthetic delete/recreate
regression. This changes the approved new RPC signatures only, with the same
single revision column, invoker/RLS boundaries and unchanged ciphertext/keys.

On2026-10-09 Clarence answered “Approve identity-bound comparison” to the
scoped question naming these RPC parameters and callers. This extends the
recorded owner approval; no extra column, dependency or crypto change is approved.

## Scoped implementation and review evidence

The editor workflow is extracted to `src/features/assets/hooks/use-snapshot-editor.ts`
so draft initialization, baseline capture and recovery stay separate from form
markup. Existing action/hook/types/schema/form/table paths, profile's export hook
and their regression tests are consumers. SQL runner and dedicated revision SQL/
concurrency tests exercise the approved additive migration. No protected paths,
new dependency or encryption change is included.

Synthetic desktop/mobile browser inspection found the existing month header
compressed the title and overflowed at390px. Within the owner's reversible audit
scope (§7.4), stack that header on narrow screens and name account/amount/remove
controls accessibly; keep the desktop layout and essential fields visible.
Keep row and value subscriptions ahead of initialization during the extraction.
No application latency improvement is claimed. The preview stubs action/router
boundaries and does not prove authenticated browser transport or production data.

## Verification and second review results

Two conflict/baseline component regressions fail against shipped main: no baseline
is sent, and a conflict is treated as success without preserving a recovery state.
The verified implementation passes116files/906tests, all static gates and the
optimized production build in the isolated synthetic fixture. Coverage is93.00%
lines,92.62%statements,90.17%functions and87.92%branches; security floors remain
unchanged. Mutation retries stay explicitly disabled, including when the global
client default enables retries. Conflict results are serializable safe values,
not production-obscured thrown error messages.

Two successful fresh PostgreSQL17.10 replays cover authenticated invoker grants,
empty search_path, owner filtering, malformed revisions, stale/missing parents,
rename collisions, delete/recreate ABA, child-failure rollback including failed
creates, bigint precision/overflow and1501 children without embedded truncation.
Observed overlapping concurrent workers prove one create/edit winner and coherent
version/payload reads while writes are uncommitted. The final replay seeds a
legacy snapshot before the DDL and verifies preserved ID, timestamps and opaque
payloads with initial revision0. The earlier test-only quoting error was corrected;
it is not a migration or application failure.

The second review checked baseline/value capture, dirty/untouched/context changes,
subscription ordering, obsolete request completion after navigation, canceled
older in-flight reads, uncertain creates and rename recovery that verifies parent
identity before selecting a target. Delete confirmations retain their opened
version and block another attempt until explicit refresh. Export tests prove the
existing version2 snapshot payload excludes concurrency metadata. README and
comments match these contracts; no seeded harness path changes in this batch.

Impeccable Operate/harden and craft-floor guidance preserves existing controls and
visible material assumptions. Its unrelated credential/context checks remain
excluded by the owner's privacy rule. A synthetic action/router browser preview
confirmed stale-save draft preservation, explicit reload, assets return and
390px/desktop layouts in two bounded visual rounds. The final mobile page has no
horizontal overflow (scrollWidth/clientWidth both390). This component preview and
real SQL proof do not claim authenticated browser transport or production-record
verification. No measured application-latency improvement is claimed.

Contract research: [PostgreSQL17 row-lock behavior](https://www.postgresql.org/docs/17/transaction-iso.html),
[PostgREST text casts](https://docs.postgrest.org/en/stable/references/api/tables_views.html#casting-columns),
[Next.js returned expected errors](https://nextjs.org/docs/app/getting-started/error-handling).

Production application merge remains blocked until Clarence confirms applying
this distinct SQL file. The earlier spec077 readiness does not satisfy spec083.
Reload older open editors after rollout. Older deployments can still use the
legacy last-writer-wins RPC, which advances revisions but does not compare them;
direct table writers can bypass both comparison and advancement. Durable retries,
exactly-once outcomes and full revision history remain outside this batch.
