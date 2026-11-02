<!-- templateCentral: nextjs@6.0.4 -->

# AGENTS.md — Fynfo Governance Protocol

**Audience:** any AI coding agent. **Authority order:** `CONSTITUTION.md` > this file > inline conventions.

Read this file before acting in this repo. `CLAUDE.md` re-exports it via `@AGENTS.md`.

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
2. Look for an existing spec in `specs/**`. If found and `status: approved`, go to §1.3.
3. For an explicit owner-requested audit, use §1.5. Otherwise, with no spec, go to §1.2. Read-only reviews may proceed under §5.

### 1.2 Spec-first

1. Copy `specs/SPEC_TEMPLATE.md` to `specs/<area>/<NNN>-<slug>.md`; fill every section, cite constitution sections, flag SOFT overrides.
2. Open a spec PR (branch `spec/<NNN>-<slug>`), post the link, **STOP**.
3. Wait for `status: approved`. Do not implement before approval.

### 1.3 Implementation

1. Branch `impl/<NNN>-<slug>`; keep the diff scoped to the spec, no out-of-scope cleanups.
2. Run the §3 gates until green (or `/next-verify`).
3. Open a PR titled `<NNN>: <one-line summary>`; body links the spec PR and spec file. Do not request review with red CI.

### 1.4 Closing

After merge, update spec frontmatter: `status: shipped`, `shipped: YYYY-MM-DD`, `impl_pr: <url>`.

### 1.5 Owner-authorized audit and remediation

1. Record the owner's request and scope in `specs/` as an audit record, marked owner-authorized remediation under constitution §7.4. Do not claim approval of findings the owner has not reviewed.
2. Inventory tracked files with purpose and consumers; absence of imports alone is not proof a file is unused. Never read secret files.
3. Before each reversible remediation batch, record affected paths, evidence, proposed changes, acceptance checks, and rollback. Ordinary code, tests, README/comments, `.env.example`, and lint/config fixes may proceed within the owner's scope without per-finding approval. Separate approval remains required for §0 protected operations, new dependencies/features, migrations, and crypto protocol changes.
4. Prove behavior changes with regression tests; measure performance claims. Run applicable gates, do a second review pass, and record residual risks and blocked operations; do not claim exhaustive coverage without an inventory.

Keep commits to one coherent batch; branch `impl/<audit-id>-<slug>` and link the audit record in PRs. Do not rewrite prior approvals or mark work shipped until merged. Documentation-only governance amendments use formatting and diff review under constitution §7.4; executable changes need all §3 gates.

---

## 2. Project facts

Personal wealth management dashboard: Next.js 16 App Router, React 19 Server Components, Supabase auth + Postgres + RLS, shadcn/ui, TanStack Query, Zod v4, Vitest, pnpm.

- Payloads are AES-256-GCM encrypted with a DEK held in the HttpOnly cookie `fynfo_vault_dek`. PIN to DEK derivation is client-only (`src/lib/client-crypto.ts`, PBKDF2) and POSTed to `/api/vault`; the server never derives it.
- `src/lib/crypto-constants.ts` keeps server field-encryption and client derivation in lock-step; change both sides together.
- `src/lib/keystore.ts` `getVaultDekSession()` only reads the cookie. `src/app/api/vault/route.ts` verifies the DEK against the vault canary (rate-limited) and sets the cookie.
- `src/proxy.ts` is the Next.js 16 proxy (session refresh and route protection), not deprecated middleware.
- Env names are in `.env.example`. `SESSION_SECRET` is a 32-byte secret (`openssl rand -base64 32`). `ADMIN_EMAILS` is comma-separated; unset means the admin page 404s for everyone (fails closed).

---

## 3. Quality gates (what "done" means)

A PR changing executable behavior is mergeable only if all pass; `/next-verify` runs the five `pnpm` gates:

