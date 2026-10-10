# Fynfo

Personal wealth management dashboard for savings, investments, equity trades,
salary, Singapore tax/CPF calculations, and expenses. Two accounts can link a
household for shared goals while keeping their personal vaults separate.
Goal completion uses the contributed amount against a positive target; rounded
progress percentages do not establish completion.

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
Supabase Auth account. There is no development authentication bypass. Failed
sign-ins show opaque retry messages. Refreshed sessions preserve cookie options
and private/no-store cache headers through proxy redirects; authentication
callback responses are uncached.
A detected account change or signout hides financial editors and clears cached
records before returning to login. An unavailable initial browser session blocks
financial content with a manual sign-in link; ordinary same-account refreshes
preserve the current editor. Server authorization and user-bound vault cookies
remain mandatory.

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
On the overview, snapshot, salary, planner, expense and trade queries starting
together share a guarded Server Function while each source resolves independently.
Existing history caches and per-source retries remain; other pages keep their original
read path. Query cancellation prevents late replies from overwriting removed
or optimistically updated records.

The dashboard's monthly review combines recorded gross income, your share of
all expense categories and exact-month snapshot changes. It does not infer net
savings, investment returns or zero activity from missing records. Its disclosed
next steps show recorded-data availability and links for checking payslips,
statements and balances; they do not certify a completed or reconciled month.
Contributing records explain salary and bonus, aggregate shared-expense deductions
and both snapshot totals. Expense pages show at most 20 rows while totals include
every matching record.

Search records in the navbar searches the five personal histories only when opened.
It matches recorded text, shows up to four results per source, and identifies
loading, updating or failed sources with individual retry controls. Household
records are excluded. Closing or navigating clears the local search term; it is
never added to URLs, storage or telemetry. Existing owner history caches remain
available to other pages. Only snapshot results open a specific editor; other
results open their feature page.

Successful non-optimistic saves and deletes discard pending pre-write reads before
refreshing the affected records. Existing background refresh behavior remains;
optimistic expense updates retain their rollback behavior.

Investment quotes must include a reported price and currency; missing or mismatched
quotes leave valuation and return estimates unavailable rather than becoming zero.
SGD and USD portfolio amounts are shown separately.
Trade history follows the existing ticker-based SGD/USD inference without FX
conversion; check historical currency against trade statements. Gross value excludes fees.
Distribution suggestions update only the active editor with the same inputs and
holdings. Closing the form discards its pending UI work; reopening starts a fresh
editor. The suggested amount still needs review before saving. Capital return estimates exclude
dividends and currency movements, and require usable dated cash flows and a verified
solver result. Optional SGD conversions require an actual exchange rate. Converted
historical income and spending use the current rate as a planning estimate, not the
payment-date rate. Query refresh time does not establish the provider quote's age.

Distribution scans include historical trade tickers and sold positions within the
existing five-year feed. Entitlement estimates use shares held before the supplied
ex-date. Dates are ex-dates rather than confirmed payments, and currencies retain
the existing SG/US ticker-based inference. Check amounts, currency and payment dates
against received records; provider failures and actual payment evidence require
the separate source/reconciliation contract.

Dividend scans offer retry when market feeds are unavailable. An empty scan means
no eligible estimates were returned; it does not confirm every payment is recorded.

Distribution totals, yield and scans require a successful history read; failed
reads offer retry instead of claiming an empty history. Manual Add stays available.

Expense, trade and distribution saves reject impossible calendar days before
requesting an encryption/database context.
Supported valid dates and timestamps retain their existing timezone behavior.
Legacy unsupported month keys remain unchanged in history and export; charts
qualify their labels as invalid months without dropping amounts. This does not
prevent new unsupported keys or repair existing records. Investment quarter
spending includes the final millisecond of the existing local quarter.

Expense spreadsheet paste uses explicit calendar dates and complete finite positive
amounts. SG day/month order wins for ambiguous dates; unambiguous US and English
month forms remain supported. Invalid financial tokens block automatic and manual
submission until that field is corrected or a fresh valid paste replaces it.
Omitted fields retain the existing Quick Add fallback. Credits are unsupported;
this paste convenience is not a bank statement adapter or duplicate detector.

