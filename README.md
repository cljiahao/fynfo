# Fynfo

Personal wealth management dashboard — track savings, investments, equity trades, and salary with Singapore tax/CPF calculations.

## Stack

- **Next.js 16** with Turbopack dev server
- **React 19** with Server Components
- **TypeScript 5.9**
- **Tailwind CSS 4** with shadcn/ui (new-york style)
- **TanStack React Query** for server state
- **NextAuth (Auth.js)** with Google OAuth + dev credentials
- **Prisma 7** with PostgreSQL
- **React Hook Form** + **Zod** for validation
- **Recharts** for data visualization
- **Docker** multi-stage build (standalone output)

## Prerequisites

- **Node.js** 24+ (or via Docker)
- **pnpm** (corepack enabled)
- **PostgreSQL** 17+

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env — fill in DATABASE_URL, AUTH_SECRET, Google OAuth keys

# 3. Generate auth secret
npx auth secret

# 4. Set up database
npx prisma db push
npx prisma generate

# 5. Start dev server
pnpm dev
```

Dev server runs at `http://localhost:3000` with Turbopack.

In development, a "Dev login (bypass auth)" button appears on the login page — no Google OAuth setup needed for local work.

## Project Structure

```
src/
├── auth.ts                  # NextAuth config (providers, callbacks, PrismaAdapter)
├── proxy.ts                 # Route protection (cookie-based session check)
├── app/
│   ├── layout.tsx           # Root layout (fonts, ThemeProvider, Providers, Toaster)
│   ├── (public)/            # Public pages (home, login)
│   ├── dashboard/           # Authenticated pages
│   │   ├── assets/          # Asset snapshots & charts
│   │   ├── equity/          # Equity trade tracking
│   │   ├── salary/          # Salary & tax planning
│   │   └── expenses/        # Expense tracking
│   └── api/auth/            # NextAuth route handlers
├── components/
│   ├── layout/              # Navbar, Footer, Providers, ThemeProvider
│   ├── ui/                  # shadcn/ui primitives
│   └── widgets/             # Composed reusable components
├── features/
│   ├── auth/                # LoginCard, LoginButton, SignOutButton
│   ├── assets/              # Asset management feature
│   ├── equity/              # Equity trading feature
│   └── salary/              # Salary tracking feature
├── integrations/            # Third-party API clients
└── lib/                     # Shared utilities, constants, Prisma client
```

## Development

### Quality Scripts

```bash
pnpm format          # Format with Prettier
pnpm lint            # ESLint check
pnpm typecheck       # TypeScript check
pnpm check           # Run all checks (format + lint + typecheck)
pnpm test            # Run tests (Vitest)
```

### Database

```bash
# Push schema changes to database (dev)
npx prisma db push

# Regenerate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Adding UI Components

```bash
npx shadcn@latest add <component-name>
```

## Docker

### Build Locally

```bash
# Production image
docker build --target prod -t fynfo:prod .
docker run -p 3000:3000 --env-file .env fynfo:prod

# Development (hot reload)
docker build --target dev -t fynfo:dev .
docker run -p 3000:3000 -v $(pwd):/app fynfo:dev
```

### Build and Push to Docker Hub

```bash
# One-time setup for multi-arch builds
docker buildx create --name multiarch --use

# Build for arm64 (Raspberry Pi) + amd64 and push
./scripts/build-push.sh              # pushes :latest
./scripts/build-push.sh v1.0.0       # pushes :v1.0.0 + :latest
```

### Deploy on Raspberry Pi

On the Pi, pull and run the image:

```bash
docker pull cljiahao/fynfo:latest
docker run -d \
  --name fynfo \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  cljiahao/fynfo:latest
```

Use [Watchtower](https://containrrr.dev/watchtower/) for automatic updates when you push a new image:

```bash
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --cleanup \
  --interval 300 \
  fynfo
```

## Environment Variables

| Variable               | Required | Description                                          |
| ---------------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                         |
| `AUTH_SECRET`          | Yes      | NextAuth secret (generate with `npx auth secret`)    |
| `AUTH_URL`             | Yes      | App URL (e.g., `https://your-domain.com`)            |
| `AUTH_GOOGLE_ID`       | No       | Google OAuth client ID                               |
| `AUTH_GOOGLE_SECRET`   | No       | Google OAuth client secret                           |
| `NEXT_PUBLIC_BASE_URL` | No       | Public app URL (defaults to `http://localhost:3000`) |