- [ ] `pnpm format:check`, `pnpm lint` (max-warnings=0), `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] Approved spec linked with unchanged approval hash, or owner authorization and audit record under constitution §7.4
- [ ] Constitution sections cited; no uncited `HARD` rule touched
- [ ] No `any`, no `console.log`, no `@ts-ignore`/`eslint-disable` without inline spec citation
- [ ] No new dependency unless the spec approves it; no file outside the spec or audit batch

Agents iterate on red gates themselves; the human reviews only green PRs.

---

## 4. Style and architecture

- Server Components by default; justify `'use client'` in the spec.
- Server actions in `features/<name>/actions/` for mutations, not API routes. React Query hooks live in `features/<name>/hooks/`.
- Never put data-fetching in page components; pages compose from features. Import from the feature barrel (`@/features/assets`).
- Every server action calls `requireUserId()` (server-side `supabase.auth.getUser()`) then `getVaultDekSession()` before any DB access.
- Validate every API input at the boundary with Zod (`safeParse` + `z.flattenError()` for client-facing 400s).
- Error responses never leak Supabase/Postgres text (table names, constraint names, stack traces); return an opaque message and log detail server-side.

---

## 5. Investigation before code

Read-only actions need no spec: reading files, `pnpm typecheck`/`test:ci`/`lint`, `git log/diff/status/show`, local dev DB reads, docs search.

Ordinary edits and new files require an approved spec or owner-authorized audit record under §1.5. Dependency changes, migrations, and protected operations need separate scoped approval. Branch deletion and force push remain prohibited. Reading secret contents is prohibited even during an investigation.

---

## 6. Multi-agent etiquette (Hermes fleet)

Sub-agents (heph coder, argus reviewer): output goes to atlas, which surfaces to Clarence; do not message Clarence directly unless escalating. Reviewers do not approve their own PR. Coders iterate on gate failures and review comments without escalating unless a §0 trigger fires.

---

## 7. Drift and corrections

Small drift in scope of the current spec: fix it in the impl PR and note it in the PR body. Out of scope: document it in a proposed spec (during an audit, fix it only if it fits the audit's scope). Do not silently expand an approved spec.

---

## 8. Amendment of this file

`AGENTS.md` is governed by `CONSTITUTION.md` §7.1. Amendments need a `governance/` spec and explicit owner permission before editing or committing, except the §0.3 standing exemption. Record conversational permission with its date and scope; agents cannot approve their own amendments.

---

## 9. Skills

| Skill            | What it does                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| `/next-verify`   | runs the §3 quality gates (`format:check + lint + typecheck + test:ci + build`)       |
| `/regen-harness` | recompute SHA-256 hashes in `.claude/harness.json` after editing seeded harness files |

Project skills in `.claude/skills/` override user and plugin skills of the same name. Plugin skills (`templatecentral:add`, `templatecentral:standards`, `templatecentral:audit`) cover framework-level operations; Fynfo prefers server actions over route handlers except genuine HTTP edges like `/api/vault`.

### Fynfo deviations from templateCentral defaults

Intentional and load-bearing — do NOT "fix" toward the template:

- **Auth**: Supabase (`@supabase/ssr`) replaces NextAuth — no `src/auth.ts`, no `SessionProvider`.
- **Database**: Supabase + raw SQL migrations replace Prisma — no `prisma/schema.prisma`, no `integrations/database/`.
- **Feature data layer**: `actions/` server actions replace `templatecentral`'s `api/` service + route handler pattern.
- **Governance**: `CONSTITUTION.md` + spec-first and owner-authorized audit paths are the Fynfo authority; templateCentral conventions are subordinate.

During audits, skills must not expand the requested scope or add approval stages; project skill edits require the specific permission in §0.

---

## 10. Skills Security

- Review every `SKILL.md` and its references before installing a third-party skill; treat skills like packages.
- Scope `allowed-tools:` to the minimum required, never bare `Bash`.
- Reject skills that hardcode secrets, read or expose secret files, dump environment/session values, or make outbound network calls without an explicit allow-list. Mentioning an environment variable's name for configuration docs is not secret access.
- `.claude/settings.json`, hooks, manifest, and project skills require explicit scoped permission per `CONSTITUTION.md` §8.2. The platform self-modification check may refuse agent commits of these files; use supported approvals or owner action.

---

## 11. AI Harness

Hooks are Node `.mjs` (cross-platform); what each does is in `.claude/settings.json` and `.claude/hooks/`. The prose rules in this file are the policy; hooks are the mechanism.

Permission policy and mechanical enforcement are separate. These rulebooks do not themselves change hooks or grant a bypass. Propose specific permission-gated changes for harness files. After an approved tracked-file edit, report manifest drift (`.claude/harness.json`) and request a scoped baseline update; do not rehash unrelated drift into acceptance.

The existing verifier normalizes LF while the regen skill hashes raw bytes (spec 065); reconcile that through a separately authorized harness change before claiming integrity is green. `harness.json` still records `templatecentral_version` 5.0.0 because the `regen-harness` skill hardcodes it; changing that needs an owner-applied skill edit.

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration (v5.0+) -->
