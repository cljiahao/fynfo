# Fynfo Project Audit + Spec Roadmap

**Date:** 2026-06-02
**Scope:** whole repo — `src/features`, `src/lib`, `src/integrations`, `src/app`, `src/components`, `test/`, tooling, `.claude/**` harness.
**Method:** 4 parallel read-only audits. Priority framework: accuracy → security → quality (SRP/SoC/DRY/YAGNI/SOLID) → SDLC.
**Status:** findings + roadmap only. No code changed. Each roadmap item becomes its own spec → impl cycle (direct-to-main, PR ceremony waived).

---

## Scorecard

| Area                    | Verdict                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Security (vault/crypto) | **Needs work** — 1 critical gap (no PIN-unlock rate-limit), several MED hardening items                          |
| Architecture (RSC/SRP)  | **Drifted** — 5/6 dashboard pages fetch data in-page; 5 oversized multi-responsibility components                |
| DRY                     | **Drifted** — encrypt/decrypt loop, cookie seal, business helpers each duplicated 2–5×                           |
| Test coverage           | **Thin** — crypto/keystore/guards/actions all untested; no thresholds; component testing blocked by missing deps |
| Harness/config          | **Mostly sound** — 1 latent guard bug, a few dead/over-broad grants, doc drift                                   |
| Encryption posture      | **Sound core** — AES-256-GCM + PBKDF2-600k correct; trust-boundary caveats below                                 |

---

## Findings by severity

### HIGH

1. **No rate-limiting / lockout on `/api/vault` PIN unlock** — `src/app/api/vault/route.ts:79`. DEK derives from a 6-digit PIN (~1M space). The 600k PBKDF2 work factor is **client-side**, so the server only does an AES-GCM decrypt per attempt and can be brute-forced unboundedly by anyone holding the Supabase session. **Single most important gap.**
2. **Client-side-only work factor + non-timing-safe canary** — `route.ts:65`. The pre-derived DEK arrives from the client; the server can't throttle by PIN and has no compensating control. Canary compare isn't `timingSafeEqual`.
3. **Expense hook invalidation inconsistency** — `src/features/expenses/hooks/use-expenses.ts:72,87,101`. `useDeleteExpense`/`useSettleSplit`/`useSettleMonthSplits` blanket-invalidate `EXPENSE_KEY`, undermining spec 011's optimistic contract and able to clobber the optimistic upsert cache.
4. **Broken error-boundary contract** — `src/app/dashboard/(overview)/error.tsx:8`. Invents a `refetch` prop Next.js never passes (dead branch) and omits the real `error` prop, so errors are never logged. Coverage also exists only for the overview group.
5. **Untested security core (no new dep needed)** — `crypto.ts`, `keystore.ts`, `action-guard.ts`, all 9 server actions, `handle-api-error.ts` have zero direct tests. These own confidentiality, key derivation, auth+vault enforcement, and DB-leak prevention. All node-testable today (template: `test/api/vault.test.ts`).

### MED

