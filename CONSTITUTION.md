# Fynfo Constitution

**Version:** 2.0
**Effective:** 2026-05-25
**Owner:** Clarence (cljiahao27@gmail.com)
**Status:** Living document. Amendments tracked in git history.

Every agent-generated PR is governed by this document. Specs must cite which sections they satisfy or override. Quality gates enforce a subset mechanically.

Rules tagged `HARD` are never broken. `SOFT` rules are defaults; overrides require an explicit note in the spec with reasoning.

---

## §1. Purpose

### §1.1 What Fynfo is

Personal wealth management dashboard for a single Singapore user. Tracks savings, investments, equity trades, salary, expenses. Self-hosted on Raspberry Pi via Docker.

### §1.2 What Fynfo is NOT

- Not a financial advisor. No automated trading, no recommendations.
- Not a real-time trading platform. Daily/weekly cadence acceptable.
- Not a bank or aggregator. No bank-login sync, no live multi-currency — best-effort, owner-entered snapshots by design.
- Not a paid multi-tenant SaaS — yet. Billing, plans, and horizontal scale are out of scope until a future `specs/governance/` amendment opts in.

It MAY have a public marketing storefront, anonymous non-PII operational telemetry (§2.2 carve-out), and open account signup (OAuth or email/password). Each account stays single-user and zero-knowledge — more accounts do not weaken the per-user RLS + PIN-derived encryption model.

**Why:** The security model (zero-knowledge, per-user RLS — §2.1, §5) and the deployment model (single Pi / Vercel, no horizontal scale) must hold regardless of how many accounts exist. Monetisation is gated behind an explicit governance decision, not drifted into.

---

## §2. Architecture Invariants

### §2.1 `HARD` Zero-knowledge encryption for financial payloads

All monetary amounts, tickers, salary figures, account identifiers MUST be AES-256-GCM encrypted via `encryptPayload` before reaching Supabase. Decryption only in-process after `getVaultDekSession()` returns the DEK from the HttpOnly cookie.

**Why:** Supabase operators must not be able to read financial data. PIN-derived DEK never persisted to disk.

### §2.2 `HARD` Server actions are the only mutation surface

Mutations live in `src/features/<name>/actions/`. No `/api/` route handlers for mutations. API routes reserved for: NextAuth callbacks (none currently), `/api/vault` (DEK lifecycle), `/api/health`, `/api/track` (anonymous operational telemetry — see telemetry carve-out below).

**Why:** Single mutation pattern = single auth+vault gate to audit.

**Telemetry carve-out:** `/api/track` may write ONLY to non-financial, non-PII operational telemetry tables (no `user_id`, no plaintext or ciphertext financial payload, no identifiers). It validates input at the boundary (Zod) and is the single auditable ingestion gate. This is the only sanctioned anonymous write path.

### §2.3 `HARD` Every server action calls `requireUserId()` then `getVaultDekSession()` before DB access

Applies to every action or read that touches encrypted feature data. Order matters: identity first, vault second.

Two scoped exceptions, both non-financial and vault-free:

1. Anonymous operational telemetry ingestion via the §2.2 `/api/track` carve-out (no identity, no vault — it stores no user data).
2. Admin aggregate reads of non-encrypted operational data (e.g. visit/signup counts) require `requireUserId()` + an admin-allowlist check, but NOT `getVaultDekSession()` — there is no ciphertext to decrypt.

Outside these two, public actions still don't exist.

**Why:** Defense-in-depth. RLS is the floor, not the ceiling. Missing either call = data leak class bug.

### §2.4 `HARD` Pages compose features; pages do not fetch data

Page components in `src/app/dashboard/**/page.tsx` render feature components. Data-fetching happens in feature hooks or feature server actions. Pages stay thin.

**Why:** Keeps routing layer swappable and feature modules testable in isolation.

### §2.5 `SOFT` Server Components by default

Client components only when interactivity, browser APIs, or state hooks are required. Spec must justify `'use client'` if added.

**Why:** Smaller bundles, better caching, less hydration cost.

### §2.6 `HARD` Barrel exports per feature

Import from `@/features/<name>`, never deep paths like `@/features/assets/components/Foo`. Each feature owns its public surface via `index.ts`.

**Why:** Refactor safety. Internal restructure should not break callers.

### §2.7 `HARD` Named exports only

Never `export default` except where Next.js requires it (page, layout, route, middleware).

**Why:** Better grep, better IDE rename, no naming drift on import.

---

## §3. Tech Constraints

### §3.1 `HARD` Pinned stack

- Next.js 16.x (App Router, Turbopack dev)
- React 19.x
- TypeScript 5.9+
- Supabase (auth + Postgres + RLS); migrations via SQL in `supabase/migrations/`
- Tailwind 4 + shadcn/ui (new-york style)
- TanStack React Query 5.x for server state
- React Hook Form + Zod for forms/validation
- Recharts for visualization
- Vitest for tests
- pnpm as package manager

**Why:** Stack is opinionated and load-bearing. Swapping any of these = constitutional amendment + migration spec.

### §3.2 `HARD` Banned

- `any` — use `unknown` and narrow.
- Inline styles — use Tailwind.
- Manual install of shadcn primitives — use `npx shadcn@latest add <name>`.
- Direct `fetch`/`axios` from components — go through `integrations/clients/` or feature hooks.
- Inline static data in components — extract to `constants.ts`.
- `console.log` in committed code (use proper logger or remove).
- Hardcoded secrets, API keys, or PII test data.

