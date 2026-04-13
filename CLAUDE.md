# Fynfo — Claude Code Guide

Personal wealth management dashboard (Singapore). Built with Next.js 16, React 19, Supabase, shadcn/ui.

## Quick Start

```bash
pnpm install
pnpm dev           # http://localhost:3000
pnpm build && pnpm lint && pnpm test
```

## Project Structure

```
src/
├── app/                    # App Router (pages & routes)
│   ├── (public)/          # Login (no auth required)
│   ├── dashboard/         # Protected pages (assets, equity, salary, expenses, profile, entry)
│   └── api/               # API routes (health, vault)
├── features/<name>/       # Feature modules (actions, components, hooks, lib, types, schemas, constants, index.ts)
├── components/
│   ├── layout/           # App shell (Navbar, Providers, ThemeProvider)
│   ├── ui/               # shadcn/ui primitives (managed by CLI)
│   └── widgets/          # Reusable composed components
├── integrations/         # Third-party API clients & services
│   ├── clients/          # Browser-side clients (supabase.ts, base/)
│   └── services/         # Server-side clients (supabase.ts)
├── lib/                  # Shared (auth-guard, crypto, keystore, constants, errors, utils)
└── proxy.ts              # Middleware — Supabase session refresh + route protection
```

**Key routing**: `src/proxy.ts` validates the Supabase session and redirects unauthenticated users to `/login`.

## Fynfo-Specific Rules

**Architecture:**

- Route groups: `(public)/` for public, `dashboard/` for authenticated
- Server actions in `features/<name>/actions/` for data mutations — NOT API routes
- React Query hooks in `features/<name>/hooks/` for data fetching
- Barrel exports (`index.ts`) — prefer `import { Foo } from '@/features/assets'` over deep imports
- All server actions must call `requireUserId()` from `@/lib/auth-guard` then `getVaultDekSession()` from `@/lib/keystore` before any DB access

**Security & Quality:**

- NEVER create client components unless interactivity requires it — prefer server components
- NEVER put data-fetching in page components — pages compose from features
- NEVER use inline styles — use Tailwind classes
- NEVER use `any` — use `unknown` and narrow with type guards
- NEVER install UI primitives manually — use `npx shadcn@latest add`
- Static data in `constants.ts`, NEVER inline in components
- Delegate logic to hooks and services — keep components thin

**Naming (project-wide):**

- Files: kebab-case (except Next.js specials)
- Components/types: PascalCase
- Functions/hooks/vars: camelCase
- Constants: UPPER_SNAKE_CASE
- Exports: ALWAYS named exports (NEVER `export default` except Next.js files)

## Environment & Key Files

**Required `.env.local`** (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
- `SESSION_SECRET` — 32-byte secret for encrypting the vault DEK cookie (generate: `openssl rand -base64 32`)

**Key files to know:**
| File | Purpose |
|------|---------|
| `src/proxy.ts` | Middleware: Supabase session refresh + route protection |
| `src/lib/auth-guard.ts` | `requireUserId()` — Supabase auth check for server actions |
| `src/lib/crypto.ts` | `encryptPayload` / `decryptPayload` — AES-256-GCM field encryption |
| `src/lib/keystore.ts` | `getVaultDekSession()` — reads DEK from HttpOnly cookie; `deriveKeyFromPin()` — PBKDF2 |
| `src/app/api/vault/route.ts` | PIN → DEK derivation; sets `fynfo_vault_dek` HttpOnly cookie |
| `src/integrations/clients/supabase.ts` | Browser-side Supabase client |
| `src/integrations/services/supabase.ts` | Server-side Supabase client (uses cookies) |
| `supabase/migrations/` | SQL schema + RLS policies |
| `src/features/salary/lib/tax-cpf.ts` | Singapore tax/CPF calculation logic |

## Domain Context

**Features:**

- **Assets**: snapshot tracking (savings, bonds, stocks, ETF, non-equity, crypto, pension)
- **Equity**: stock trading with P&L tracking
- **Salary**: income tracking with Singapore tax/CPF calculations
- **Expenses**: spending categorization
- **Profile**: user settings & configuration

**Domain logic**: Asset categories, tax/CPF calculations, and monetary values defined in feature constants and `lib/`.

## For Patterns & Standards

Reference **templateCentral** for:

- **Code standards & naming**: `templateCentral/claude-skills/nextjs/code-standards/SKILL.md`
- **Adding pages**: `templateCentral/claude-skills/nextjs/add-page/SKILL.md`
- **Adding components**: `templateCentral/claude-skills/nextjs/add-component/SKILL.md`
- **Adding forms**: `templateCentral/claude-skills/nextjs/add-form/SKILL.md`
- **Adding integrations**: `templateCentral/claude-skills/nextjs/add-integration/SKILL.md`
- **General Next.js patterns**: See `templateCentral/README.md` for skill index

**Fynfo deviates from templateCentral in these intentional ways:**

- **Auth**: Supabase (`@supabase/ssr`) replaces NextAuth — no `src/auth.ts`, no `SessionProvider`
- **Database**: Supabase + raw SQL migrations replace Prisma — no `prisma/schema.prisma`, no `integrations/database/`
- **Feature data layer**: `actions/` server actions replace templateCentral's `api/` service + route handler pattern
- **Integrations**: `integrations/clients/supabase.ts` (browser) and `integrations/services/supabase.ts` (server) are Fynfo-specific; the base axios/fetch clients remain from the template

## Complex Work Protocol

For tasks touching 3+ files or involving architectural decisions:

1. **Plan**: Task summary, files, approach, risks, open questions
2. **Get confirmation** before coding
3. **Track progress** with a checklist
4. **Validate**: Build, lint, test
5. **Document**: Append significant decisions to "Project Notes" below

## Project Notes

**Initial scaffold (2026-03-16):**

- Domain-specific routes (assets, equity, salary, entry, expenses) instead of generic `[id]`
- Server actions pattern for mutations
- recharts for visualizations, date-fns for formatting

**Supabase & E2E Encryption Migration (2026-04-11):**

- Migrated from Prisma + NextAuth to Supabase.
- Supabase handles auth (OAuth) and database with Row Level Security (RLS).
- **True Zero-Knowledge Encryption**: Financial payloads (amounts, tickers, salaries) are AES-256-GCM encrypted _before_ hitting Supabase.
- The Data Encryption Key (DEK) is derived from a 6-digit user PIN via PBKDF2 (salt = Supabase user ID), locked in a secure HttpOnly session cookie (`fynfo_vault_dek`), never stored on disk.
- The dashboard layout checks for the vault cookie; if absent, `VaultUnlockFlow` overlay is shown.
- All server actions inside `features/` must call `requireUserId()` then `getVaultDekSession()` and use `encryptPayload`/`decryptPayload` to interact with the database.