- **Crypto envelope duplicated** — cookie AES-GCM seal/open implemented twice and divergently (`route.ts:32` encrypt vs `keystore.ts:32` decrypt); drift silently bricks every vault. Cookie key is bare `SHA-256(SESSION_SECRET)` (unsalted single-hash).
- **`decryptPayload` trusts `JSON.parse` shape** — `crypto.ts:34`. No iv(12)/tag(16) length validation before `createDecipheriv`; blanket catch masks malformed-vs-tampered.
- **Per-row encrypt/decrypt loop duplicated 5×** — `snapshot/expense/salary/equity/relief`-actions each hand-roll `rows.map(async → decryptPayload per field)`. Extract a shared `decryptRows/encodeFields` helper (one tested place).
- **TOFU first-unlock seeding** — `route.ts:119`. First POST defines the vault key with no proof of PIN correctness; pre-emptive seeding risk. Upsert can overwrite an existing v2 canary.
- **Name-denylist log redaction** — `logger.ts:17`. Allow-by-omission; any new/renamed PII field logs in clear. Brittle for a zero-knowledge app.
- **5 oversized multi-responsibility components** — `investment-breakdown.tsx` (655), `expense-table.tsx` (643), `salary-planner.tsx` (545), `tax-reliefs-dialog.tsx` (454), `trade-form.tsx` (448). Each fuses pure business/parse logic + persistence (localStorage/mutations) + large JSX. Pure parts belong in `lib/` (testable, server-safe).
- **RSC boundary violated** — 5/6 dashboard pages (`overview/assets/equity/salary/expenses`) are `'use client'` and fetch data + own orchestration state, against AGENTS.md "pages compose from features, never fetch." Fix pattern: per-feature `*View` component; page = thin (ideally server) composition.
- **Duplicated business helpers** — `sumByCategory`/`sumCat` (2×), user-share rule (planner + owed-summary), date-normalization (quick-add + statement-parser, subtly different), fee-calc (trade-form display vs autofill).
- **Dashboard shell DRY** — page wrapper, header block, inline spinners, table skeletons copy-pasted across 5–6 pages → `DashboardPageShell` + `PageHeader` + parameterized `TableSkeleton`.
- **No coverage thresholds** — `vitest.config.ts:21`. v8 configured, nothing enforced → silent erosion.
- **Doc drift: test infra** — AGENTS.md §2 claims "Vitest + Testing Library + jsdom"; package.json has none and vitest is `environment:'node'`. Component/hook render tests impossible without new deps.
- **Harness grants over-broad** — `.claude/settings.json`: dead `Bash(npx prisma:*)` + `Bash(npx auth:*)` (Prisma/NextAuth removed), and `Bash(cat:*)` lets the shell read secret files.

### LOW

- **`trade-form` reset omits `isPO`** — `trade-form.tsx:73`. Stale P/O checkbox leaks between trades. (Concrete bug.)
- **`guard-destructive-bash.ps1` likely doesn't block** — `:37` uses `Write-Error` under `$ErrorActionPreference='Stop'`, which throws before `exit 2` (the exact bug spec-010 fixed in the sibling `guard-protected-paths.ps1` but missed here). Also shadows the automatic `$input` variable (`:9`). **This means force-push/hard-reset/branch-delete guards may be inert.**
- **Stale doc: legacy v1 PBKDF2** — AGENTS.md / CLAUDE.md describe `deriveKeyFromPin` (v1) in `keystore.ts`; it's already removed. Only v2 exists.
- **Dead/duplicate route** — `src/app/api/route.ts` byte-identical to `/api/health` with inconsistent auth posture.
- **Auth-check duplicated 3×** — `getUser()→throw` in `action-guard`, re-wrapped by `auth-guard`, re-inlined in vault route.
- **Gratuitous `async`** — `encryptPayload`/`decryptPayload` are async with no awaited work.
- **`TRUST_PROXY` is a boolean, not the documented host allow-list** — `request-origin.ts:16`. Host-header spoof if set permissively.
- **`tsconfig.json` excludes `tests`** (plural) — real dir is `test/`; stale/ineffective.
- **`build:standalone` uses `cp -a`** — POSIX-only; fails on the Windows dev host.
- **`regen-harness` skill** — `allowed-tools: Bash(python *)` is the loosest grant; writes a governance-protected file. Scope to a committed script.
- **a11y quick wins** — icon-only mobile-menu + avatar-dropdown triggers and the pagination number input lack accessible names.

### CLEAN / positive

- DEK ordering (`requireUserId` → `getVaultDekSession`) correct in every action; centralized in `action-guard.ts`.
- No `console.log`, `any`, `@ts-ignore`, or `getSession()` misuse in scope.
- ESLint/Prettier well-tuned (`no-explicit-any:error`, `endOfLine:auto`, custom rule blocking `new Error(supabaseError.message)`).
- `harness.json` valid; all 10 seeded paths resolve. `next-verify` skill is exemplary scoping. Ollama removal left no orphan deps.
- `resolveSplitConfirm` (spec 009) is the model extraction pattern others should follow.

---

## Spec roadmap (proposed — each its own spec → impl)

Ordered by value/risk. Governance-protected items (`.claude/**`, `AGENTS.md`) are flagged — those need a `specs/governance/` spec and your edit (human-only paths).

### Phase 0 — Housekeeping (1 small fix spec, mechanical)

`specs/fix/012-housekeeping`: `trade-form` `isPO` reset bug; `tsconfig` `tests`→`test`; remove dead `/api/route.ts`; `getDistinctPeople` wrong label + null guard. Low-risk, fast.

