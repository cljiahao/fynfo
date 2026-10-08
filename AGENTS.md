<!-- templateCentral: nextjs@5.0.0 -->

# AGENTS.md — Fynfo Governance Protocol

**Audience:** any AI coding agent — Claude Code, OpenCode, Cursor, Codex, atlas/heph/argus (Hermes fleet), or future tools.

**Authority order:** `CONSTITUTION.md` > this file > inline conventions.

This file is the single entry point. Read it before doing anything in this repo. `CLAUDE.md` re-exports this file via `@AGENTS.md`.

---

## 0. Hard stops

You MUST stop and surface to the human owner if any of these are true:

1. There is no approved spec for an implementation change and no explicit owner-authorized audit/remediation scope under `CONSTITUTION.md` §7.4. Read-only investigation and drafting specs never require an approved implementation spec.
2. The change would violate any `HARD` rule in `CONSTITUTION.md`.
3. The operation would read or modify real secret env files, private keys, credentials, or live vault secrets; perform destructive migrations; or edit permission-protected files without explicit owner authorization. Permission-protected files are `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/**`, `.claude/harness.json`, `.claude/skills/**`, `.github/workflows/**`, and `scripts/build-push.sh`. Draft governance specs may be written for review but need owner approval before commit. `.env.example` is editable with placeholders only. Exclude secret contents from searches, tool output, and audit tooling. Never bypass an active hook or tool denial.
4. A new dependency is required.
5. Confidence in an implementation approach is below "I'd bet money on this" after investigation. Continue read-only research to resolve uncertainty before editing.

**§0.3 standing exemption (2026-05-27, Clarence-approved):** templateCentral v4 alignment edits — adding v4 plugin marker, the §9 Skills sections, `.claude/skills/<v4-skill>` files, and the one-line `CLAUDE.md = @AGENTS.md` form — are pre-authorized as a single bounded amendment. Any further changes to the listed files still require a `specs/governance/` spec.

Stopping looks like: a short message naming the trigger, affected paths, proposed change, risk, and approval or information needed. Pause the affected operation; continue independent authorized work. Use permission already given for the same paths and scope rather than asking again.

---

## 1. Workflow

### 1.1 Receiving a task

1. Read `CONSTITUTION.md` (full).
2. Look for an existing spec in `specs/**` matching this task. If found and `status: approved`, proceed to §1.3.
3. For an explicit owner-requested audit and improvement, use §1.5. Otherwise, if no spec exists, go to §1.2. Read-only reviews may proceed immediately under §5.

### 1.2 Spec-first

1. Copy `specs/SPEC_TEMPLATE.md` to `specs/<area>/<NNN>-<slug>.md`.
2. Fill every section. Cite constitution sections satisfied. Flag any SOFT overrides with reasoning.
3. Open spec PR (branch `spec/<NNN>-<slug>`). Post link. **STOP.**
4. Wait for `status: approved`. Do not implement before approval.

### 1.3 Implementation

1. Branch: `impl/<NNN>-<slug>`.
2. Make changes. Keep diff scoped to the spec. Out-of-scope cleanups are forbidden in this PR.
3. Run gates locally until green: `pnpm check && pnpm test:ci && pnpm build` — or invoke `/next-verify` (see §9).
4. Open PR. Title: `<NNN>: <one-line summary>`. Body links spec PR + spec file path.
5. If gates fail in CI, iterate. Do not request human review with red CI.

### 1.4 Closing

After merge, update spec frontmatter: `status: shipped`, `shipped: YYYY-MM-DD`, `impl_pr: <url>`. Commit on `main` directly (single-line trivial change) or in the impl PR's final commit.

### 1.5 Owner-authorized audit and remediation

