# Fynfo

Personal wealth management dashboard for savings, investments, equity trades,
salary, Singapore tax/CPF calculations, and expenses. Two accounts can link a
household for shared goals while keeping their personal vaults separate.

## Stack

- Next.js 16 App Router, React 19, TypeScript 5.9
- Supabase Auth and PostgreSQL with row-level security
- AES-256-GCM encryption for financial payloads; browser PIN-derived vault keys
- TanStack React Query, React Hook Form, Zod
- Tailwind CSS 4, shadcn/ui, Recharts
- Vitest with optional jsdom and Testing Library component tests
- pnpm, ESLint, Prettier, Husky

## Local setup

Use Node.js 22 or newer and pnpm 11, matching the CI toolchain. A Supabase
project with the repository's reviewed SQL migrations is required. Migration
history lives in `supabase/migrations/`; changes and production application follow
[CONSTITUTION.md](CONSTITUTION.md) and [AGENTS.md](AGENTS.md).

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Edit `.env.local` locally with your Supabase project URL and publishable key.
Generate a random session secret, for example with `openssl rand -base64 32`, and
set `SESSION_SECRET`. Keep this file uncommitted. Financial queries use the
publishable key and each authenticated user's RLS-scoped session.

Configure `SUPABASE_SECRET_KEY` only on the server for the trusted vault-throttle
and telemetry RPCs introduced by spec071. This credential bypasses RLS; never
prefix it with `NEXT_PUBLIC_`, expose it in browser code, or use it for financial
queries. The RPC facade keeps its client private. Missing configuration or failed
throttle RPCs prevent unlock; telemetry remains best-effort.

For Google login, enable the Google provider in Supabase Auth and configure the
Supabase redirect allowlist for the app's `/auth/callback` URL (locally,
`http://localhost:3000/auth/callback`). Email/password login uses an existing
Supabase Auth account. There is no development authentication bypass.

```powershell
pnpm dev
```

Open `http://localhost:3000`. Sign in, then create your financial vault by choosing
and confirming a six-digit PIN. Returning users unlock with their existing PIN.
The browser derives the encryption key; the server seals it in an
HttpOnly session cookie to encrypt and decrypt financial payloads. Keep your PIN
safe: it protects the financial vault independently of your login account.
Resetting an account password does not recover records encrypted with a forgotten
PIN. First-use guidance offers a snapshot, expense or salary record and can be
skipped. Tax/CPF estimates require a usable profile; reserve controls live under
“Adjust reserves” and show their current settings while collapsed.
The dashboard's monthly review combines recorded gross income, your share of
all expense categories and exact-month snapshot changes. It does not infer net
savings, investment returns or zero activity from missing records.

Shared expense saves reject allocations exceeding the bill at cent precision.
Equal splits distribute remainder cents in person order, with your share last
when included. The dialog shows your actual remainder even in “Paid for” mode;
settled amounts still count toward the allocation. Historical records are not
rewritten by this validation.

Salary tax estimates use the calendar income year (assessment in the next year),
the higher of 15% or resident rates for non-resident employment, and the resident
SGD 80,000 personal relief cap including CPF. They are before rebates, eligible
deductions and special exemptions. CPF remains a fixed 20% employee model;
citizenship/PR eligibility, age tiers, monthly rounding and historical intra-year
ceiling changes are not modelled. These are planning estimates, not a filing or
payroll calculation.

Financial histories are paginated with stable ordering and exact counts,
including when the API returns smaller pages. Snapshot history entries, expense splits
and household contributions are paged independently from their parents. A snapshot
edit read returns its revision and full encrypted child set in one statement.
Failed pages or changed counts reject the read. Separate requests can still
observe concurrent edits; JSON export is not a proven point-in-time backup or
restore mechanism and excludes household data.

Snapshot, expense and tax-relief saves prepare encrypted rows before one
authenticated, RLS-protected database transaction. A failed child write rolls
back the parent and all replaced children. Snapshot edits preserve the parent ID.
Spec077's additive migration must be applied before deploying these callers;
missing RPCs reject saves without falling back to partial writes. Same-record
saves remain last-writer-wins; this does not provide conflict detection or a
durable retry ledger. Relief replacements require READ COMMITTED isolation.
RPC arrays accept up to 5,000 rows, with each JSON argument limited to 1 MiB.
Snapshot editors refresh untouched fields from background queries while
preserving dirty drafts. Navigating to a different record loads that record.
Spec083’s distinct additive migration is required before deploying snapshot
compare-save/delete callers. They compare the original parent ID and revision,
including after a month is deleted and recreated. Conflicts or uncertain responses
keep the draft and block another write until explicit review. Reloading saved
values discards the draft; an absent new snapshot leaves it ready to save. Missing
edit records never become automatic creates. Direct table writers remain outside
this application comparison contract. Reload older open editors after rollout;
older deployments can use the legacy RPC, which advances revisions without
comparing them. Expense/relief transactions still use
last-writer-wins. Snapshot revisions stay out of the existing export format.
This protects draft input but does not yet detect stale database edits.