### Phase 1 — Security hardening (highest priority)

- `specs/security/002-vault-unlock-rate-limit`: server-side attempt throttle + lockout keyed to user id (sliding-window counter). **Needs a Postgres table + migration** (`supabase/migrations`). Biggest, most important.
- `specs/security/003-crypto-hardening`: `timingSafeEqual` canary; iv/tag length validation in `decryptPayload`/cookie decrypt; consider HKDF for the cookie key.
- `specs/security/004-cookie-seal-dedup`: extract one `sealCookie/openCookie` module used by route + keystore (kills drift risk). Pairs with 003.
- `specs/security/005-log-redaction-allowlist`: move redaction to allow-list + add a test asserting known-sensitive keys are censored.
- `specs/fix/013-trust-proxy-allowlist`: parse `TRUST_PROXY` into a real host allow-list (or rename/document as boolean).

### Phase 2 — Test coverage foundation (no new dep)

- `specs/fix/014-core-unit-tests`: crypto round-trip/tamper/wrong-key; keystore derivation vector + cookie tamper; `action-guard` unauthorized/locked/happy; `handle-api-error` leak-free mapping. (Ranks 1–5, node-only.)
- `specs/fix/015-action-tests`: server-action tests (mock supabase), prioritize expense + salary.
- `specs/fix/016-coverage-thresholds`: add `coverage.thresholds` to vitest, gate `lib/`+`actions/` higher than UI.
- `specs/governance/011-jsdom-rtl-decision` **(governance + new dep)**: decide whether to add `jsdom` + `@testing-library/*` to unlock the 30 components + hook render tests, with a second vitest project (node + jsdom). Your call (§0.4 hard stop).

### Phase 3 — DRY / SRP refactors

- `specs/refactor/001-crypto-list-helper`: shared `decryptRows/encodeFields` across all actions.
- `specs/refactor/002-expense-invalidation-contract`: one invalidation/optimistic contract for the expense hooks (resolves HIGH #3).
- `specs/refactor/003-extract-pure-logic`: pull parsers/relief-builders/budget-model/even-split/fee-calc out of the 5 oversized components into feature `lib/` (testable). Likely split per component.
- `specs/refactor/004-shared-business-helpers`: dedupe `sumByCategory`, user-share, date-normalize, fee-calc into feature `lib/`.
- `specs/refactor/005-rsc-view-extraction`: per-feature `*View` components; thin pages; `DashboardPageShell`/`PageHeader`/`TableSkeleton` widgets; fix `error.tsx` contract.

### Phase 4 — Harness / governance hygiene (governance specs — your edits)

- `specs/governance/012-settings-prune`: remove dead `npx prisma:*`/`npx auth:*` grants and `Bash(cat:*)` from `.claude/settings.json`.
- `specs/governance/013-guard-destructive-fix`: fix `guard-destructive-bash.ps1` block bug (`[Console]::Error.WriteLine` + `exit 2`) and `$input` shadow — **currently the destructive-git guard is likely inert.**
- `specs/governance/014-doc-drift`: AGENTS.md §2 test-infra correction + remove stale v1 PBKDF2 note.

---

## Dashboard slow-after-PIN (Track A, separate)

Still pending a **measurement spike** before any fix — do NOT build a summary/cache table blind (YAGNI + zero-knowledge tension; see prior analysis). Likely bottleneck is the 600k PBKDF2 derive + roundtrips, not per-row decrypt. Spec: `specs/fix/0xx-dashboard-perf-spike` (instrument derive/network/decrypt/render), then a targeted fix.

---

## Notes on principle adherence (your ask)

- **DRY** — main offenders: crypto loop (5×), cookie seal (2×), business helpers (2× each), dashboard shell (5×). Addressed in Phase 3.
- **SRP / SoC** — 5 oversized components; pages doing fetch+state. Phase 3.
- **YAGNI** — low overall; `CustomCard` (1 consumer), possibly `fetchExchangeRate`. Verify before removing.
- **SOLID** — D (dependency inversion) reasonable via hooks; biggest gap is SRP. No interface-segregation issues of note.
- **Coverage/tests** — the real gap; Phase 2 fixes the foundation without deps, then the jsdom decision unlocks UI.
- **Harness/skill scoping** — sound except the 3 items in Phase 4.
