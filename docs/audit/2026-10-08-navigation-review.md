# Navigation review — 2026-10-08

Reviewed all source matches for router push/replace/back, redirects, browser
location, OAuth redirectTo, Link href and static link destinations, plus route
constants, App Router pages and Next configuration. No configured rewrite or
redirect table exists. This is a source/test review, not a live OAuth walkthrough.

| Surface                                 | Destination and result                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot create/update/Cancel           | Assets; fixed the previous dashboard destination. Failed writes remain on the form.                                                         |
| Snapshot Edit                           | Entry with URL-encoded edit identifier; uses the shared route constant.                                                                     |
| Assets and overview Add Snapshot        | Entry; valid route.                                                                                                                         |
| Dashboard desktop/mobile navigation     | Dashboard, Assets, Salary, Equity, Expenses, Household; each matches a page. Mobile menu closes on selection.                               |
| Public/dashboard wordmark               | Marketing home; intentional existing contract.                                                                                              |
| Account menu                            | Profile and home FAQ; valid destinations.                                                                                                   |
| Footer                                  | Help at home FAQ; replaced the nonfunctional Contact Us placeholder.                                                                        |
| Marketing navbar/hero/CTA               | Login, home Features and FAQ; both section IDs exist.                                                                                       |
| Email login success                     | Dashboard, followed by refresh; failed login stays on the form.                                                                             |
| OAuth initiation                        | Current-origin auth callback with dashboard default; external provider navigation is SDK-managed.                                           |
| Auth callback success                   | Safe local next destination, preserving query; external, protocol-relative, backslash and control-character targets fall back to dashboard. |
| Missing/failed callback code            | Login with auth_callback_failed; no success redirect.                                                                                       |
| Anonymous protected page                | Login; refreshed/expired session cookies now preserved on redirect.                                                                         |
| Authenticated login page                | Dashboard; refreshed session cookies now preserved on redirect.                                                                             |
| Protected API without verified identity | 401, not an HTML redirect; expiry cookies preserved. Authentication errors fail closed even if a user object accompanies them.              |
| Logout                                  | Login only after successful cookie teardown and Supabase sign-out; failure keeps the vault locked and permits retry.                        |
| Vault lock/unlock and feature dialogs   | Stay on the current route; unlock restores its content. Financial dialog save/cancel and dashboard error retry do not navigate.             |
| Admin access denied                     | Intentional 404 via notFound, not a redirect to another page.                                                                               |

The default login destination remains dashboard. Anonymous deep links currently
require navigating back after login; this batch does not add a new return-to
authentication contract. Callback next accepts safe same-origin paths and does
not guarantee arbitrary caller-supplied paths exist.

Five new regression cases failed before remediation: three dropped response
cookies, authentication-error handling and the footer placeholder. Existing
callback, login/logout and snapshot workflow tests were reviewed and expanded.
Snapshot navigation uses shared constants; there is no new route abstraction.

[Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
requires propagating refreshed cookies when constructing another response.
[NextResponse documentation](https://nextjs.org/docs/app/api-reference/functions/next-response)
defines response cookie and redirect APIs used by the fix.

Changes are local on `impl/070-snapshot-return`, including the preceding snapshot
fix. No deployment, credential access or database migration was performed.

Final verification:105testfiles/795passingtests;91.83%lines,91.65%statements,89.08%functions,85.61%branches. pnpm check and isolated fixture-only pnpm build passed. Production standalone HTTP checks confirmed nine protected page paths redirect to login, missing-code callback redirects to login with error, and anonymous protected API returns401 without a redirect. Relative Location headers are valid and normalized against the request origin in assertions. Next canonicalizes the loopback127.0.0.1 callback origin to localhost; the callback assertion passed using localhost. This does not establish production forwarded-host configuration. The fixture server stopped afterward. No live authenticated/provider flow was exercised. Second review found no additional incorrect destination within the inventoried source; Blob export download is intentional and not an application-route redirect.
