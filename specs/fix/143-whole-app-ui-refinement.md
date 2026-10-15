---
id: 143
slug: whole-app-ui-refinement
area: fix
status: draft
author: Codex
created: 2026-10-15
constitution_satisfies: ['§2.4', '§2.5', '§3.1', '§4.1', '§7.4']
constitution_overrides: []
---

# 143: Whole-app UI refinement

## Authorization and problem

Clarence explicitly requested a review of every page using Impeccable, preserving the cleaner, minimalist expense experience. This is owner-authorized reversible remediation under §7.4, not approval of new persistence domains. The prior request to continue remaining features remains tracked separately.

## Inventory and evidence

The 11 page entry points are landing, login, dashboard overview, assets, snapshot entry, equity, expenses, salary, household, profile and admin. Dashboard pages compose existing feature modules; the overview has its own client composition. Shared PageHeader, dashboard/public navbar, button primitives, layout and globals are consumed across those routes. Loading skeletons mirror page spacing. Feature forms/tables remain authoritative for saved data. Historical migrations, governance, generated files and server actions require no edits in this UI batch.

- All dashboard page wrappers use 24px mobile gutters; shared heading/action layout never stacks, crowding long headings.
- Dashboard navigation exposes six links plus account/search/privacy controls at 768px, competing for tablet width. Active links lack aria-current.
- The shared ghost button turns ordinary actions red on hover; secondary buttons use low-contrast hover text. These semantics affect controls throughout the app.
- Profile and login forms need bounded widths and mobile breathing room; profile residency select has long unwrappable option labels.
- Snapshot category panels nest borders within a card, and category totals/buttons compete on narrow widths.
- Distributions header does not wrap actions on mobile.
- Export repeats a large domain inventory above its action. Keep plaintext/no-restore/concurrency/household limitations visible; disclose only the inventory.
- Landing navigation consumes excessive small-screen gutters; retain its established visual identity and factual content.

## Pre-edit scope and solution

Affected paths: shared widgets/page-header.tsx; components/layout/dashboard-navbar.tsx and public-navbar.tsx; components/ui/button.tsx; existing dashboard page.tsx and \*-skeleton.tsx wrappers; overview/dashboard-overview.tsx; public/login/page.tsx; features/assets/components/snapshot-form.tsx; features/equity/components/distributions-section.tsx; features/profile/components/profile-form.tsx and export-data-card.tsx; corresponding existing tests and this record. No source files deleted. Existing source imports establish their consumers. Use Impeccable distill and craft-floor guidance; context setup was already loaded this session. Existing semantic tokens and brand are the visual authority.

Stack headings/actions on phones, use 16px mobile gutters and existing desktop spacing, move expanded nav to large screens, add active-page semantics, quiet navigation shadow, neutralize ordinary button hover states, constrain profile width, wrap long select text, flatten snapshot groups with spacing/dividers, wrap distribution controls, and disclose export domain details and the secondary existing-file review task. Preserve all form values, privacy guards, errors, server mutations and financial calculations. No new client boundary or dependency.

## Acceptance

- All 11 pages accounted for; no claim that unchanged feature internals or security have been exhaustively audited.
- Existing targeted UI tests pass; active navigation semantics have a meaningful regression check.
- Bounded desktop/mobile synthetic browser inspection of affected shared and feature controls; private/live authentication is excluded.
- Independent review and normal check/test:ci/build gates pass before PR.
- README reviewed; no new setup or storage contract, so no expansion required.

## Risk and rollback

Shared styles have broad visual reach. Preserve destructive icons, explicit delete confirmations and button disabled/focus behavior. Revert this ordinary UI commit to restore layout; no database rollback. No performance claim without measurement. Migrations, dependencies, new roadmap features, authentication and protected files are outside this batch.

## Results

Independent review identified fixed-height select specificity and line clamping; corrected both matching variants before browser confirmation. A synthetic preview of actual shared navigation/header/button, profile/export and snapshot components at 1280px, 820px and 390px confirmed readable wrapping and no phone horizontal overflow. Synthetic hooks replace private boundaries; this does not prove live authentication or all page-specific data states. Targeted export expectations are updated to verify the collapsed inventory and still-visible material limitations. Full gates pending; not shipped.

Targeted verification: 34 tests across five files pass after updating the export disclosure expectation (22 export tests rechecked). Navigation test verifies current-page semantics in both menu modes and closing on selection. Independent final review reports no remaining findings. Preview server stopped and temporary browser tab closed. Full normal-hook verification follows.

## Owner-requested landing-page extension — 2026-10-15

Clarence explicitly included the landing page after the first pass. Before edits, scope extends to marketing components hero, feature-grid, moat-band, security-band, faq, cta-band and dashboard-preview, plus their existing tests. The public page composes these seven components; existing constants, font, telemetry and motion boundaries remain consumers and are retained. No new product claims, dependencies or data contracts.

Evidence: repeated outlined feature cards and icon tiles, several competing decorative gradients, very faint small preview/trust text, excessive mobile section padding, fixed navigation without anchor scroll clearance, a rotated preview and a decorative 'View plan' affordance that is not interactive. These obscure the main sign-in action and make the page less consistent with the requested minimalist direction.

Use Impeccable distill/craft guidance in Persuade mode while preserving the existing dark canvas, Fraunces headlines, emerald/sky brand, product copy and sign-in routes. Reduce decoration, flatten repeated feature tiles, improve secondary-text contrast, align the preview, clearly label its sample figures, add anchor clearance and use tighter mobile spacing with generous desktop spacing. Remove redundant heading eyebrows only; retain material encryption explanation. Verify actual assembled landing components at desktop/mobile widths, CTA routes and FAQ interaction with synthetic telemetry/font adapters; normal full gates and independent review apply to the expanded PR. Rollback is an ordinary source revert.

Landing verification: nine marketing tests across three files pass, including CTA telemetry failure behavior and FAQ expansion. Independent review reports no actionable findings. The assembled actual landing components were inspected at 1280px and 390px with local copies of existing built Fraunces/Lato fonts and disabled telemetry; phone document width remained within the viewport. The security FAQ expanded and all three Get started links retained /login. Preview server and browser tab were closed. No new production font or dependency was introduced. Full hooks apply to the updated source before publishing.
