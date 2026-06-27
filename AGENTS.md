<!-- templateCentral: nextjs@5.0.0 -->

# AGENTS.md — Fynfo Governance Protocol

**Audience:** any AI coding agent — Claude Code, OpenCode, Cursor, Codex, atlas/heph/argus (Hermes fleet), or future tools.

**Authority order:** `CONSTITUTION.md` > this file > inline conventions.

This file is the single entry point. Read it before doing anything in this repo. `CLAUDE.md` re-exports this file via `@AGENTS.md`.

---

## 0. Hard stops

You MUST stop and surface to the human owner if any of these are true:

1. There is no approved spec in `specs/**` for the change you are being asked to make.
2. The change would violate any `HARD` rule in `CONSTITUTION.md`.
3. The change would touch the **enforcement layer or secrets**: `.claude/settings.json`, `.claude/hooks/**`, `.claude/harness.json`, `.claude/skills/**`, real secret env files (`.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.production.*`, `.env.staging`), `.github/workflows/**`, `scripts/build-push.sh`, any cert/key file, or destructive `supabase/migrations/**`. (As of gov-013 / constitution v2.0, the rulebooks — `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md` — and `specs/**` are agent-editable, but governance changes still require explicit human approval before commit per `CONSTITUTION.md` §8.2. As of gov-055, `.env.example` — the committed placeholder template — is NOT a secret and IS agent-editable; only real secret env files are gated.)
4. A new dependency is required.
5. Confidence in the approach is below "I'd bet money on this".

**§0.3 standing exemption (2026-05-27, Clarence-approved):** templateCentral v4 alignment edits — adding v4 plugin marker, the §9 Skills sections, `.claude/skills/<v4-skill>` files, and the one-line `CLAUDE.md = @AGENTS.md` form — are pre-authorized as a single bounded amendment. Any further changes to the listed files still require a `specs/governance/` spec.

Stopping looks like: a short message naming the trigger, the affected rule/file, and the question you need answered. Do not proceed.

---

## 1. Workflow

### 1.1 Receiving a task

1. Read `CONSTITUTION.md` (full).
2. Look for an existing spec in `specs/**` matching this task. If found and `status: approved`, proceed to §1.3.
3. If no spec exists, go to §1.2.

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

| File                                    | Purpose                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                          | Supabase session refresh + route protection (Next.js 16 proxy, not deprecated middleware)                                 |
| `src/lib/auth-guard.ts`                 | `requireUserId()` — Supabase auth check for server actions                                                                |
| `src/lib/crypto.ts`                     | `encryptPayload` / `decryptPayload` — AES-256-GCM field encryption                                                        |
| `src/lib/keystore.ts`                   | `getVaultDekSession()` — reads DEK from HttpOnly cookie; `deriveKeyFromPinV2()` (600k iters, user-id salt) — PBKDF2       |
| `src/lib/crypto-constants.ts`           | Shared PBKDF2 + AES constants used by both server keystore and client `client-crypto.ts` so derivations stay in lock-step |
| `src/lib/logger.ts`                     | Pino server-side structured logger with PII / secret redaction                                                            |
| `src/lib/utils/with-logging.ts`         | API route handler wrapper — request id, structured log of method/path/status/duration                                     |
| `src/lib/validation/parse-or-throw.ts`  | `parseOrThrow(schema, input, label)` — safe boundary parse for server actions; throws opaque `AppError('VALIDATION')`     |
| `src/app/api/vault/route.ts`            | PIN → DEK derivation; sets `fynfo_vault_dek` HttpOnly cookie                                                              |
| `src/integrations/clients/supabase.ts`  | Browser-side Supabase client                                                                                              |
| `src/integrations/services/supabase.ts` | Server-side Supabase client (uses cookies)                                                                                |
| `supabase/migrations/`                  | SQL schema + RLS policies                                                                                                 |
| `src/features/salary/lib/tax-cpf.ts`    | Singapore tax/CPF calculation logic                                                                                       |