1. Record the owner's request and scope in `specs/` as an audit record. Mark it as owner-authorized remediation under constitution §7.4; do not claim approval of findings the owner has not reviewed.
2. Inventory tracked source, tests, tooling, docs, and assets. For each file, record its purpose and consumers or why it is required by a framework/tool. Treat generated files, historical migrations, and governance records according to their lifecycle; absence of imports alone is not proof a file is unused. Never read secret files.
3. Review authentication, authorization/RLS, validation, encryption, cookies, error/log redaction, dependency risks, and OWASP attack surfaces. Review duplication, SRP/SOC, DRY, YAGNI, and SOLID against actual consumers rather than creating speculative abstractions. Research uncertain claims with authoritative sources and record supporting links.
4. Before each reversible remediation batch, record affected paths, evidence, proposed changes, acceptance checks, and rollback in the audit record. Ordinary code, tests, README/comments, `.env.example`, and lint/config fixes may proceed within the owner's scope without a new approval per finding. Separate approval remains required for §0 protected operations, new dependencies/features, migrations, and crypto protocol changes.
5. Prove behavior changes with meaningful regression tests; measure latency/bundle changes before claiming performance gains. Check security-critical coverage and untested error/authorization paths, not only the aggregate percentage. Review README and inline comments per batch: retain contracts, constraints, tooling directives, and non-obvious rationale; remove stale narration and commented-out code. Constitutional suppression citations remain required.
6. Run applicable quality gates and fix failures within scope. Perform a second independent review pass over the resulting code and findings. Record residual risks and blocked operations explicitly; do not claim exhaustive security or file coverage without an inventory proving what was reviewed.

Keep commits focused on one coherent batch. Use `impl/<audit-id>-<slug>` when
branching, and link the audit record in PRs. Do not rewrite prior approvals or
mark work shipped until it is merged. Documentation-only governance amendments
may use formatting and diff review under constitution §7.4; executable changes
still require all §3 gates.

---

## 2. Project facts

Personal wealth management dashboard. Next.js 16 App Router, React 19 Server Components by default, Supabase auth + Postgres + RLS, shadcn/ui.

### Stack

- Frontend: Next.js 16, React 19, TanStack Query v5, Zod v4, React Hook Form, Tailwind, shadcn/ui
- Backend: Supabase (`@supabase/ssr`) + Postgres + RLS; server actions for mutations
- Encryption: AES-256-GCM payload encryption with DEK derived from PIN (PBKDF2, salt = Supabase user id), DEK held in HttpOnly cookie `fynfo_vault_dek`
- Tests: Vitest (Node default; opt-in jsdom + Testing Library per-file for component tests)
- Tooling: pnpm, ESLint, Prettier, husky

### Layout

```
src/
├── app/                    # App Router (pages & routes)
│   ├── (public)/          # Login (no auth required)
│   ├── dashboard/         # Protected pages (assets, equity, salary, expenses, profile, entry)
│   └── api/               # API routes (health, vault)
├── features/<name>/       # actions, components, hooks, lib, types, schemas, constants, index.ts
├── components/
│   ├── layout/           # App shell (Navbar, Providers, ThemeProvider)
│   ├── ui/               # shadcn/ui primitives (managed by CLI)
│   └── widgets/          # Reusable composed components
├── integrations/         # Third-party API clients & services
│   ├── clients/          # Browser-side clients (supabase.ts, base/)
│   └── services/         # Server-side clients (supabase.ts)
├── lib/                  # Shared (auth-guard, crypto, keystore, constants, errors, utils)
└── proxy.ts              # Next.js 16 proxy — Supabase session refresh + route protection
```

### Key files

