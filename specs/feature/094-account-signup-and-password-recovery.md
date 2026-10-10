---
id: '094'
slug: account-signup-and-password-recovery
area: feature
status: draft
created: 2026-10-10
author: Codex
constitution_satisfies:
  [
    '§2.1',
    '§2.2',
    '§2.3',
    '§2.4',
    '§2.5',
    '§3.1',
    '§4.1',
    '§4.2',
    '§4.4',
    '§5.1',
    '§7.4',
    '§8.2',
  ]
constitution_overrides: []
---

# Email account creation and login-password recovery

Draft proposal only; no product implementation or provider configuration changes. Clarence's approved roadmap 081 batch H authorizes this intended feature direction. The unresolved hosted configuration below prevents a production-readiness claim; this draft does not invent an approval for settings, dependencies or templates.

## Evidence and problem

Reviewed merged main 298befa (PR19) and the earlier external account-contract review. PR19 already fixes callback errors, pending OAuth initiation, thrown sign-in/exchange failures and auth cache headers. Do not repeat that batch. Login still has Google and existing-account password sign-in only: no signup, reset request or update-password route.

Installed `@supabase/ssr` 0.10.2 configures the browser client with PKCE; installed `supabase-js` 2.103.0 sends code challenges in email signup and password recovery. Current callback exchanges a code, allows only safe same-origin local destinations and prevents caching. Proxy publicly permits exactly the existing login/callback/home routes; authenticated login redirects to dashboard. Dashboard VaultGate requires the financial PIN, so password update must be outside it. Existing query caches are tab-local, and normal sign-out clears them and the vault/household cookie through the existing lock route.

Tracked local Supabase configuration enables email signup, disables email confirmation/secure password change, and sets minimum password length 6. This describes local development only. It does not establish hosted configuration, delivery, templates or actual policy.

## Smallest UI and SDK contract

Keep the existing login card and Google option. Add two quiet links: Create account and Forgot password. Each opens a dedicated small form using existing card/form/input/button components. No finance onboarding, optional controls or duplicate OTP/magic-link flow.

- `/signup`: email, new password and repeat password. Use existing browser Auth client `signUp` with a fixed callback destination. A real immediate session leads to a full document navigation after cache/session-boundary cleanup; a null session gets account-neutral Check your email / sign in guidance. Do not inspect obfuscated-user details or claim an account was created from `data.user` alone. Returned duplicate-account outcomes stay neutral. Preserve existing sign-in password validation separately.
- `/forgot-password`: email only, public exact route. Request `resetPasswordForEmail` with a fixed same-origin callback URL leading to `/account/update-password`. Successful completion says If an account exists, check your email. Returned/thrown transport failures are opaque and retryable. Use the latest link in the original browser/device; no delivery/existence guarantee. Clearly state that this changes login access only and cannot recover a forgotten financial PIN.
- `/account/update-password`: authenticated, outside the dashboard/VaultGate. A server feature component verifies the current user with `getUser`; the page only composes it. Display the account being changed and collect new/repeated password. Verify current identity again before `updateUser`, clear stale input if auth changes, and handle auth loss or policy errors without rendering provider detail. Missing/expired/used/cross-device links lead to concise Start again guidance. A failed recovery callback must lead to the public request page with a known opaque retry message, even when an older account session exists; the current login redirect would hide the failure behind the dashboard. Do not infer recovery success from that older session. A user directly entering the authenticated update route may change their own identified account only under the provider policy; it is not proof that an email link was verified.

Use the existing PKCE code callback, not a new token_hash/verifyOtp endpoint. Request URLs come from constants and the current origin; no user-supplied redirect field. Preserve safe-local destination handling, cookies and private/no-store headers from PR19. Same-tick guards, pending buttons, mounted-result guards, accessible visible errors and cleared password fields apply to all forms. Do not store passwords, email links or token values in localStorage/logs/telemetry.

Browser Auth SDK calls follow the existing external-auth boundary used by sign-in/OAuth. No public financial server action or new mutation API is proposed. If governance treats external signup/password updates as application mutations under §2.2, clarify that interpretation before implementation; never manufacture a public vault-free financial mutation exception.

## Identity/session boundary prerequisite

Do not reuse `useSignOut` outside its VaultLockProvider: it requires dashboard context. Reuse/extract the existing cache-clear and lock-route teardown through a small shared helper only if the actual consumers justify it. On successful password update, clear personal query state and vault/household sessions, sign out and return to login using a full document navigation. If teardown fails after update succeeds, say Password changed; finish signing out with a retry action rather than claim the password update failed or submit it again. Do not promise that remote access tokens or other tabs disappear instantly.

Account changes and signup immediate sessions must not inherit prior decrypted caches. Current Providers has no auth-identity watcher, while Supabase sessions can be broadcast between tabs. Source inspection alone is not an end-to-end reproduction, but this is a required synthetic boundary test before shipping new in-app account flows. A separate ordinary remediation may be needed for stale financial UI on SIGNED_OUT or a different user ID. Use auth events only to clear/lock UI, never as an authorization substitute; keep verified `getUser` gates. Avoid calling async Auth APIs synchronously inside an auth-event callback. Do not casually replace Providers or crypto/session protocols as a hidden feature expansion.

