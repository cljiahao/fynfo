---
id: 005
slug: email-password-admin-auth
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-11
approved: 2026-06-11
shipped:
supersedes: # partially supersedes 004's admin-gate decision (ADMIN_USER_IDS -> ADMIN_EMAILS)
constitution_satisfies:
  - '§2.5' # 'use client' justified (form interactivity)
  - '§2.6' # barrel exports
  - '§2.7' # named exports
  - '§3.1' # RHF + Zod for the form
constitution_overrides:
  - section: '§1.2'
    reason: 'Adds email/password as a second login method alongside Google OAuth. §1.2 (post-gov-013) already allows open account signup; this widens the *method*, not the posture. SOFT/purpose section — parenthetical updated to "(OAuth or email/password)". No HARD rule touched.'
---

# Spec 005: Email/password login + email-based admin gate

## Problem

The admin telemetry page (spec 004) gates on `ADMIN_USER_IDS` (Supabase UUIDs), which is awkward to populate — you must dig your user UUID out of Supabase. The app also logs in via Google OAuth only. Clarence wants to (a) sign in with an email/password account and (b) have admin determined by email, which is far easier to set than a UUID.

## Constitution check

- Satisfies: `§2.5`, `§2.6`, `§2.7`, `§3.1`.
- Overrides: `§1.2` parenthetical only (login method widened to email/password; posture unchanged). No `HARD` rule affected — auth method addition is not banned (§3.1 pins RHF+Zod, which the form uses).

## Solution shape

### Auth surface

- **New** `src/features/auth/components/email-login-form.tsx` (`'use client'` — form state + `supabase.auth.signInWithPassword`). RHF + Zod (`{ email: z.email(), password: z.string().min(1) }`). On success → `router.push(PAGE_ROUTES.DASHBOARD)`; on error → inline opaque message ("Invalid email or password"), never leak which field failed.
- `login-card.tsx`: render the Google button, a subtle "or" divider, then `EmailLoginForm`. Google stays the primary path.
- **Sign-IN only** — no public email sign-up form. The admin account is created in the Supabase dashboard (Auth → Users → Add user). Email provider's public sign-ups SHOULD be disabled in Supabase settings (Clarence) so email/password is invite-only.
- Barrels: export `EmailLoginForm` from `features/auth/components/index.ts` + `features/auth/index.ts`.
- No OAuth callback involved — `signInWithPassword` sets the session client-side directly.

### Admin gate (supersedes 004's UUID gate)

- `src/lib/admin.ts`: replace UUID helpers with email helpers — `parseAdminEmails(raw)` (split/trim/lowercase) + `isAdminEmail(email, raw)` (case-insensitive compare). Drop `ADMIN_USER_IDS` semantics.
- `src/features/admin/lib/get-marketing-stats.ts`: read the email from `supabase.auth.getUser()` (not just `requireUserId()`), gate via `isAdminEmail(user.email, process.env.ADMIN_EMAILS)`; `notFound()` for non-admins.
- **Env**: `ADMIN_EMAILS` (comma-separated) replaces `ADMIN_USER_IDS`. Clarence sets it in `.env.example` / local `.env` / Vercel.

### Docs

- `CONSTITUTION.md §1.2`: "(OAuth)" → "(OAuth or email/password)".
- `AGENTS.md` Required env: `ADMIN_USER_IDS` → `ADMIN_EMAILS`.
- Update spec 004's frontmatter/acceptance note to point the gate decision here.

## Out of scope

- Public email sign-up / password-reset / email-verification UI (admin account is dashboard-provisioned).
- Magic-link / OTP auth.
- Exempting `/dashboard/admin` from `VaultGate` — the admin account sets a PIN once like any user (the admin page itself needs no DEK). Flag only; revisit if it annoys.
- Any change to the vault / encryption / RLS model.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; tests updated for `isAdminEmail` (case-insensitive, blank/missing allowlist) + the email-login Zod schema (reject bad email, empty password)
- [ ] `pnpm build` green
- [ ] Manual: email/password account from Supabase dashboard signs in via the login page; lands on dashboard; `/dashboard/admin` renders for an `ADMIN_EMAILS` match and 404s otherwise; Google login still works
- [ ] Supabase: Email provider enabled, public sign-ups disabled (Clarence)

## Risk & reversibility

- **Blast radius:** new login method + changed admin gate. Password auth adds an attack surface, but: sign-in only (no public signup), Supabase provides login rate-limiting, and the admin portal exposes only non-PII aggregate telemetry — low blast radius if an admin credential leaks. No financial-data path touched.
- **Reversibility:** remove `EmailLoginForm` from `login-card`, revert `admin.ts`/gate to UUID, unset `ADMIN_EMAILS`. Single git revert. Disable the Email provider in Supabase.
- **Backout plan:** `ADMIN_EMAILS` unset ⇒ admin page 404s for everyone (fails closed); removing the form leaves Google OAuth intact.

## Open questions

- [ ] Q: Disable public email sign-ups in Supabase (invite-only)? Owner: Clarence. A (recommended): yes — keeps email/password to the admin account only.