| File                                    | Purpose                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                          | Supabase session refresh + route protection (Next.js 16 proxy, not deprecated middleware)                                                                              |
| `src/lib/auth-guard.ts`                 | `requireUserId()` — Supabase auth check for server actions                                                                                                             |
| `src/lib/crypto.ts`                     | `encryptPayload` / `decryptPayload` — AES-256-GCM field encryption                                                                                                     |
| `src/lib/keystore.ts`                   | `getVaultDekSession()` — reads the DEK from the HttpOnly cookie `fynfo_vault_dek` (the server no longer derives the DEK)                                               |
| `src/lib/client-crypto.ts`              | `deriveKeyClient(pin, userId)` / `deriveKeyLegacy(pin)` — client-side WebCrypto PBKDF2 (600k iters, user-id salt); the only PIN→DEK derivation, POSTed to `/api/vault` |
| `src/lib/crypto-constants.ts`           | Shared PBKDF2 + AES constants used by both the server field-encryption and client `client-crypto.ts` so derivations stay in lock-step                                  |
| `src/lib/logger.ts`                     | Pino server-side structured logger with PII / secret redaction                                                                                                         |
| `src/lib/utils/with-logging.ts`         | API route handler wrapper — request id, structured log of method/path/status/duration                                                                                  |
| `src/lib/validation/parse-or-throw.ts`  | `parseOrThrow(schema, input, label)` — safe boundary parse for server actions; throws opaque `AppError('VALIDATION')`                                                  |
| `src/app/api/vault/route.ts`            | Verifies the client-derived DEK against the vault canary (rate-limited); sets the `fynfo_vault_dek` HttpOnly cookie                                                    |
| `src/integrations/clients/supabase.ts`  | Browser-side Supabase client                                                                                                                                           |
| `src/integrations/services/supabase.ts` | Server-side Supabase client (uses cookies)                                                                                                                             |
| `supabase/migrations/`                  | SQL schema + RLS policies                                                                                                                                              |
| `src/features/salary/lib/tax-cpf.ts`    | Singapore tax/CPF calculation logic                                                                                                                                    |

