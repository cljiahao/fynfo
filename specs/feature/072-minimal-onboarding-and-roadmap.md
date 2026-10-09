---
id: '072'
slug: minimal-onboarding-and-roadmap
area: feature
status: approved
author: Codex
created: 2026-10-09
approved: 2026-10-09
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§2.5'
  - '§4'
  - '§5.1'
  - '§7.4'
constitution_overrides: []
---

# Spec 072: Minimal onboarding and confirmed improvement roadmap

## Problem

First-time vault creation resembles unlock, optional planning controls compete
with basics, and some financial estimates silently use default profile inputs.
The owner approved the features/improvements in the confirmation review and
delegated routine product decisions on 2026-10-09: “go ahead with all the features
and improvements you found ... make decisions for me to the best of your ability”.
This records conversational owner approval, not agent approval.

## Constitution check

Preserve the existing Supabase, encrypted payloads, PIN derivation and vault
throttling contracts (§2/§5). Client components are justified by forms, query
state and disclosure interaction (§2.5). Pages remain feature compositions.
No HARD rule changes or SOFT overrides. The broader roadmap remains constrained
by the separate approval requirement for dependencies, migrations, crypto and
protected paths; this spec does not authorize those operations implicitly.

## Solution shape

Use `docs/audit/2026-10-09-onboarding-confirmation.md` as the approved product
direction. Keep ordinary controls visible, optional settings in named disclosure
sections, and required warnings/errors outside tooltips.

Batch A affects `src/app/api/vault/route.ts`,
`src/features/auth/components/vault-unlock-flow.tsx`,
new `src/features/auth/hooks/use-vault-status.ts`,
`src/features/assets/components/planner-inputs.tsx`, overview feature composition,
salary profile-readiness presentation, their tests, README and audit docs:

- Add authenticated, no-store GET vault lifecycle metadata (initialized boolean
  only). Do not return canary, keys or profile. Fail closed on read errors.
- Create PIN explicitly with confirmation for new vaults; returning unlock keeps
  its existing contract. State discovery failures block submission and offer
  Retry. Existing POST race protection remains the final authority.
- Replace synthetic percent progress with truthful unlock/loading stages.
- Offer a dismissible first-record prompt using existing routes, not a wizard.
- Group optional reserve controls under “Adjust reserves”, preserving edits and
  an always-visible summary. Keep salary/expense inputs visible.
- Mark profile-based tax estimates unavailable/incomplete instead of presenting
  defaults as known inputs. Preserve income summaries and existing math until
  statutory rules are verified in the accuracy batch.
- In `profile/actions/profile-actions.ts` and `assets/actions/planner-actions.ts`,
  distinguish missing optional rows with `maybeSingle` from failed reads. Both
  currently return null on database failures, preventing query error handling
  and allowing default presentation/partial export. Action regressions must
  prove opaque rejection while genuine missing rows remain null.

Later coherent batches: monthly review and confirm-to-save recurring templates;
complete history reads; concurrent/retried save safety and atomic child
replacement; quote/currency/statutory accuracy; measured latency; synthetic
browser coverage; backup/restore proof; budgets/reserves, scenarios and revisions
only where they reuse existing capabilities. Record each affected-path contract,
tests and rollback before editing. A batch needing a migration/dependency or
cryptographic contract change requires its separately scoped approval.

## Out of scope

No real account access, secret reads, bank sync/upload, automatic payments,
financial advice, PIN derivation changes, unapproved dependencies or harness/CI
edits. Do not promise PIN recovery or working restore from the current export.

## Acceptance

- Authenticated lifecycle metadata never exposes encrypted checks or credentials;
  unauthenticated/error reads cannot initialize or authorize submission.
- New PIN mismatch saves nothing; valid confirmed creation invokes existing
  POST; returning users unlock without a creation questionnaire.
- First-record prompt is skippable and absent with recorded data.
- Collapsing reserve controls preserves edits and communicates current settings.
- Missing/pending/failed profile never produces an apparently complete tax
  estimate; retry/edit-profile remains discoverable.
- Meaningful synthetic regressions; above 80% aggregate coverage in every metric
  with existing stricter configured floors preserved.
- `pnpm check`, `pnpm test:ci`, `pnpm build` pass in an isolated synthetic fixture;
  README/comments reviewed and second review recorded before PR/merge.

## Risk & reversibility

Batch A changes first-use UI and authenticated lifecycle metadata, not stored
payloads or derivation. Existing race-safe POST remains authoritative; lifecycle
reads can become stale and must not replace POST verification. Revert code to
back out. No data rollback is necessary. Later batches record their own risks.

## Open questions

Routine UX choices are delegated to the agent. Recovery provider configuration,
atomicity migrations and retention/revision schema require evidence and scoped
contracts; they are not silently implemented through this umbrella record.

## Results

Batches A/B are implemented. The final isolated synthetic suite passes108files/
813tests:92.82%lines,92.59%statements,90.03%functions,86.98%branches, with all
existing thresholds preserved. Formatting, route logging, lint and typecheck
pass. Optimized fixture build passes; final integration checks remain mandatory.
The umbrella roadmap is not shipped merely because these first batches merge.

Second review corrected two swallowed optional-read failures, moved lifecycle
fetching into the auth feature hook, checked first-record eligibility against
trades as well as other records, and corrected a test that asserted eligibility
before its real asynchronous trade read completed. Failed-read regressions were
proven red against the original actions. README and comments match the resulting
contracts. Source/DOM fixtures do not establish an authenticated live walkthrough
or real viewport QA. No production financial records were accessed.

## Batch B — monthly review

Affected paths: new `src/features/review/{index.ts,lib/monthly-review.ts,
components/monthly-review.tsx}`, overview composition, synthetic review tests and
README. Compose existing authenticated queries with no new route, table or
dependency. Summarize a selected calendar month: gross salary plus bonus, the
owner's expense share across all categories, and exact-month asset change.
Settlement changes collection status, not the owner's share. A missing previous
month must not produce an asset-change estimate against another arbitrary month.
Use minor-unit rounding for monetary aggregation. Do not label gross surplus as
net savings or assume missing records mean no real-world activity. Basic values
stay visible; source/assumption details use one accordion. Verify month boundaries,
shared splits, missing history, query failure/retry and navigation with fixtures.
Revert component/composition/math to back out; no stored records change.
