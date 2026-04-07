# Fynfo — Claude Code Guide

Personal wealth management dashboard (Singapore). Built with Next.js 16, React 19, Prisma, PostgreSQL, shadcn/ui.

## Quick Start

```bash
pnpm install
pnpm dev           # http://localhost:3000
pnpm build && pnpm lint && pnpm test
```

**Local dev auth**: username `dev`, password `dev`

## Project Structure

```
src/
├── app/                    # App Router (pages & routes)
│   ├── (public)/          # Login (no auth required)
│   └── dashboard/         # Protected pages (assets, equity, salary, expenses, profile, entry)
├── features/<name>/       # Feature modules (actions, components, hooks, lib, types, schemas, constants, index.ts)
├── components/
│   ├── layout/           # App shell (Navbar, Providers, ThemeProvider)
│   ├── ui/               # shadcn/ui primitives (managed by CLI)
│   └── widgets/          # Reusable composed components
├── integrations/         # Third-party API clients & services
├── lib/                  # Shared (prisma, constants, errors, utils)
└── auth.ts               # NextAuth config + dev credentials provider
```

**Key routing**: `src/proxy.ts` wraps `auth()` to protect dashboard routes.

## Fynfo-Specific Rules

**Architecture:**
- Route groups: `(public)/` for public, `dashboard/` for authenticated
- Server actions in `features/<name>/actions/` for mutations (NOT API routes)
- React Query hooks in `features/<name>/hooks/` for data fetching
- Barrel exports (`index.ts`) — prefer `import { Foo } from '@/features/assets'` over deep imports

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
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Session encryption key
- `NEXTAUTH_URL` — Base URL (http://localhost:3000 for dev)

**Key files to know:**
| File | Purpose |
|------|---------|
| `src/auth.ts` | NextAuth config, providers, JWT, PrismaAdapter |
| `src/proxy.ts` | Route protection (auth() wrapper) |
| `prisma/schema.prisma` | Database schema (MonthlySnapshot, AssetEntry, SalaryRecord, EquityTrade, etc.) |
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
- Prisma + PostgreSQL for persistence
- Server actions pattern for mutations
- recharts for visualizations, date-fns for formatting

**Auth alignment (2026-03-21):**
- Single `src/auth.ts` (templateCentral pattern)
- Dev credentials provider for local dev
- `features/auth/` module with LoginCard, LoginButton, SignOutButton
- Login under `(public)/` route group
- SessionProvider + QueryClientProvider at root layout

**When adding features**, follow: create feature folder → add Prisma models → create server actions → create hooks → create UI components → add dashboard page → add route to constants.