### Required env (see `.env.example`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SESSION_SECRET` — 32-byte secret for encrypting the vault DEK cookie (`openssl rand -base64 32`)
- `ADMIN_EMAILS` — comma-separated emails granted the `/dashboard/admin` telemetry page (spec 005, supersedes spec 004's `ADMIN_USER_IDS`). Optional; unset ⇒ admin page 404s for everyone (fails closed).

---

## 3. Quality gates (what "done" means)

A PR changing executable behavior is mergeable only if ALL pass. Documentation-only
changes use formatting and diff review under constitution §7.4:

- [ ] `pnpm format:check` green
- [ ] `pnpm lint` green (max-warnings=0)
- [ ] `pnpm typecheck` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Approved spec linked with unchanged approval hash, or owner authorization and scoped audit record linked under constitution §7.4
- [ ] Constitution sections cited in spec; no uncited `HARD` rule touched
- [ ] No `any`, no `console.log`, no `@ts-ignore`/`eslint-disable` without inline spec citation
- [ ] No new dependency unless spec approves it explicitly
- [ ] No file outside the approved spec or recorded owner-authorized audit batch

The `/next-verify` project skill (§9) runs all five `pnpm` gates in one shot.

If you are an agent, you iterate on red gates yourself. The human reviews only green PRs.

---

## 4. Style

- Named exports; no `export default` except Next.js specials.
- Server Components by default; justify `'use client'` in spec.
- Tailwind classes only; no inline styles.
- Static data in `constants.ts`.
- New shadcn primitives via `npx shadcn@latest add <name>` only.
- File naming per `CONSTITUTION.md` §3.4. Files kebab-case (except Next.js specials), components/types PascalCase, fns/hooks/vars camelCase, constants UPPER_SNAKE_CASE.
- `unknown` not `any`; narrow with type guards.

### Architecture rules

- Route groups: `(public)/` public, `dashboard/` authenticated.
- Server actions in `features/<name>/actions/` for mutations — NOT API routes.
- React Query hooks in `features/<name>/hooks/` for data fetching.
- Barrel exports (`index.ts`) — prefer `import { Foo } from '@/features/assets'` over deep imports.
- Every server action: `requireUserId()` (validates Supabase session server-side via `supabase.auth.getUser()`) then `getVaultDekSession()` before any DB access.
- Never put data-fetching in page components — pages compose from features.
- Validate every API input at the boundary with Zod (`safeParse` + `z.flattenError()` for client-facing 400s).
- Error responses never leak Supabase/Postgres text (table names, constraint names, stack traces). Wrap with opaque message; log detail server-side.

---

## 5. Investigation before code

When unsure, investigate. Acceptable read-only actions without a spec:

- Reading files, running `pnpm typecheck`, `pnpm test:ci`, `pnpm lint`.
- `git log`, `git diff`, `git status`, `git show`.
- Database read queries against a local dev DB (not prod).
- Searching docs / Supabase / Next.js documentation.

Ordinary edits and new files require an approved spec or owner-authorized audit
record under §1.5. Dependency changes, schema/data migrations, and protected
operations need separate scoped approval. Branch deletion and force push remain
prohibited. Reading secret contents is prohibited even during an investigation.

---

## 6. Multi-agent etiquette (Hermes fleet)

If you are a sub-agent (heph coder, argus reviewer, etc.):

- Your output goes to atlas, which surfaces to Clarence. Do not message Clarence directly unless escalating.
- Reviewer agents (argus) post line-level comments on the impl PR; do not approve your own PR.
- Coder agents (heph) iterate on gate failures + reviewer comments without escalation, unless triggers in §0 fire.
- Triage / ops / auditor agents act silently unless their escalation rules fire.

---

## 7. Drift & corrections

Found something in the repo that violates the constitution? Two options:

- Small, in-scope of current spec → fix as part of the impl PR; note it in the PR body.
- Out of scope → document the drift in a proposed spec. During an owner-authorized audit, record and fix it only if it fits the audit's scope under §1.5. Do not silently expand an approved spec.

---

## 8. Amendment of this file

`AGENTS.md` itself is governed by `CONSTITUTION.md` §7.1. Amendments require a
`governance/` spec and explicit owner permission before editing or committing,
except for the §0.3 standing exemption noted above. Record conversational
permission with its date and scope; agents cannot approve their own amendments.

---

## 9. Skills

### Project skills — check `.claude/skills/` first

Skills here are scoped to Fynfo and override user / plugin skills with the same name. Invoke with `/skill-name`.

| Skill            | What it does                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `/next-verify`   | runs the §3 quality gates (`format:check + lint + typecheck + test:ci + build`) in one pass |
| `/regen-harness` | recompute SHA-256 hashes in `.claude/harness.json` after editing seeded harness files       |

Add new project skills whenever a workflow repeats — capture once, never reconstruct from prose again.

### templateCentral plugin skills — framework-level operations

| Skill                               | When to use                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `templatecentral:add (page)`        | new Next.js page                                                                                |
| `templatecentral:add (component)`   | new shadcn / feature component                                                                  |
| `templatecentral:add (form)`        | new RHF + Zod form                                                                              |
| `templatecentral:add (api-route)`   | new route handler (Fynfo prefers server actions; only for genuine HTTP edges like `/api/vault`) |
| `templatecentral:add (integration)` | new third-party integration                                                                     |
| `templatecentral:standards`         | code standards, validation patterns, drift check                                                |
| `templatecentral:audit`             | full ecosystem + accuracy audit                                                                 |

### Skill scoping priority

Official resolution order: **Managed > CLI flag > Project (`.claude/skills/`) > User (`~/.claude/skills/`) > Plugin (`templatecentral:*`)**. Project skills override user skills when names collide. Plugin skills are namespaced and never conflict.

### Fynfo deviations from templateCentral defaults

Intentional and load-bearing — do NOT "fix" toward the template:

- **Auth**: Supabase (`@supabase/ssr`) replaces NextAuth — no `src/auth.ts`, no `SessionProvider`.
- **Database**: Supabase + raw SQL migrations replace Prisma — no `prisma/schema.prisma`, no `integrations/database/`.
- **Feature data layer**: `actions/` server actions replace `templatecentral`'s `api/` service + route handler pattern.
- **Governance**: `CONSTITUTION.md` + spec-first and owner-authorized audit paths are the Fynfo authority; templateCentral conventions are subordinate.

### Skill use during audits

Use templateCentral standards and its comment guidance for Next.js review;
apply frontend-design to frontend concerns within the existing design system.
Read the relevant skill and references, record which guidance was used in the
audit record, and preserve the Fynfo deviations above. Skills must not expand
the requested scope or create redundant approval stages for authorized work.
Project skill edits require the specific permission in §0; documentation of
skill use in the audit record does not require installing or modifying skills.

---

## 10. Skills Security

- Review every `SKILL.md` (and its referenced reference files) before installing a third-party skill — treat skills like packages.
- Scope `allowed-tools:` in skill frontmatter to the minimum required (e.g. `Bash(pnpm format:check), Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test:ci), Bash(pnpm build)`, never bare `Bash`).
- Reject skills that hardcode secrets, read or expose secret files, dump environment/session values, or make outbound network calls without an explicit allow-list. Mentioning an environment variable's name for configuration documentation or `.env.example` guidance is not secret access. Review commands and data access rather than blocking harmless names; unrestricted shell access can expose vault or environment secrets.
- `.claude/settings.json`, hooks, manifest, and project skills require explicit scoped permission per `CONSTITUTION.md` §8.2. Existing `PreToolUse` guards still block raw edits to them and do not block skill execution. Vet skills before invoking them; use supported approvals or owner action for blocked edits.

---

## 11. AI Harness

`.claude/settings.json` hooks (Node `.mjs`, cross-platform — Windows + macOS/Linux):

| Event                  | Script                         | Action                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SessionStart           | `session-banner.mjs`           | Prints the governance reminder banner.                                                                                                                                                                                                                                                                     |
| UserPromptSubmit       | inline + `injection-guard.mjs` | Warns if `specs/` is missing; `injection-guard.mjs` blocks OWASP-LLM01 prompt-injection phrases (exit 2).                                                                                                                                                                                                  |
| PreToolUse Write/Edit  | `guard-protected-paths.mjs`    | Blocks edits to the enforcement layer (`.claude/settings.json`, `hooks/**`, `harness.json`, `skills/**`), secrets/`.env*` (except `.env.example`), certs, CI workflows, `build-push.sh`. Rulebooks (`CONSTITUTION.md`/`AGENTS.md`/`CLAUDE.md`) are NOT blocked as of gov-013 (gov-055 for `.env.example`). |
| PreToolUse Bash        | `guard-destructive-bash.mjs`   | Blocks force pushes, hard resets, branch deletion, `rm -rf`, docker push, destructive SQL, `.env` overwrites.                                                                                                                                                                                              |
| PostToolUse Write/Edit | `post-edit-tsc.mjs`            | Fast incremental typecheck feedback (`pnpm exec tsc --noEmit`). Feedback-only; exit 0 always.                                                                                                                                                                                                              |
| Stop                   | `stop-tests.mjs`               | Runs `pnpm test:ci` — tail to stderr, exit 2 on failure (forces a fix before the turn ends); then reminds: gates green? spec linked? sections cited? scope respected?                                                                                                                                      |

Cross-platform note: hooks are **Node `.mjs`** so they run identically on the Windows dev host and any macOS/Linux teammate — there is no per-OS `.ps1`/`.sh` split (the earlier PowerShell fork was migrated to Node; older `specs/governance/*` and `§12` notes that reference `.ps1` describe that historical state). CI runs the gates directly (`pnpm check`, `pnpm test:ci`, `pnpm build`) — it does not need these hooks.

Project skill manifest: `.claude/harness.json` records SHA-256 hashes of seeded files so `templatecentral:standards` / drift-check can detect tampering.

Permission policy and mechanical enforcement are separate. These rulebooks do
not themselves change hooks or grant a bypass. Audit the harness for narrow,
reliable protection of secrets and destructive operations; propose specific
permission-gated changes for other files. After an approved tracked-file edit,
report manifest drift and request a scoped baseline update. Do not rehash
unrelated drift into acceptance. The existing verifier normalizes LF while the
regen skill hashes raw bytes (spec 065); reconcile that difference through a
separately authorized harness change before claiming integrity is green.

Context load order (context only — not enforcement, broad → specific): managed policy → `~/.claude/CLAUDE.md` → `CLAUDE.md` (`@AGENTS.md`, optional) → this file → `.claude/rules/*.md`. Hard enforcement lives only in the `settings.json` PreToolUse hooks.

---

## 12. Project Notes

**Initial scaffold (2026-03-16)**: domain-specific routes (assets, equity, salary, entry, expenses) instead of generic `[id]`; server actions for mutations; recharts + date-fns.

**Supabase & E2E Encryption Migration (2026-04-11)**: migrated from Prisma + NextAuth to Supabase + zero-knowledge AES-256-GCM payload encryption. DEK derived from 6-digit PIN (PBKDF2, salt = Supabase user id), held in HttpOnly cookie `fynfo_vault_dek`. All server actions inside `features/` call `requireUserId()` → `getVaultDekSession()` → `encryptPayload`/`decryptPayload`.

**Spec 008 — PostToolUse reintroduction (2026-05-28)**: typecheck-only `PostToolUse` hook reintroduced via external
`.claude/hooks/post-edit-tsc.ps1` per the spec-003 lesson (no inline `$VAR`, no `&`). Supersedes spec 003 only on the
"PostToolUse absent" decision; 003's Stop simplification still holds.

**templateCentral v4 alignment (2026-05-27)**: added plugin marker, §9 Skills, §10 Skills Security, `.claude/skills/next-verify` project skill, `.claude/harness.json`. Collapsed prior `CLAUDE.md` project reference into this file; `CLAUDE.md` is now `@AGENTS.md` only per v4. Per-action `requireUserId` now expected to use server-side `supabase.auth.getUser()` (not the client-readable `getSession()`); PBKDF2 hardening (600k iters, user-id salt) tracked under a follow-up spec with rekey-on-unlock migration plan.

**Spec 010 — templateCentral 4.2.0 harness alignment (2026-05-31)**: restored a test-enforcing `Stop` hook (`stop-tests.ps1`, `pnpm test:ci` → stderr + `exit 2`), added an OWASP-LLM01 `UserPromptSubmit` injection guard (`injection-guard.ps1`), expanded `guard-protected-paths.ps1` to also block `.github/workflows/` + cert/credential files and fixed its block path to `exit 2` (the prior `Write-Error` under `$ErrorActionPreference=Stop` threw before reaching `exit 2`, so the hook never actually blocked), added `skillListingBudgetFraction: 0.02` and the §11 context-load-order note. The `.agents → .claude` symlink is deferred — Windows symlink creation needs Developer Mode/admin. Supersedes 003 on the Stop hook; `harness.json` bumped to 4.2.0.

**gov-013 — telemetry carve-out + agent edit-scope (2026-06-11)**: constitution → v2.0. §2.2/§2.3 gained a scoped anonymous, non-PII, non-financial telemetry carve-out (`/api/track` + admin aggregate reads, both vault-free); §8 widened so rulebooks + `specs/**` are agent-editable with human approval, while the enforcement layer (`.claude/settings.json`, `hooks/**`, `harness.json`, `skills/**`) + secrets + CI stay human-only. Clarence relaxed `.claude/settings.json` deny + `guard-protected-paths.ps1` accordingly. Enabled spec 004 (storefront moat + telemetry + admin dashboard).

**gov-014 — templateCentral 5.0.0 harness alignment (2026-06-14)**: flat `.claude/skills/*.md` don't load in tc5.x (silent ignore). Moved both project skills to directory form (`next-verify/SKILL.md`, `regen-harness/SKILL.md`). Bumped AGENTS marker `@4.0.0` → `@5.0.0`. Updated regen-harness skill paths + version string. Added `.agents` to `.gitignore` (committed symlink breaks Windows CI). Regenerated `harness.json` @ 5.0.0 (clears two stale hashes from gov-013). Spec 033.

**Hooks migrated to Node `.mjs` (2026-06-27)**: the PowerShell `.ps1` hook fork was replaced by cross-platform Node `.mjs` guards (`session-banner`, `injection-guard`, `guard-protected-paths`, `guard-destructive-bash`, `post-edit-tsc`, `stop-tests`) — one implementation for the Windows host and any macOS/Linux teammate. §11 reflects the current Node hooks; older `§12`/`specs/governance/*` `.ps1` references describe the prior state.

**UI redesign (2026-07-04/05, specs 060–064)**: authenticated app moved off the stock shadcn `neutral` base onto a semantic OKLCH token system in `globals.css` (`--brand` sky accent, `--gain`/`--loss`/`--warning` with `-strong`/`-subtle`, `--chart-1..6`, dark cards lifted, `--ring`=brand) sharing DNA with the marketing storefront. Extracted `StatCard` + `PageHeader` shared widgets (`components/widgets/`), a real sky→emerald `.text-brand-gradient` wordmark, a global `prefers-reduced-motion` guard, and tabular-nums / gain-loss glyph a11y. Rethemed the vault-unlock overlay onto tokens. 471 tests.

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration (v5.0+) -->
