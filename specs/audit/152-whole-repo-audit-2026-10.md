---
id: 152
slug: whole-repo-audit-2026-10
area: audit
status: draft # owner-authorized audit record (CONSTITUTION §7.4); findings await owner review
author: Claude (Opus 5.5 planner)
created: 2026-10-24
approved:
shipped:
impl_pr:
constitution_satisfies:
  [
    '§2.1',
    '§2.2',
    '§2.3',
    '§2.6',
    '§3.2',
    '§4.1',
    '§4.2',
    '§4.3',
    '§4.5',
    '§5',
    '§7.4',
    '§8.2',
  ]
constitution_overrides: []
---

# Audit 152: Whole-repo audit and roadmap refresh (October 2026)

## Owner request and authorization

Clarence asked for a whole-repo audit of Fynfo and a roadmap refresh. The
request reached this planner through a parent session, condensed. It covers:

1. A roadmap ranked by the owner's own use. Fynfo is personal-use only (owner
   plus household partner) and is never sold. Public-user items rank low.
2. An OWASP/CCSP-style security review: XSS, CSRF, CORS, SQL injection, input
   and output validation, data minimisation, and speed/latency/security. Any
   performance claim must be measured.
3. templateCentral standards: colours as tokens with no hard-coded values,
   proper folder structure, and the AGENTS.md §9 Fynfo deviations kept.
4. Frontend review with `frontend-design` (and `impeccable` where it fits),
   within the existing design system.
5. Low code debt (SOLID, YAGNI, SRP, SOC, DRY), with abstractions only where
   real consumers exist. Then a second fresh-eyes sweep, including coverage
   of security-critical paths.
6. Short, required comments; removal of narration; README and comments
   updated per commit; ESLint rules for comment smells. A new ESLint plugin
   needs owner approval (AGENTS §0.4).
7. A right-sized harness. Hard blocks only for secrets/`.env*` (not
   `.env.example`) and destructive git/SQL. Ask-permission for rulebooks,
   `.claude/**` and CI. Agents draft harness changes for the owner to apply.
8. Online research with citations when unsure.
9. A record of which skills were used and their scope.
10. A clean finish: worktrees removed, tests green.

This is an owner-authorized audit and remediation under CONSTITUTION §7.4 and
AGENTS §1.5. Ordinary code, test, README, comment and lint/config fixes inside
this scope need no further approval per finding. The owner has **not** yet
reviewed these findings. Items marked **NEEDS APPROVAL** stay blocked until
Clarence approves them in chat; the approval is then recorded in this file.

## Baseline

- Source: `origin/main` at `50be145` (fetched 2026-10-24; local worktree equal).
- Next free spec number was 152. Spec 151 (login-form GET leak) ships separately.
  Its dropped "default last broker" idea stays dropped: prefill bypasses the
  DBS/FSMOne auto-CDP tick.
- 844 tracked files. Prior audits: 070 (inventory), 071 (DB/session security),
  035–038 and 048–051 sweeps. Those audits over-flagged before. Re-verify
  every "dead" or "untested" claim before you act on it.
- Test suite: about 2148 tests at about 92% coverage, per the parent session.
  The implementer must re-measure before setting floors.
- Known flake: `test/features/profile/statement-review.test.tsx` can time out
  under a heavy full pre-push run, but passes alone.

## Inventory method and coverage limits

This planner reviewed these areas by reading files and running targeted
`rg`/`git` searches:

- every `'use server'` action file (17 files);
- all three API routes, `src/proxy.ts`, `next.config.ts` and `eslint.config.mjs`;
- `vitest.config.ts` coverage floors, `package.json` and `pnpm-workspace.yaml`;
- `.claude/settings.json` and all six hooks, `.husky/*`;
- the colour and inline-style usage across `src/`, and the feature folder layout.

The file-level inventory in `docs/audit/2026-10-08-file-inventory.md` (audit 070)
stays the base. Each batch below adds an inventory note for the files it
touches. This record does **not** claim an exhaustive line-by-line review of
all 844 files.

## Findings

Severity: P0 = fix now, P1 = this audit, P2 = this audit if cheap, else roadmap.

### Security