### Required env (see `.env.example`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SESSION_SECRET` — 32-byte secret for encrypting the vault DEK cookie (`openssl rand -base64 32`)
- `ADMIN_EMAILS` — comma-separated emails granted the `/dashboard/admin` telemetry page (spec 005, supersedes spec 004's `ADMIN_USER_IDS`). Optional; unset ⇒ admin page 404s for everyone (fails closed).

---

## 3. Quality gates (what "done" means)

A PR is mergeable only if ALL pass:

- [ ] `pnpm format:check` green
- [ ] `pnpm lint` green (max-warnings=0)
- [ ] `pnpm typecheck` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Spec linked, `status: approved`, hash unchanged since approval
- [ ] Constitution sections cited in spec; no uncited `HARD` rule touched
- [ ] No `any`, no `console.log`, no `@ts-ignore`/`eslint-disable` without inline spec citation
- [ ] No new dependency unless spec approves it explicitly
- [ ] No file outside scope listed in spec

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

Not acceptable without a spec: edits, new files, dependency changes, schema changes, env edits, migrations, branch deletion, force push.

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
- Out of scope → open `specs/fix/<NNN>-<slug>.md` documenting the drift. Do not silently fix.

---

## 8. Amendment of this file

`AGENTS.md` itself is governed by `CONSTITUTION.md` §7.1. Amendments require a `governance/` spec, except for the §0.3 standing exemption noted above.

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
- **Governance**: `CONSTITUTION.md` + spec-first gate is the fynfo authority; templateCentral conventions are subordinate.

---

## 10. Skills Security

- Review every `SKILL.md` (and its referenced reference files) before installing a third-party skill — treat skills like packages.
- Scope `allowed-tools:` in skill frontmatter to the minimum required (e.g. `Bash(pnpm format:check), Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test:ci), Bash(pnpm build)`, never bare `Bash`).
- Reject any skill that hardcodes secrets, references env var names (`SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_*`) directly in the body, or makes outbound network calls without an explicit allow-list. The zero-knowledge encryption posture means a skill with unrestricted `Bash` could exfiltrate the vault cookie or `SESSION_SECRET` trivially.
- `.claude/settings.json` and `hooks/**` are protected per `CONSTITUTION.md` §8.2; the `PreToolUse` guards block raw edits to those files, but they do NOT block skill _execution_. Vet skills before invoking them.

---

## 11. AI Harness

`.claude/settings.json` hooks (PowerShell on Windows):

| Event                                          | Action                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SessionStart                                   | Prints governance reminder banner.                                                                                                                                                                                                                                                  |
| UserPromptSubmit                               | Warns if `specs/` missing. `injection-guard.ps1` blocks OWASP-LLM01 prompt-injection phrases (exit 2).                                                                                                                                                                              |
| PreToolUse Write/Edit                          | `guard-protected-paths.ps1` — blocks edits to the enforcement layer (`.claude/settings.json`, `hooks/**`, `harness.json`, `skills/**`), secrets/`.env*`, certs, CI workflows, `build-push.sh`. Rulebooks (`CONSTITUTION.md`/`AGENTS.md`/`CLAUDE.md`) are NOT blocked as of gov-013. |
| PreToolUse Bash                                | `guard-destructive-bash.ps1` — blocks force pushes, hard resets, branch deletion, docker                                                                                                                                                                                            |
| push, destructive SQL, `.env` overwrites.      |
| PostToolUse Write/Edit                         | `post-edit-tsc.ps1` — fast incremental typecheck feedback (`pnpm exec tsc --noEmit                                                                                                                                                                                                  |
| --incremental`). Feedback-only; exit 0 always. |
| Stop                                           | `stop-tests.ps1` runs `pnpm test:ci` — tail to stderr, exit 2 on failure (forces a fix before the turn ends); then reminds: gates green? spec linked? sections cited? scope respected?                                                                                              |
|                                                |

Cross-platform note: hooks are PowerShell because the dev host is Windows. CI runs the gates directly (`pnpm check`, `pnpm test:ci`, `pnpm build`) — it does not need these hooks. If a teammate runs on macOS/Linux, port to `.sh` and gate by `$OS` in `settings.json`.

Project skill manifest: `.claude/harness.json` records SHA-256 hashes of seeded files so `templatecentral:standards` / drift-check can detect tampering.

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

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration (v5.0+) -->
