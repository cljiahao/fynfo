# Onboarding confirmation review — 2026-10-09

## Scope and status

Owner requested a confirmation sweep of the proposed hardening/features and a
minimal onboarding experience, with optional fine controls behind disclosure.
This is a source-based review and proposed direction, not approval or shipment
of new features. No authenticated records, credentials, PINs or secret files
were accessed. It supplements the existing file inventory and page-purpose
review; it does not claim a new exhaustive security audit or live usability test.

Guidance: Impeccable `SKILL.md` and `reference/onboard.md`, applied to the existing
Operate interface. The context-loader script was inspected but not executed:
its broader bootstrap includes environment credential checks and update-cache
side effects unnecessary for this bounded review. No skills, harness files or
dependencies were changed. The existing templateCentral/Fynfo deviations remain
binding. This pass does not claim newly executing unavailable templateCentral or
frontend-design plugin skills.

## Confirmed gaps and duplication checks

| Priority | Evidence                                                                                                                                                                                    | Proposed response                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First    | `auth/components/vault-unlock-flow.tsx` always says “Vault Locked” and automatically submits six digits; `app/api/vault/route.ts` initializes a missing canary.                             | Distinguish first-time creation from returning unlock using authenticated state that fails closed. For creation, explain the PIN, confirm it, then explicitly create the vault. Preserve derivation, throttling and initialization race protections. Do not infer a new vault from a failed read. |
| First    | `auth/components/login-card.tsx` and `email-login-form.tsx` expose sign-in but no visible email account creation or password recovery path.                                                 | Clarify supported account entry paths. Specify email recovery separately from vault PIN recovery; do not imply resetting an account password decrypts old records. Provider configuration and callback security require verification before implementing recovery.                                |
| First    | `app/dashboard/(overview)/dashboard-overview.tsx` immediately composes summaries, planner and investment breakdown/allocation, including for empty successful histories.                    | Offer one dismissible first-record prompt. Recommend an asset snapshot, with expense/salary alternatives. Reuse actual forms and existing empty states; keep returning users on their normal dashboard.                                                                                           |
| First    | Prior page review records default-profile estimates and partial trade/quote calculations; `profile/components/profile-form.tsx` collects calculation inputs.                                | Keep incomplete-profile, missing/stale-data and estimate status visible beside affected totals. Ask for relevant profile inputs when using tax/CPF calculations, rather than forcing all profile fields during signup.                                                                            |
| Next     | Existing salary reliefs, cash breakdown, monthly investment and market allocation use accordions. `assets/components/planner-inputs.tsx` exposes both ordinary inputs and reserve controls. | Reuse the existing disclosure components. Avoid a second planner, duplicate settings or generic “Advanced” bucket containing required inputs.                                                                                                                                                     |
| Next     | `expenses/components/expense-quick-add.tsx` can submit valid pasted rows immediately. `profile/hooks/use-export-data.ts` downloads decrypted JSON; a restore workflow is not established.   | Make paste behavior and export confidentiality clear at the action. Preserve the separate local review-before-paste plan; do not present export as proven disaster recovery or add bank upload.                                                                                                   |

Idle auto-lock already exists; it is not a new feature. Household goals, planner,
charts and export also already exist. Monthly review should compose these data
sources rather than create another ledger or duplicate summary calculations.

## Minimal first-use flow

1. **Sign in.** One primary account entry action; retain a clearly discoverable
   email alternative. Explain account creation/recovery only where needed.
2. **Create or unlock the vault.** First use gets PIN confirmation and a concise
   recovery limitation before saving. Returning users get a short unlock form.
   Use honest stages such as “Unlocking” and “Loading your records”, without
   presenting an elapsed-time animation as measured completion.
3. **Add one useful record.** A single prompt: “Start with your current assets.”
   Offer “Add snapshot”, a quieter alternative for expense/salary, and “Skip”.
   Show the resulting summary after a successful save. No compulsory tour,
   household invitation, investment targets or full profile questionnaire.

First-time guidance must respect dismissal and returning users, remain reachable
through contextual help, and never store financial values or PINs in onboarding
preferences. Do not prefill synthetic financial records into a real vault.

## Basic versus optional controls

| Surface    | Always available basics                                                  | Optional disclosure                                                                               |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Snapshot   | Month, account/category, amount and currency meaning, Save/Cancel        | Additional accounts/categories and comparison details; never discard existing rows when collapsed |
| Expenses   | Date, category, description, amount, save outcome                        | Notes, paste-format help, sharing; choosing sharing reveals its required allocation inputs        |
| Salary/tax | Record period, pay inputs and calculation-affecting profile requirements | Applicable additional reliefs and calculation breakdown; active adjustments remain summarized     |
| Planning   | Income, expenses, current assumptions and result validity                | Reserve duration, allocation overrides and future scenarios, labelled by purpose                  |
| Dashboard  | Core totals, source period, missing/stale/error status and retry         | Detailed breakdowns and planning adjustments                                                      |

Use one disclosure level, descriptive headings such as “Adjust reserves”, and a
compact summary when non-default settings are active. An error inside a collapsed
section must become visible and focusable. Closing a section must preserve edits.
Important warnings and instructions must not exist only in a tooltip.

[Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
supports deferring secondary controls. Tooltip content must be usable on keyboard
focus, dismissible, hoverable and persistent under
[W3C guidance](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html);
provide a tap-accessible disclosure for help on touch devices.

## Delivery order and acceptance

Keep the six hardening items: atomic saves, complete histories, financial
accuracy/data readiness, measured latency, synthetic browser workflows, and
backup/recovery proof. Include concurrency and retry idempotency within save
hardening rather than count them as separate products. Prioritize first-run
clarity and visible data readiness alongside that work. Afterwards, monthly
review and confirm-to-save recurring templates are the smallest useful feature
batch; budgets, scenarios and revision history can wait.

Implementation specs must define new/returning/reset vault states, recovery
limitations and any necessary authenticated state contract. No dependency,
migration or cryptographic change is authorized by this review.

Acceptance: synthetic first/returning-user fixtures; failed state reads never
initialize; creation confirmation mismatch saves nothing; interrupted/retried
saves retain input and avoid duplicates; skip/dismiss survives navigation;
required fields and errors remain discoverable; collapsed sections preserve
edits; keyboard and mobile help work; missing profile/quotes never look complete.
Measure request/stage latency before claiming speed gains. Run the existing
quality gates and retain the owner's above-80% coverage requirement for
executable changes. No runtime tests were rerun for this documentation-only pass.