**S1 (P0) – Vulnerable framework versions. NEEDS APPROVAL (dependency change).**
`pnpm audit` reports 69 advisories (2 critical, 31 high). The production ones:

- `next@16.3.8` is affected by
  [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
  (critical, unauthenticated RCE in Image Optimization with SVG on glibc
  Linux),
  [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr)
  (critical, RCE in `use cache`; Fynfo has no `use cache` today), and
  [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r)
  (high, unauthenticated DoS in App Router with Server Actions). Fynfo uses
  Server Actions, so p3m5 applies. The `/_next/image` endpoint exists whether
  or not the app imports `next/image`. All are fixed in `16.4.1`.
- `react`/`react-dom@19.2.5` are below the templateCentral 6.0.4 floor
  (≥19.2.7, an RSC DoS fix). `19.2.9` is the latest 19.2 patch.
- `ws` (through `@supabase/*`) has
  [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)
  (high, memory DoS).
- The rest are dev or build only: postcss, vite, vitest, undici, js-yaml,
  brace-expansion, nanoid, browserslist, source-map-js.

Proposed versions:

- `next` and `eslint-config-next`: `16.4.2` (released 2026-10-15; `16.4.3` is
  one day old);
- `react`, `react-dom`: `19.2.9`, with matching `@types/*`;
- in-range updates (`pnpm update`) for `@supabase/*`, `vitest`,
  `@vitest/coverage-v8`, `@vitejs/plugin-react` and `@tailwindcss/*`, to clear
  the transitive advisories. Use a `pnpm.overrides` entry only where no
  in-range parent update exists, and give each override a reason.

**S2 (P1) – Inconsistent server-action input validation.** Most mutations use
`parseOrThrow`, but about 15 exported actions accept unvalidated primitives:

- `delete*`/`update*` `id: string` in snapshot, dividend, equity, expense,
  salary, scenario, goal and spending actions;
- `settleSplit(expenseId, person, settled)`;
- `settleMonthSplits(expenseIds[], …)`, which takes an unbounded array;
- `getSalaryRecord(id)`, `getTaxReliefs(year)`, `updateDividend(id, …)` and
  `updateTrade(id, …)`.

RLS and the `user_id` filters limit the impact. These are not exploits. But
AGENTS §4 requires validation at the boundary, and a malformed id reaches
Postgres as a type error. Also, `src/features/household/schemas.ts` uses
`z.string().uuid()`, which Zod v4 deprecates in favour of `z.uuid()`.

**S3 (P1) – Over-broad reads (data minimisation, output).**
`select('*')` in these files reads columns the caller never maps:

- `profile-actions.ts:14` reads `email`, `name`, `image` and the vault canary;
- `planner-actions.ts:15`;
- `salary-actions.ts:42`.

Narrow each to the mapped columns. This is code-only.

**S4 (P2) – Stored personal data beyond need. NEEDS APPROVAL (migration).**

- `users_profile` keeps `email` (written from `auth.users` by the vault route),
  `name` and `image`, and no app code reads them. The `email` column is
  `UNIQUE NOT NULL`, with a `''` fallback in `src/app/api/vault/route.ts:188`.
  Two email-less accounts would collide on that column.
  - Proposal: a forward migration that drops these columns, or at least drops
    `NOT NULL`/`UNIQUE` on `email`, plus a route change that stops writing it.
- `expense_splits.person` stores third-party names as plaintext. The init
  migration comment already asks whether it should be encrypted.
  - Encrypting it is a crypto/data change. `settleSplit` filters by `person`,
    so it would need an HMAC blind index (§5.4). This goes to the roadmap, not
    this audit.

**S5 (P1) – CSRF defence in depth on `/api/vault`.**

- The key cookies are `SameSite=Strict`. Server Actions get Next's built-in
  Origin/Host check. CORS: no `Access-Control-*` headers anywhere, so the
  browser default (same-origin) applies. That is correct.
- `/api/vault` POST/DELETE has no explicit Origin or Fetch-Metadata check, and
  `req.json()` accepts a `text/plain` body. A `text/plain` body skips the CORS
  preflight.
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  recommends rejecting `Sec-Fetch-Site: cross-site` on unsafe methods, with an
  Origin-match fallback. It calls SameSite defence in depth only.
- Add a small shared guard: reject a cross-site or mismatched Origin, and
  require `content-type: application/json`, on vault POST/DELETE. Bound
  `/api/track` body size and content type the same way.

**S6 (P1) – Partial CSP (XSS defence in depth).**

- `next.config.ts` sets only `frame-ancestors`, `base-uri`, `object-src` and
  `form-action`. It sets no `script-src`, `connect-src` or `default-src`.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` appears
  in `src/`, and React escapes output. So there is no known XSS today.
- But a decrypted vault page has no script or exfiltration limit.
- [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy):
  a strict policy needs a per-request nonce set in `proxy.ts`, which forces
  dynamic rendering. Authenticated dashboard routes already render
  dynamically. The public `/` and `/login` pages would lose static rendering.
- Plan:
  1. Measure the current per-route first-load JS and the TTFB of `/` and
     `/login` (local `next start`, 20 requests each, median).
  2. Add a nonce CSP with `script-src 'self' 'nonce-…' 'strict-dynamic'`,
     `connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL>`, `img-src 'self' blob:
data:` and `default-src 'self'`.
  3. Re-measure, then verify in a browser that no CSP violations appear on
     login, unlock and every dashboard page.
- If the public-route TTFB cost is unacceptable, limit the nonce policy to
  `/dashboard/**`. Record the numbers either way.

**S7 (P2) – Comment drift in `src/app/api/track/route.ts:9-11`.** A broken
sentence ("The / Only the trusted RPC…") and a `gov-013` narration reference.
This is fixed with B5.

**Verified clean (no action):**

- SQL injection: no raw SQL is built from strings, and no PostgREST
  `.or()`/`.filter()` uses template interpolation. RPCs are parameterised.
- Price fetches: hosts are fixed, the ticker is regex-bound and
  `encodeURIComponent`-escaped, the timeout is bounded, and the response is
  Zod-validated. No SSRF.
- `/api/track`: Zod at the boundary, with opaque failures.
- `target="_blank"`: none.

### Standards (templateCentral 6.0.4, `nextjs`)

**T1 (P1) – Hard-coded colours.** There are 46 hex/rgb literals in 8 files:

- `assets/constants.ts`, `expenses/constants.ts`,
  `assets/components/category-breakdown.tsx` and
  `assets/components/salary-planner.tsx` (chart palettes);
- `marketing/components/{hero,cta-band,dashboard-preview}.tsx`.

About 80 Tailwind raw-palette classes (`text-emerald-400` and similar) sit in
the marketing and public-navbar components. `globals.css` has only
`--chart-1..6`, but expenses need 14 categories and assets 7.

- Fix: add a categorical palette to `globals.css` (light and dark) under the
  `@theme inline` mapping, and make consumers read `var(--…)`.
- Read the `dataviz` skill palette method before choosing values. Check
  contrast in both themes.

**T2 (P1) – Inline styles (HARD §3.2).** There are 13 `style={{…}}` uses:

- `planner-results.tsx:98` is static (`cursor`, `outline`). Convert it to
  Tailwind.
- The rest are data-driven: legend swatch colours and percentage widths.
  - Swatch colours become token classes once T1 lands.
  - Widths have no Tailwind equivalent. Keep them with a one-line
    `-- §3.2: data-driven width` justification comment, or set a single CSS
    custom property. Record the decision.

**T3 (P1) – Barrel bypass (HARD §2.6).** 22 cross-feature deep imports in
production `src/`:

- `assets/components/{investment-allocation,investment-breakdown,market-allocation-table,salary-planner}.tsx`;
- `assets/lib/investment-math.ts`;
- `profile/hooks/use-export-data.ts`, `profile/lib/export-data.ts`;
- `salary/hooks/use-salary-ytd-stats.ts`.

Export the needed symbols through each feature's `index.ts`, and check for
import cycles and the client/server boundary. Then add
`no-restricted-imports` (patterns `@/features/*/*`) for `src/**`, with tests
exempt. That rule is core ESLint, so it needs no dependency.

**T4 (P2) – Test placement.** `src/features/assets/__tests__/` (3 files) breaks
the repo convention that tests live under `test/`. Move them to
`test/features/assets/`, then drop `src/**/*.test.*` from the vitest `include`
if nothing else uses it.

**T5 (P1) – Comment-smell lint.** Already enforced: `sonarjs/no-commented-code`,
`no-inline-comments` (with the directive ignore pattern), and `no-console`.
Missing, per templateCentral `code-standards/comments.md`:

- (a) `linterOptions.reportUnusedDisableDirectives: 'error'` and
  `reportUnusedInlineConfigs: 'error'`. These are core, no dependency.
- (b) `@eslint-community/eslint-plugin-eslint-comments@4.8.1` `recommended` plus
  `require-description` and `disable-enable-pair: { allowWholeFile: true }`.
  **NEEDS APPROVAL (new devDependency)**.
- (c) A dependency-free `scripts/check-comment-hygiene.mjs`, run in `pnpm check`.
  - It fails on comment-start narration keywords, using the 10 high-precision
    patterns from templateCentral's `comment-hygiene-patterns.txt`, copied to
    `scripts/comment-hygiene-patterns.txt`. (`.claude/` is protected.)
  - It also fails on the Fynfo narration form `\b(spec|gov|audit)[ -]?\d{3}\b`
    inside comments.
  - Exempt the constitution citations that suppressions need (`-- spec §X.Y`).
  - Before narrowing the patterns, measure the false-positive rate on the
    current tree.
- (d) Bump `eslint-plugin-sonarjs` from `4.2.0` to `4.2.2`. This is an
  existing-dependency patch. It is covered by the S1 approval if granted.
  Count violations under `sonarjs.configs.recommended`. Adopt it if it costs
  ≤ 1 day of fixes; otherwise adopt only the bug and security subset, and
  record why.

Current narration: 18 hits in 15 `src`/`test` files, plus 1 keyword hit. Clean
them up in the same batch.

**T6 (P2) – Harness version drift.** `.claude/harness.json` and the AGENTS
marker are at templateCentral `5.0.0`; the plugin is `6.0.4`. TypeScript is
5.9 (templateCentral 6 suggests 6), and `packageManager` is not pinned.

- `harness.json` and the AGENTS marker are permission-protected. The owner
  applies them; this audit only drafts.
- A TypeScript 6 upgrade is a major dependency change, and constitution §3.1
  pins 5.9+. It goes to the roadmap.

**Verified compliant:** feature folders follow
`actions/components/hooks/lib/schemas/types/constants/index.ts`. The §9
deviations are intact: Supabase (no NextAuth, no Prisma), and server actions
instead of `api/` services. Pages are thin.

### Frontend (frontend-design + existing tokens)

**F1 (P2)** – The ALL-CAPS tracked label pattern appears in
`salary/components/salary-summary.tsx` (3) and
`expenses/components/expense-chart.tsx` (1). The frontend-design guidance flags
it as template chrome. Switch these to sentence-case small labels that match
the `PageHeader`/`StatCard` typography. A `" · "` meta separator appears 26
times; leave it unless a page review shows it hurts scanning.

**F2 (P2)** – The marketing storefront uses its own raw palette. It is
public-facing and low owner value. See R-retire in the roadmap before you
spend effort here. If it is kept, it gets token treatment under T1.

No redesign is in scope. `impeccable` is reserved for a later owner-requested
page polish.

### Code debt (SOLID/YAGNI/SRP/SOC/DRY)

**D1 (P1) – Repeated Yahoo chart fetch.** `price-actions.ts` repeats the same
fetch/timeout/`res.ok`/JSON block 3 times. Extract one private
`fetchYahooChart(symbol, query, revalidate)` helper in the same file. It has 3
real consumers, so it needs no new module.

**D2 (P2) – Oversized components.**

- `import-review/components/statement-review.tsx` (1161 lines) and
  `expenses/components/expense-quick-add.tsx` (804 lines) each mix parsing
  state, presentation and save orchestration.
- Split them along existing seams: presentational subcomponents in the same
  feature, and hooks for state.
- The existing tests must stay green and unchanged. Add a test only for logic
  that moves.
- No speculative shared abstraction.
- Next candidates: `recurring-review.tsx` (529) and `use-statement-save.ts`
  (473). Only split them if they show a clear SRP seam.

**D3 (P1) – Coverage floors missing on security-critical files.**
`vitest.config.ts` has per-file floors for crypto, keystore, action-guard and
most actions, but none for:

- `src/lib/cookie-seal.ts`, `src/lib/auth-guard.ts`, `src/proxy.ts`;
- `src/integrations/services/security-rpc.ts`;
- `src/lib/crypto-fields.ts`, `src/lib/household-cookie.ts`, `src/lib/vault-cookie.ts`;
- `src/app/api/track/route.ts`;
- the newest action files: `household/actions/spending-actions.ts` (150),
  `salary/actions/salary-actions.ts`, `assets/actions/scenario-actions.ts`,
  `expenses/actions/import-expense-actions.ts`,
  `merchant-rules/actions/rulebook-actions.ts` and
  `recurring-expenses/actions/recurring-actions.ts`.

Measure each file, then add tests for the uncovered error and authorisation
branches. Set floors a few points under the measured values, in the same style
as the existing entries.

**D4 (P2) – Spec status hygiene (docs).** These specs are still `draft`,
`approved` or blank although their work shipped or was superseded:

- 070, 071, 072, 079, 080, 081, 087, 091, 094, 104, 128;
- the 137 and 138 storage contracts.

Check each against `git log` and the merged PRs. Then set
`shipped`/`superseded` with evidence, or leave it open with a one-line reason.
Do not rewrite approved bodies.

### Performance

Do not claim any performance gain without before/after numbers. Planned
measurements:

- `pnpm build` route table (first-load JS) before and after B0 and B2, against
  the §4.5 budget of 200 KB gzipped per route. List every route over budget.
- TTFB for the S6 CSP change (see S6).
- Harness cost: the `Stop` hook runs a full `pnpm test:ci` with coverage
  (2148 tests) at the end of every agent turn. Pre-push already runs the full
  gates. See H5.

### Harness (H) – owner-applied

The platform classifier blocks agent edits to `.claude/settings.json` and
`.claude/hooks/**`, so the planner drafted all H changes in
`docs/audit/harness-152/` (106 synthetic guard cases pass). The owner copies
them in; agents do not apply them. See
`docs/audit/2026-10-24-harness-proposal.md` for the exact change summary.

- **H1** – `guard-destructive-bash.mjs` only matches the `Bash` tool. The
  Windows `PowerShell` tool bypasses it completely. Use matcher
  `Bash|PowerShell`, and add PowerShell forms (`Remove-Item -Recurse -Force`,
  `git push --force-with-lease`, `+refspec` pushes, `rm -fr`/`rm -r -f`,
  `TRUNCATE`, `DROP SCHEMA|DATABASE`, `supabase db reset --linked`,
  `supabase db push`).
- **H2** – Reading a secret through a shell is only partly covered. `Read`
  deny rules do apply to `cat`/`head`/`sed` in Bash
  ([permissions docs](https://code.claude.com/docs/en/permissions)). They do
  not apply to `Get-Content`/`type`, or to scripts. Add a hook pattern that
  blocks shell reads of real `.env*` files, but not `.env.example`.
- **H3** – Medium-sensitivity paths (`CLAUDE.md`, `AGENTS.md`,
  `CONSTITUTION.md`, `.claude/**`, `.github/workflows/**`, `scripts/build-push.sh`)
  are either blocked silently (exit 2) or not covered at all. Move them to
  `permissions.ask` in settings, and make `guard-protected-paths.mjs` return
  `permissionDecision: "ask"` for them
  ([hooks docs](https://code.claude.com/docs/en/hooks)). Keep exit-2 hard
  blocks only for secrets, `.env*` (not `.env.example`), certs and key files.
- **H4** – Over-harnessing: `Read(node_modules/**)` and `Read(coverage/**)`
  denies block normal dependency and coverage inspection. This audit hit the
  first one. They protect context size, not security. Remove both.
- **H5** – `stop-tests.mjs` runs the full coverage suite every turn. Skip it
  when `git status --porcelain` shows no changed `src/`, `test/` or config
  files. Otherwise run `vitest run --changed HEAD` without coverage. Pre-push
  stays the full gate.
- **H6** – Keep `injection-guard.mjs`. It is cheap.
- **H7** – `guard-protected-paths.mjs` patterns are not anchored to the
  project, so any path containing `/.claude/hooks/` is blocked, including
  scratchpad drafts. The draft matches governance paths only inside the
  project root.
- **H8** – Two `pnpm test:ci` runs in the same checkout (the Stop hook plus a
  pre-push in another session) share `coverage/`. They overwrite each other's
  output and report false per-file threshold failures. This was observed
  2026-10-24: `crypto.ts` showed 40% while a solo run passed all 2148 tests.
  The H5 draft removes coverage from the Stop hook. B7 also sets
  `coverage.reportsDirectory` from an optional `VITEST_COVERAGE_DIR` variable
  (default `coverage`), so a concurrent run can use its own folder. Spec 151
  (PR 72) separately adds `.claude/worktrees/` to `.prettierignore`.

### Governance drift — NEEDS APPROVAL (rulebook edits, draft only)

- **G1** – CONSTITUTION §1.1 and §6.1 say the Raspberry Pi / Docker
  `cljiahao/fynfo:latest` image is the deployment artifact. In fact, Vercel
  deploys from `main`, the owner decided to stay on Vercel, and no Dockerfile
  is tracked (README §Production artifact already says this). This needs a
  `specs/governance/` amendment.
- **G2** – The AGENTS.md templateCentral marker and §11/§12 notes are at
  5.0.0-era wording. Align them with 6.0.4 together with H.

## Remediation batches

Batches ship as the phase PRs in `docs/audit/2026-10-24-roadmap.md`: one
branch `impl/152-phase-<n>` and one squash PR into `main` per phase, merged
and pushed before the next phase starts. Phase 1 = B0+B1+B2, phase 2 =
B3+B4+B5, phase 3 = B6+B7+B8, phase 4 = B9. Before editing, each PR appends to this record: the affected paths,
the evidence, the acceptance checks and the rollback. Each PR also adds
regression tests for every behaviour change, updates the README and comments
for the touched behaviour, and passes `pnpm check && pnpm test:ci && pnpm build`.

| Batch                   | Findings                  | Gate                                                                 |
| ----------------------- | ------------------------- | -------------------------------------------------------------------- |
| B0 deps-security        | S1, T5d                   | **Owner approval of dependency bumps**                               |
| B1 action-boundary      | S2, S3                    | Authorized (§7.4)                                                    |
| B2 csrf-csp             | S5, S6, perf measures     | Authorized; nonce scope decided from measurement                     |
| B3 colour-tokens        | T1, T2, F1                | Authorized                                                           |
| B4 barrels-structure    | T3, T4                    | Authorized                                                           |
| B5 comment-lint         | T5a/c, S7, cleanup        | Authorized; T5b only with **new-dependency approval**                |
| B6 debt                 | D1, D2                    | Authorized                                                           |
| B7 coverage-floors      | D3                        | Authorized                                                           |
| B8 docs-hygiene         | D4, README                | Authorized (docs-only; may go straight to `main`)                    |
| B9 profile-minimisation | S4 (profile columns only) | Approved 2026-10-24; owner runs prod SQL before merge                |
| G1, G2                  | rulebooks                 | Approved 2026-10-24; agent drafts, owner approves commit; G2 after H |
| H                       | harness                   | **Owner applies** drafts in `docs/audit/harness-152/`                |
| S4 split names          | crypto                    | Roadmap X6; not in this audit                                        |

Order inside a phase: B0 first, because it changes the toolchain the other
batches lint against. B5 runs after B3 and B4 in phase 2, so its cleanup sees
the final comments.

Acceptance for the whole audit:

- every PR has green CI and new regression tests for its behaviour changes;
- `pnpm audit --prod` shows no high or critical advisories (after B0);
- the comment-hygiene check and the deep-import rule are in `pnpm check`;
- every listed security-critical file has a per-file coverage floor;
- this record lists residual risks and blocked items.

A second independent review pass (fresh-eyes review of every phase PR before merge)
is required.

Rollback: revert the batch's squash commit. Dependency rollback restores
`package.json`/`pnpm-lock.yaml` from the parent commit. Batches B0–B8 include no
migration, no crypto protocol change and no protected-file edit. The approved
items below are separate.

## Owner approvals (2026-10-24, in chat with the planner)

Clarence answered the planner's approval questions in this session:

- **B0 approved:** `next`/`eslint-config-next` 16.4.2, `react`/`react-dom`
  19.2.9 (matching `@types/*`), `eslint-plugin-sonarjs` 4.2.2, plus in-range
  updates that clear transitive advisories. `pnpm.overrides` is allowed only
  when no in-range parent update exists, each with a reason.
- **B5 plugin approved:** new devDependency
  `@eslint-community/eslint-plugin-eslint-comments@4.8.1` (`recommended` +
  `require-description` + `disable-enable-pair: { allowWholeFile: true }`).
- **Storefront, telemetry, admin: keep, no polish.** B3 covers only the
  authenticated app and the chart palettes. Marketing raw-palette colours and
  `public-navbar` stay as they are. Retirement stays a roadmap decision.
- **Protected items approved, staged:**
  - **B9 profile-minimisation**, its own PR. The vault route stops writing
    `users_profile.email`. A forward migration drops `email`, `name` and
    `image`, after a consumer search, a local replay with `pnpm db:reset`, and
    an RLS check. Clarence runs the production SQL before the app PR merges.
    Suggested order: ship the route change first, then the drop migration.
  - **G1:** a `specs/governance/` amendment plus a CONSTITUTION §1.1/§6.1 edit.
    It records that Vercel deploys from `main` and that no Docker/Pi artifact
    exists. It is a PATCH version bump. Clarence approves the commit.
  - **G2:** update the AGENTS.md templateCentral marker and the §11 notes to
    6.0.4. This happens only after Clarence applies the H drafts and runs
    `/regen-harness`.

These approvals do not cover editing `.claude/settings.json`, `.claude/hooks/**`
or `.claude/harness.json`, reading secrets, production deployment, or any
other migration.

## Residual risks and blocked items (at planning time)

- S1 stays exploitable in production until B0 (approved 2026-10-24) is merged
  and deployed.
- S4 plaintext split names and unused profile PII stay until an owner-approved
  migration and crypto design.
- Same-user replay of a key cookie inside its 6-hour lifetime stays (accepted
  in 071).
- The service-role credential behind `security-rpc.ts` keeps its inherent
  blast radius (accepted in 071).
- H1–H5 stay unenforced until the owner applies the drafts.
- No private production auth/RLS verification is claimed. All checks are
  source-level, or run on local and synthetic fixtures.

## Skills used and scope

- `templatecentral:standards` 6.0.4: `code-standards/comments.md`,
  `code-standards/nextjs.md` and `drift-check/implementation.md` were read,
  plus `scaffold/shared/comment-hygiene-patterns.txt`. They drove T1–T6 and
  the drift findings. The Fynfo §9 deviations override template defaults.
- `templatecentral:audit`: **not available** in the installed plugin. Its
  skills are add, migrate, scaffold, standards, review, build, cleanup and
  test. The drift-check and security-audit steps in `standards` were used
  instead. No skill was installed or edited.
- `frontend-design`: used for audit only (F1, F2), inside the existing OKLCH
  token system. No redesign.
- `impeccable`: not invoked. It is held for owner-requested page polish.
- `dataviz`: the implementer must read it before choosing the T1 palette
  values.
- Project skill `next-verify`: the implementer can use it to run the gates.
  `regen-harness` stays an owner action after H/G2.

## Research sources

- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) — Next.js advisories, fixed in 16.4.1.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — Fetch Metadata plus Origin fallback; SameSite is defence in depth only.
- [Next.js Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy) — nonce via proxy forces dynamic rendering; SRI is experimental.
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) and [permissions](https://code.claude.com/docs/en/permissions) — `permissionDecision: "ask"`, `Bash|PowerShell` matcher, deny > ask > allow precedence, and which Bash reads `Read` denies cover.
- templateCentral 6.0.4 `comments.md` consensus basis (PEP 8, Google/Airbnb guides, Sonar, ESLint docs).