### §3.3 `SOFT` Server actions over API routes

When in doubt, server action. API routes only for the documented exceptions in §2.2.

### §3.4 `HARD` File naming

- Files: kebab-case (except Next.js specials: `page.tsx`, `layout.tsx`, `route.ts`, etc.)
- Components/types: PascalCase
- Functions/hooks/vars: camelCase
- Constants: UPPER_SNAKE_CASE

---

## §4. Quality Bar

### §4.1 `HARD` Quality gates must pass before review

`pnpm check` (format + lint + typecheck) and `pnpm test:ci` must both pass green on every PR. Agents iterate until green; humans do not see red PRs.

### §4.2 `SOFT` Test coverage targets

- New features: tests for tax/CPF calculations, crypto/keystore, server actions, schemas. UI snapshot tests optional.
- Bugfix: regression test required (test fails on `main`, passes on PR).
- Coverage floor: 60% lines on `src/lib/` and `src/features/*/actions/`. Below = spec must justify.

### §4.3 `HARD` No `eslint-disable` or `@ts-ignore` without spec note

Each suppression cites the spec section and reason inline: `// eslint-disable-next-line foo -- spec §X.Y: <reason>`.

### §4.4 `HARD` Build must succeed

`pnpm build` green on PR. Broken build = blocked merge.

### §4.5 `SOFT` Performance budget

Initial page load under 200KB JS gzipped per route. New dependency >50KB requires spec justification.

---

## §5. Security Non-Negotiables

### §5.1 `HARD` PIN/DEK invariants

- PIN never logged, never stored server-side, never sent to Supabase.
- DEK lives only in HttpOnly cookie `fynfo_vault_dek` and process memory.
- DEK derivation: PBKDF2 with Supabase user ID as salt. Iteration count is constitutional — changing it = migration spec + re-derivation flow.

### §5.2 `HARD` RLS is mandatory on every table

New tables ship with RLS enabled and a policy in the same migration. No `GRANT ALL` shortcuts.

### §5.3 `HARD` Secrets in `.env.local` only

Never committed. `.env.example` lists required keys with placeholder values. CI/CD reads from secret store, not repo.

### §5.4 `HARD` Encrypted columns are opaque to Supabase queries

Do not write SQL that filters/sorts on encrypted columns. All such operations decrypt client-side after fetch.

**Why:** Pattern leaks reveal value clusters even without plaintext.

---

## §6. Deployment & Operations

### §6.1 `HARD` Docker multi-stage build is the deployment artifact

Pi runs `cljiahao/fynfo:latest` via Watchtower. Local `pnpm dev` is dev-only.

### §6.2 `SOFT` One environment

Currently no staging. Production = Pi. Migrations run against prod after spec approval + local replay against a fresh DB copy.

### §6.3 `HARD` Schema migrations are forward-only

No destructive migrations without a backup spec citing the backup procedure executed beforehand.

---

## §7. Change Protocol

### §7.1 Amending this constitution

1. Open spec under `specs/governance/` proposing the amendment.
2. Spec cites: section, rationale, blast radius, migration plan (if breaking).
3. Self-approve as owner. Commit constitution + spec together. Bump version (semver: MAJOR for HARD changes, MINOR for SOFT changes, PATCH for clarifications).
4. Update `CLAUDE.md` and `AGENTS.md` pointers if surface changed.

### §7.2 Override protocol (per-spec)

A spec may request a SOFT rule override by citing the section and reason. HARD rules cannot be overridden per-spec — they require constitutional amendment first.

### §7.3 Drift audit

Weekly: `auditor` agent scans repo against `HARD` rules, reports violations. Violations either get fixed or get a backdated spec acknowledging the exception.

---

## §8. Agent Scope

### §8.1 What agents may do unsupervised

- Write specs (require human approval before impl).
- Draft amendments to `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md`, and `specs/governance/*` (git-reviewable; require explicit human approval before commit).
- Implement approved specs.
- Run quality gates and iterate until green.
- Open PRs.
- Review other agents' PRs (post-gates).
- Run read-only investigations.

### §8.2 What agents may NEVER do unsupervised

- Force-push, rewrite history, delete branches.
- Edit the enforcement layer or secrets: `.claude/settings.json`, `.claude/hooks/**`, `.claude/harness.json`, `.claude/skills/**`, `.env*`, `.github/workflows/**`, `scripts/build-push.sh`, or any cert/key file. This is the lock-on-the-lock — never agent-editable.
- Commit changes to `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md`, or `specs/governance/*` without explicit human approval (drafting is allowed; the human reviews the diff and approves before commit).
- Run destructive migrations.
- Touch `.env*` files.
- Push images to Docker Hub.
- Approve their own specs.

### §8.3 Escalation triggers

Any of the following = stop and ask Clarence:

- HARD rule would be violated.
- Spec ambiguity that affects security or data shape.
- New dependency.
- Cost projection > $5 for the task.
- Confidence below "I'd bet money on this".

---

## Amendment Log

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-05-25 | Initial ratification.                                                                                                                                                                                                                                                                                                                                            |
| 2.0     | 2026-06-11 | §2.2/§2.3 telemetry carve-out: sanctioned anonymous, non-PII, non-financial operational telemetry via `/api/track` + admin aggregate reads without vault. Agent edit-scope widened (§8): rulebooks/specs are agent-editable with human approval; enforcement layer + secrets stay human-only. Authorized by `specs/governance/013-telemetry-write-exception.md`. |