## Environment variables

See [.env.example](.env.example) for the placeholder template.

| Variable                               | Required | Purpose                                                                       |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes      | Supabase project URL                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes      | Public Supabase publishable key                                               |
| `SESSION_SECRET`                       | Yes      | Random secret sealing vault session cookies                                   |
| `SUPABASE_SECRET_KEY`                  | Yes      | Server-only trusted throttle and telemetry RPC access; bypasses RLS           |
| `ADMIN_EMAILS`                         | No       | Comma-separated allowlist for the telemetry admin page; blank disables access |

`NEXT_PUBLIC_*` values are embedded in the browser build. Supply the intended
public values before building. Keep `SESSION_SECRET` server-side and private.

Deploy spec071's two forward SQL migrations, the server-only configuration and
the matching application together. Do not deploy old application code against
the revoked RPC grants. Household migration preflight stops on conflicting
memberships instead of deleting data. Existing key cookies are rejected by the
bound envelope format, so users must unlock again; encrypted records and PIN
derivation remain unchanged. Production migration execution requires separate
owner review and the local SQL checks described in spec071.

## Project structure

```text
src/
├── app/                       # App Router pages, auth callback, HTTP edges
│   ├── (public)/              # Storefront and login
│   ├── dashboard/             # Authenticated pages composed from features
│   └── api/                   # Health, telemetry, vault lifecycle
├── features/                  # Domain actions, hooks, components, schemas, math
├── components/                # Layout, shadcn primitives, shared widgets
├── integrations/              # Browser/server Supabase clients
├── lib/                       # Guards, encryption, keystores, validation, logging
└── proxy.ts                   # Session refresh and route protection
supabase/migrations/            # Versioned schema and RLS policies
test/                          # Unit, action, and component regression suites
specs/                         # Specifications and scoped audit records
```

## Development checks

```powershell
pnpm check          # Route logging, formatting, lint, typecheck
pnpm test:ci        # Vitest suite with coverage thresholds
pnpm test:coverage  # Coverage reporting and configured thresholds
pnpm build         # Production build
pnpm check:harness # Read-only manifest comparison; known baseline drift tracked in spec 065
```

Use `pnpm format` to format files and `pnpm test` for watch mode. Both `test:ci`
and `test:coverage` require at least 81% global line, statement, function and branch
coverage, alongside stricter security-critical file thresholds. Empty test
discovery fails. Two test workers limit memory pressure from browser suites.
The project verification skill and quality gates are documented in
[AGENTS.md](AGENTS.md).

With PostgreSQL 17 installed, verify database authorization and real concurrent
transactions in a new, disposable local cluster:

```powershell
node scripts/test-security-sql.mjs --pg-bin "C:/Program Files/PostgreSQL/17/bin" --data-dir "C:/Temp/fynfo-security-fixture" --port 55472
```

The data directory must not exist. The runner uses localhost fixture roles,
replays relevant historical schema, security, atomic-save and snapshot-revision migrations, and stops the
cluster after testing. It retains fixture data and logs for inspection and does
not connect to the configured Supabase database or read environment files.
It checks anonymous/cross-owner denial, failed-write rollback, parent identity,
and concurrent first and existing snapshot, expense and relief replacements.
Snapshot checks include stale edits/deletes, same-month delete/recreate, lossless
bigint counters, overflow rollback and coherent reads during concurrent writes.

ESLint includes SonarJS checks for commented-out code, identical functions and
incorrect collection-size comparisons. The existing comment convention permits
concise explanations where required; avoid redundant narration and temporary notes.

Add shadcn primitives using `npx shadcn@latest add <component-name>`.

## Personal data export

The profile page downloads a versioned JSON export of profile, snapshots,
expenses, salary, tax reliefs, equity trades, dividends, and planner settings.
The server decrypts these eight personal domains while the vault is unlocked.
Household goals and contributions are excluded. Treat the downloaded file as
sensitive plaintext; there is currently no import/restore workflow.

## Production artifact

`next.config.ts` configures standalone output. Build with the intended public
Supabase settings, then prepare the standalone folder using the existing
`pnpm build:standalone` script in a shell that supports its `cp -a` commands.
It copies `.next/static` and `public` alongside `.next/standalone/server.js`.
For local verification, `pnpm start:standalone` runs that server with `.env.local`;
a deployed runtime must receive its server secrets through the host's secret
configuration.

The constitution specifies Docker as the Raspberry Pi deployment artifact.
This checkout currently contains neither a tracked Dockerfile nor a
`scripts/build-push.sh` implementation. Building and publishing a container needs
those separately approved deployment artifacts; the repository does not currently
provide the Docker commands previously described here.