## Hosted owner configuration confirmation required

Only non-secret yes/no settings and exact public URLs are needed; do not request passwords, SMTP credentials, project access tokens, session cookies, PINs or confidential records.

1. Email provider and public signup are enabled for the intended audience; confirmation requirement is known. Both confirmation-required and immediate-session code paths can be tested, but production copy must match the chosen configuration.
2. Site URL is the intended production origin. Add/confirm the exact signup callback and reset callback URLs generated by the app. Proposed signup URL: `https://fynfo.vercel.app/auth/callback?next=%2Fdashboard`; proposed recovery URL: `https://fynfo.vercel.app/auth/callback?next=%2Faccount%2Fupdate-password`. Do not assume query matching, development wildcards or existing OAuth allowlists cover them. Local/preview URLs are separately explicit.
3. Confirmation and recovery templates are compatible with this PKCE code flow. Default/edited ConfirmationURL links must reach the supplied redirect; if templates instead construct token_hash or implicit fragments, revise the scoped contract before implementation. Email tracking must not rewrite verification links. No automated template changes.
4. Production mail delivery is configured for intended users and owner can perform a private test. Supabase's default sender currently accepts organization-team addresses only and limits delivery to 2/hour; an app success response cannot prove delivery. Custom SMTP credentials remain owner-only.
5. Confirm minimum password length, required characters and secure-password/current-password policies. Provider rules are authoritative. Do not infer them from local minimum 6, silently disable them, or add current-password/nonce requirements to a recovery page by guess. A fresh recovery session may satisfy recent-auth rules; policy errors require safe restart guidance. Confirm CAPTCHA status; if enabled, do not bypass it. Any new integration/dependency needs its own scoped approval.

No configuration change is authorized by this proposal. Owner's smoke test can confirm that a fresh link reaches the correct account/update form and a new login password works, without sharing access with an agent.

## Scoped paths and constitutional boundaries

Proposed paths: auth components/hooks/schema/constants/barrels; new thin signup, forgot-password and account/update-password pages; proxy exact public-route additions; route constants; existing callback only where a specific recovery failure/identity contract needs it; synthetic auth/proxy/callback tests; README and final spec 094. A separate cache-identity remediation record precedes broader Providers changes if reproduced. No new dependencies, migrations, protected files or crypto changes. Financial payload mutation and vault auth gates remain unchanged. Client components are justified by forms and browser Auth SDK calls; page data access stays in features.

## Acceptance

Synthetic provider boundaries cover confirmation-required/immediate-session/obfuscated-existing-user signup; account-neutral reset responses; returned/thrown failures; exact callback URLs; duplicate activation; mismatched/weak passwords; expired/used/missing/cross-device codes; failed recovery while an old session exists; missing user and changed identity at submission; successful password update followed by failed teardown/retry; no key/canary/financial mutation; no old-user cache or draft surviving identity switch. Preserve all PR19 callback/cookie/cache-header regressions. Browser proof covers readable desktop/mobile forms, keyboard operation, visible limitations and no password retention after success/unmount.

Run normal full gates in isolated synthetic fixtures, every aggregate coverage metric above 80% and existing security floors, plus independent review. No live account creation, recovery email or provider request is part of agent verification. Production activation waits for the owner's settings confirmation and private smoke test; code review does not establish SMTP delivery.

## Risk, rollback and recommendation

Auth/UI errors can block access or confuse account identity; encryption remains bound to the original Supabase user ID. Revert a scoped app commit; no financial data migration. Provider changes, if later approved and performed by the owner, have their own rollback.

Prepare schemas, form behavior, exact routing, identity-safe cleanup and synthetic tests under the standing roadmap feature direction after finalizing this scope. Hold app rollout until non-secret provider contract confirmation. Prefer one coherent account-flow PR if that contract is settled; otherwise finish reviewable code/spec work without exposing a broken recovery link, and continue independent roadmap work. Do not mark roadmap H complete from UI-only tests, and do not sell password recovery as forgotten-PIN recovery.

## Primary sources

[Password authentication](https://supabase.com/docs/guides/auth/passwords): hosted/local confirmation defaults; public reset request and authenticated password update; account-neutral recovery.

[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow): one-use short-lived codes, same-browser/device verifier and overlapping-flow risk. No experimental flow option is adopted.

[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): exact production URL configuration; templates must respect supplied destinations.

[Email templates](https://supabase.com/docs/guides/auth/auth-email-templates): ConfirmationURL/RedirectTo/TokenHash contracts differ; email tracking/prefetch can affect links.

[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp): default team-only, limited sender is not production delivery proof.

[Password security](https://supabase.com/docs/guides/auth/password-security): project password requirements, recent-auth/nonce/current-password settings.

[SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client): validated identity and refreshed cookie/cache handling. Existing PR19 behavior is retained.
[Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange): subscription and unsubscribe contract; use a synchronous event handler for UI invalidation and keep verified identity checks separate.