Quick Add clears accepted entries immediately and keeps rapid keyboard entry.
Each multi-row paste reports its own confirmed, unconfirmed and skipped counts
after its writes settle. An unconfirmed result requires checking the list before
retrying; optimistic rollback does not prove database absence. Late notifications
are suppressed after the form unmounts, including vault/identity teardown.

Shared expense saves reject allocations exceeding the bill at cent precision.
Equal splits distribute remainder cents in person order, with your share last
when included. The dialog shows your actual remainder even in “Paid for” mode;
settled amounts still count toward the allocation. Historical records are not
rewritten by this validation.

Salary tax estimates use the calendar income year (assessment in the next year),
the higher of 15% or resident rates for non-resident employment, and the resident
SGD 80,000 personal relief cap including CPF. They are before rebates, eligible
deductions and special exemptions. Salary-page CPF estimates assume full employee rates and
age 55 and below, using monthly wage bands, whole-dollar employee rounding and
2023–2026 ordinary wage ceilings. Recorded YTD uses individual monthly records;
annual projections spread average recorded salary and bonus across 12 months.
Additional Wage ceilings remain provisional until all employer wages are known.
Unsupported years or calculation boundaries remain unavailable. Citizenship/PR
eligibility and other age tiers are not established. These are planning
estimates, not a filing or payroll calculation. The dashboard allocation planner
retains its separate flat 20% CPF assumption; these payroll-rule corrections do
not change that planning model.

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
expense and relief saves remain last-writer-wins; these transactions do not provide
a durable retry ledger. Relief replacements require READ COMMITTED isolation.
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
expenses, salary, tax reliefs, equity trades, dividends, planner settings, and saved planning scenarios.
The server decrypts these nine personal domains while the vault is unlocked.
Household goals and contributions are excluded. Treat the downloaded file as
sensitive plaintext; there is currently no import/restore workflow. Avoid editing
records during export: independent domain reads do not form one database snapshot.
A failed domain read prevents download; temporary download resources are released
even if browser activation fails, and overlapping export requests are ignored.

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

## Private saved planning scenarios

The Planner's Saved scenarios disclosure captures a named hypothetical plan in your personal encrypted vault (up to ten current scenarios). Opening a saved plan uses its captured salary, expenses and savings/bond balances; editing it never changes actual records, live allocation outputs or automatically saved planner preferences. The saved view names the SGD, flat20% CPF, fixed5% insurance and9-month reserve-funding assumptions. Scenario save conflicts preserve the draft and require an authoritative reload before review or a new save intent. Creation request correlation lasts only while its row exists; no permanent exactly-once or anti-resurrection guarantee is claimed.

Export version3 includes complete current scenarios as a ninth personal domain; a failed or corrupt scenario read prevents the download. Export does not execute restore or provide a consistent cross-domain snapshot.

Apply `supabase/migrations/20261010000103_personal_planning_scenarios.sql` only through the owner's reviewed migration process. Application merge waits for the owner's exact migration confirmation. The reproducible SQL proof is `node supabase/tests/103-personal-planning-scenarios.mjs` (optional second argument: Docker executable path). It requires already-installed `postgres:17-alpine` and `public.ecr.aws/supabase/postgrest:v14.14` images and a running Docker Linux engine. It creates fresh synthetic roles/users, tmpfs database storage and an isolated network, binds HTTP only to loopback, exercises real RLS/CAS/concurrent capacity/PostgREST bigint JSON boundaries, and cleans only resources whose fresh creation IDs it owns. It never connects to an existing database or downloads images.

Inline expense drafts keep independent identities: saving or cancelling one preserves the others. A new draft uses today’s local date when added and freezes only its own controls while saving. Failed saves retain its inputs and identity for retry. A dispatched save may still finish after leaving the page; UI cleanup does not cancel that write or guarantee exactly-once persistence.
