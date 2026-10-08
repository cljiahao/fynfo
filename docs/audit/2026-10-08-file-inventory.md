# Tracked-file inventory — 2026-10-08

Generated from git-tracked paths; untracked audit artifacts are listed by the audit record. Static import consumers supplement human domain ledgers, not proof of runtime reachability. Secret content is excluded. Historical/generated/framework files are retained by lifecycle even without imports.

This table preserves the 491-file baseline and its original static consumers.
Final disposition: remove the unconsumed `src/lib/vault-migration.ts` and six
generated primitives (`button-group`, `form`, `input-group`, `sonner`, `tabs`,
and `shadcn-io/dropzone`). Retain other baseline paths for their consumers,
framework/tooling contracts or historical lifecycle. Retention is not a claim
that a file is defect-free. Supplemental files and remaining debt are linked in
[the final summary](2026-10-08-summary.md) and domain ledgers.

<!-- prettier-ignore -->
| File | Purpose/surface | Static import consumers |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/README.md` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/harness.json` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/hooks/guard-destructive-bash.mjs` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/hooks/guard-protected-paths.mjs` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/hooks/injection-guard.mjs` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/hooks/post-edit-tsc.mjs` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/hooks/session-banner.mjs` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/hooks/stop-tests.mjs` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/settings.json` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/skills/next-verify/SKILL.md` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.claude/skills/regen-harness/SKILL.md` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.cursorignore` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `.env.example` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `.github/workflows/ci.yml` | Permission-protected tooling; read-only review | Convention/lifecycle or consumer tracing required |
| `.gitignore` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `.husky/pre-commit` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `.husky/pre-push` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `.prettierignore` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `.prettierrc` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `AGENTS.md` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `CLAUDE.md` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `CONSTITUTION.md` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `README.md` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `components.json` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `docs/audit/2026-06-02-dashboard-perf-spike.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `docs/audit/2026-06-02-project-audit-roadmap.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `docs/handoff-2026-06-14.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `docs/superpowers/plans/2026-05-28-harness-postedit-tsc.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `docs/superpowers/specs/2026-06-25-household-shared-vault-design.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `eslint.config.mjs` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `next.config.ts` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `package.json` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `pnpm-lock.yaml` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `pnpm-workspace.yaml` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `postcss.config.mjs` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `public/image_assets/logo.svg` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `scripts/check-route-logging.mjs` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `scripts/verify-harness.mjs` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `specs/README.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/SPEC_TEMPLATE.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/001-encrypted-data-export.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/002-landing-redesign.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/003-dashboard-dark-mode.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/004-storefront-moat-telemetry-admin.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/005-email-password-admin-auth.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/039-dividend-tracking.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/042-dividend-scan-import.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/044-persist-trade-cdp-po.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/053-household-core.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/054-household-mvp-goals.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/061-app-semantic-token-system.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/062-component-elevation.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/feature/064-vault-retheme-widget-tests.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/002-rekey-error-detail.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/004-rekey-paginate-batch.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/005-rekey-rpc-id-text.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/006-post-rekey-cleanup.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/007-drop-backup-tables.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/009-split-modal-persist.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/011-expense-quickadd-refetch.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/014-core-unit-tests.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/015-action-tests.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/016-coverage-thresholds.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/017-expense-settle-delete-invalidation.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/018-dashboard-error-boundary-contract.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/019-trade-form-ispo-reset.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/020-rsc-prefetch-dashboard.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/021-dep-vuln-vitest-bump.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/022-remove-statement-import.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/023-dashboard-loading-error-ux.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/024-loading-client-skeleton.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/025-loading-spinner-consistency.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/026-breakdown-pct-and-cpf-darkmode.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/027-chart-darkmode-axis-and-cpf-cells.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/028-chart-tooltip-darkmode.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/029-housekeeping-dead-route-tsconfig.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/030-cite-snapshot-form-eslint-disable.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/032-read-error-handling-consistency.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/035-server-action-test-coverage.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/036-icon-button-accessible-names.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/037-finish-action-layer-coverage.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/038-tax-reliefs-label-coverage.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/040-vault-unlock-await-data.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/041-trade-edit-broker-select.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/043-broker-select-show-saved.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/045-grant-equity-dividends.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/046-fsmone-broker-dividend-pagination.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/047-yield-on-cost-sortable.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/048-expense-quickadd-reset-on-submit.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/050-component-test-and-debt-cleanup.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/051-a11y-pagination-and-settle-darkmode.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/056-expense-chart-darkmode-segment-separator.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/057-client-crypto-coverage.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/058-snapshot-format-and-household-lock-ux.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/059-snapshot-month-editable-dedup.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/060-datepicker-default-month-today-button.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/063-resweep-cleanup.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/065-harness-integrity-route-logging-checks.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/066-household-create-rls-deadlock.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/067-exclude-insurance-from-expense-totals.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/fix/068-household-unlock-stale-lock-state.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/003-stop-hook-simplification.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/008-harness-postedit-tsc.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/010-harness-4.2.0-alignment.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/011-harness-4.5.0-parity.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/012-unlock-spec-authoring.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/013-telemetry-write-exception.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/033-templatecentral-5-harness-alignment.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/052-household-two-person.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/governance/055-env-example-editable.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/infra/001-ci-pipeline.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/infra/002-component-test-harness.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/001-decrypt-field-helpers.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/002-extract-investment-math.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/003-extract-tax-reliefs-logic.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/004-extract-expense-table-logic.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/005-extract-salary-plan-math.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/006-extract-trade-fee-resolver.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/007-decompose-oversized-components.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/008-code-debt-cleanup.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/031-storefront-navbar-split.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/034-storefront-lazymotion.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/refactor/049-extract-component-math-to-gated-libs.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/001-pbkdf2-rekey.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/002-crypto-envelope-hardening.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/003-vault-unlock-rate-limit.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/004-vault-unlock-hardening.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/005-trust-proxy-host-allowlist.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/006-self-guarded-actions-skip-proxy-auth.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/007-dek-pepper-derivation.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `specs/security/008-idle-auto-lock.md` | Decision/reference record; retain lifecycle evidence | Convention/lifecycle or consumer tracing required |
| `src/app/(public)/layout.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/(public)/login/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/(public)/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/api/health/route.ts` | Framework route/layout/asset; framework convention is consumer | `test/api/health.test.ts` |
| `src/app/api/track/route.ts` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/api/vault/lock/route.ts` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/api/vault/route.ts` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/auth/callback/route.ts` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/(overview)/dashboard-overview.tsx` | Framework route/layout/asset; framework convention is consumer | `src/app/dashboard/(overview)/page.tsx` |
| `src/app/dashboard/(overview)/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/(overview)/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/admin/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/assets/assets-skeleton.tsx` | Framework route/layout/asset; framework convention is consumer | `src/app/dashboard/assets/loading.tsx`, `src/app/dashboard/assets/page.tsx` |
| `src/app/dashboard/assets/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/assets/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/entry/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/entry/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/equity/equity-skeleton.tsx` | Framework route/layout/asset; framework convention is consumer | `src/app/dashboard/equity/loading.tsx`, `src/app/dashboard/equity/page.tsx` |
| `src/app/dashboard/equity/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/equity/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/error.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/expenses/expenses-skeleton.tsx` | Framework route/layout/asset; framework convention is consumer | `src/app/dashboard/expenses/loading.tsx`, `src/app/dashboard/expenses/page.tsx` |
| `src/app/dashboard/expenses/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/expenses/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/household/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/layout.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/profile/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/profile/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/salary/loading.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/salary/page.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/dashboard/salary/salary-skeleton.tsx` | Framework route/layout/asset; framework convention is consumer | `src/app/dashboard/salary/loading.tsx`, `src/app/dashboard/salary/page.tsx` |
| `src/app/globals.css` | Framework route/layout/asset; framework convention is consumer | `src/app/layout.tsx` |
| `src/app/icon.svg` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/app/layout.tsx` | Framework route/layout/asset; framework convention is consumer | Convention/lifecycle or consumer tracing required |
| `src/components/layout/dashboard-error.tsx` | DashboardError | `src/components/layout/index.ts` |
| `src/components/layout/dashboard-navbar.tsx` | DashboardNavbar | `src/components/layout/index.ts` |
| `src/components/layout/index.ts` | Internal module/stylesheet | `src/app/(public)/layout.tsx`, `src/app/dashboard/error.tsx`, `src/app/dashboard/layout.tsx`, `src/app/layout.tsx`, `test/components/dashboard-error.test.tsx` |
| `src/components/layout/providers.tsx` | Providers | `src/components/layout/index.ts` |
| `src/components/layout/public-navbar.tsx` | PublicNavbar | `src/components/layout/index.ts` |
| `src/components/layout/site-footer.tsx` | SiteFooter | `src/components/layout/index.ts`, `test/components/site-footer.test.tsx` |
| `src/components/layout/theme-provider.tsx` | ThemeProvider | `src/components/layout/index.ts` |
| `src/components/layout/theme-toggle.tsx` | ThemeToggle | `src/components/layout/user-menu-dropdown.tsx`, `test/components/theme-toggle.test.tsx` |
| `src/components/layout/user-menu-dropdown.tsx` | UserMenuDropdown | `src/components/layout/user-menu.tsx` |
| `src/components/layout/user-menu.tsx` | UserMenu | `src/app/dashboard/layout.tsx` |
| `src/components/layout/vault-gate.tsx` | VaultGate | `src/components/layout/index.ts` |
| `src/components/ui/accordion.tsx` | Internal module/stylesheet | `src/features/assets/components/deployable-cash-breakdown.tsx`, `src/features/assets/components/market-allocation-table.tsx`, `src/features/assets/components/monthly-investment-table.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/expenses/components/owed-summary.tsx`, `src/features/marketing/components/faq.tsx`, `src/features/salary/components/salary-summary.tsx` |
| `src/components/ui/avatar.tsx` | Internal module/stylesheet | `src/components/layout/user-menu-dropdown.tsx` |
| `src/components/ui/button-group.tsx` | Internal module/stylesheet | Convention/lifecycle or consumer tracing required |
| `src/components/ui/button.tsx` | Internal module/stylesheet | `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/assets/page.tsx`, `src/app/dashboard/equity/page.tsx`, `src/app/dashboard/salary/page.tsx`, `src/components/layout/dashboard-error.tsx`, `src/components/layout/dashboard-navbar.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/input-group.tsx`, `src/components/ui/shadcn-io/dropzone/index.tsx`, `src/components/widgets/confirm-delete-dialog.tsx`, `src/components/widgets/pagination-controls.tsx`, `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/auth/components/email-login-form.tsx`, `src/features/auth/components/login-button.tsx`, `src/features/auth/components/signout-button.tsx`, `src/features/auth/components/vault-unlock-flow.tsx`, `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/dividend-table.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/equity/components/trade-table.tsx`, `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/components/expense-table-toolbar.tsx`, `src/features/expenses/components/owed-summary.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/household/components/add-contribution-dialog.tsx`, `src/features/household/components/create-goal-dialog.tsx`, `src/features/household/components/goal-card.tsx`, `src/features/household/components/household-overview.tsx`, `src/features/household/components/household-setup.tsx`, `src/features/household/components/invite-panel.tsx`, `src/features/profile/components/export-data-card.tsx`, `src/features/profile/components/profile-form.tsx`, `src/features/salary/components/salary-form.tsx`, `src/features/salary/components/salary-table.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx` |
| `src/components/ui/calendar.tsx` | Internal module/stylesheet | `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx` |
| `src/components/ui/card.tsx` | Internal module/stylesheet | `src/components/widgets/custom-card.tsx`, `src/components/widgets/stat-card.tsx`, `src/features/admin/components/marketing-trend-chart.tsx`, `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/category-breakdown.tsx`, `src/features/assets/components/investment-allocation.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/salary-planner.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/portfolio-summary.tsx`, `src/features/equity/components/trade-table.tsx`, `src/features/expenses/components/expense-chart.tsx`, `src/features/expenses/components/owed-summary.tsx`, `src/features/household/components/goal-card.tsx`, `src/features/household/components/household-setup.tsx`, `src/features/profile/components/export-data-card.tsx`, `src/features/profile/components/profile-form.tsx`, `src/features/salary/components/salary-chart.tsx`, `src/features/salary/components/salary-summary.tsx`, `src/features/salary/components/salary-table.tsx` |
| `src/components/ui/checkbox.tsx` | Internal module/stylesheet | `src/features/assets/components/planner-results.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/profile/components/profile-form.tsx`, `src/features/salary/components/relief-row.tsx` |
| `src/components/ui/dialog.tsx` | Internal module/stylesheet | `src/components/widgets/confirm-delete-dialog.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/household/components/add-contribution-dialog.tsx`, `src/features/household/components/create-goal-dialog.tsx`, `src/features/salary/components/salary-form.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx` |
| `src/components/ui/dropdown-menu.tsx` | Internal module/stylesheet | `src/components/layout/theme-toggle.tsx`, `src/components/layout/user-menu-dropdown.tsx`, `src/features/assets/components/asset-bar-chart.tsx`, `test/components/theme-toggle.test.tsx` |
| `src/components/ui/field.tsx` | Internal module/stylesheet | `src/features/auth/components/vault-unlock-flow.tsx` |
| `src/components/ui/form.tsx` | Internal module/stylesheet | Convention/lifecycle or consumer tracing required |
| `src/components/ui/input-group.tsx` | Internal module/stylesheet | Convention/lifecycle or consumer tracing required |
| `src/components/ui/input.tsx` | Internal module/stylesheet | `src/components/ui/input-group.tsx`, `src/features/assets/components/deployable-cash-breakdown.tsx`, `src/features/assets/components/market-allocation-table.tsx`, `src/features/assets/components/monthly-investment-table.tsx`, `src/features/assets/components/planner-inputs.tsx`, `src/features/assets/components/planner-results.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/auth/components/email-login-form.tsx`, `src/features/auth/components/vault-unlock-flow.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/components/expense-table-toolbar.tsx`, `src/features/expenses/components/expense-type-select.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/household/components/add-contribution-dialog.tsx`, `src/features/household/components/create-goal-dialog.tsx`, `src/features/household/components/household-setup.tsx`, `src/features/household/components/invite-panel.tsx`, `src/features/profile/components/profile-form.tsx`, `src/features/salary/components/relief-row.tsx`, `src/features/salary/components/salary-form.tsx` |
| `src/components/ui/label.tsx` | Internal module/stylesheet | `src/components/ui/field.tsx`, `src/components/ui/form.tsx`, `src/features/assets/components/planner-inputs.tsx`, `src/features/assets/components/planner-results.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/auth/components/email-login-form.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/household/components/add-contribution-dialog.tsx`, `src/features/household/components/create-goal-dialog.tsx`, `src/features/household/components/household-setup.tsx`, `src/features/profile/components/profile-form.tsx`, `src/features/salary/components/relief-row.tsx`, `src/features/salary/components/salary-form.tsx` |
| `src/components/ui/popover.tsx` | Internal module/stylesheet | `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx` |
| `src/components/ui/select.tsx` | Internal module/stylesheet | `src/components/widgets/pagination-controls.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-table-toolbar.tsx`, `src/features/profile/components/profile-form.tsx`, `src/features/salary/components/relief-row.tsx` |
| `src/components/ui/separator.tsx` | Internal module/stylesheet | `src/components/ui/button-group.tsx`, `src/components/ui/field.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/salary/components/salary-summary.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx` |
| `src/components/ui/shadcn-io/dropzone/index.tsx` | DropzoneProps, Dropzone, DropzoneContentProps, DropzoneContent, DropzoneEmptyStateProps, DropzoneEmptyState | Convention/lifecycle or consumer tracing required |
| `src/components/ui/sheet.tsx` | Internal module/stylesheet | `src/components/layout/dashboard-navbar.tsx` |
| `src/components/ui/skeleton.tsx` | Internal module/stylesheet | `src/app/dashboard/(overview)/loading.tsx`, `src/app/dashboard/assets/assets-skeleton.tsx`, `src/app/dashboard/entry/loading.tsx`, `src/app/dashboard/equity/equity-skeleton.tsx`, `src/app/dashboard/expenses/expenses-skeleton.tsx`, `src/app/dashboard/profile/loading.tsx`, `src/app/dashboard/salary/salary-skeleton.tsx`, `src/features/assets/components/salary-planner.tsx`, `src/features/household/components/household-skeleton.tsx`, `src/features/profile/components/profile-form.tsx` |
| `src/components/ui/sonner.tsx` | Internal module/stylesheet | Convention/lifecycle or consumer tracing required |
| `src/components/ui/tabs.tsx` | Internal module/stylesheet | Convention/lifecycle or consumer tracing required |
| `src/components/ui/textarea.tsx` | Internal module/stylesheet | `src/components/ui/input-group.tsx` |
| `src/components/ui/tooltip.tsx` | Internal module/stylesheet | `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/market-deployment-card.tsx`, `src/features/salary/components/relief-row.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx`, `test/features/assets/market-deployment-card.test.tsx`, `test/features/salary/relief-row.test.tsx` |
| `src/components/widgets/brand-text.tsx` | BrandText | `src/components/widgets/index.ts` |
| `src/components/widgets/confirm-delete-dialog.tsx` | ConfirmDeleteDialog | `src/components/widgets/index.ts` |
| `src/components/widgets/custom-card.tsx` | CustomCard | `src/components/widgets/index.ts` |
| `src/components/widgets/empty-state.tsx` | EmptyState | `src/components/widgets/index.ts` |
| `src/components/widgets/index.ts` | Internal module/stylesheet | `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/assets/page.tsx`, `src/app/dashboard/equity/page.tsx`, `src/app/dashboard/expenses/page.tsx`, `src/app/dashboard/profile/page.tsx`, `src/app/dashboard/salary/page.tsx`, `src/components/layout/dashboard-navbar.tsx`, `src/features/admin/components/stat-cards.tsx`, `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/assets/components/summary-cards.tsx`, `src/features/auth/components/login-card.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/dividend-table.tsx`, `src/features/equity/components/trade-table.tsx`, `src/features/equity/components/yield-on-cost-table.tsx`, `src/features/expenses/components/expense-table.tsx`, `src/features/household/components/household-overview.tsx`, `src/features/salary/components/salary-chart.tsx`, `src/features/salary/components/salary-summary-cards.tsx`, `src/features/salary/components/salary-table.tsx`, `test/components/empty-state.test.tsx`, `test/components/page-header.test.tsx`, `test/components/stat-card.test.tsx` |
| `src/components/widgets/link-list.tsx` | LinkItem, LinkList | `src/components/layout/site-footer.tsx`, `src/components/widgets/index.ts` |
| `src/components/widgets/page-header.tsx` | PageHeader | `src/components/widgets/index.ts` |
| `src/components/widgets/pagination-controls.tsx` | PaginationControls | `src/components/widgets/index.ts` |
| `src/components/widgets/stat-card.tsx` | StatCard | `src/components/widgets/index.ts` |
| `src/features/admin/components/marketing-trend-chart.tsx` | MarketingTrendChart | `src/features/admin/index.ts` |
| `src/features/admin/components/stat-cards.tsx` | StatCards | `src/features/admin/index.ts` |
| `src/features/admin/index.ts` | Internal module/stylesheet | `src/app/dashboard/admin/page.tsx` |
| `src/features/admin/lib/compute-click-rate.ts` | computeClickRate | `src/features/admin/lib/get-marketing-stats.ts`, `test/features/admin/compute-click-rate.test.ts` |
| `src/features/admin/lib/get-marketing-stats.ts` | getMarketingStats | `src/features/admin/index.ts` |
| `src/features/admin/types.ts` | DailyPoint, MarketingTotals, MarketingStats | `src/features/admin/components/marketing-trend-chart.tsx`, `src/features/admin/components/stat-cards.tsx`, `src/features/admin/index.ts`, `src/features/admin/lib/get-marketing-stats.ts` |
| `src/features/assets/actions/planner-actions.ts` | getPlannerSettings, upsertPlannerSettings | `src/app/dashboard/(overview)/page.tsx`, `src/features/assets/hooks/use-planner-settings.ts`, `src/features/profile/hooks/use-export-data.ts` |
| `src/features/assets/actions/snapshot-actions.ts` | getSnapshots, getSnapshot, upsertSnapshot, deleteSnapshot | `src/app/dashboard/(overview)/page.tsx`, `src/features/assets/hooks/use-snapshots.ts`, `src/features/profile/hooks/use-export-data.ts` |
| `src/features/assets/components/asset-bar-chart.tsx` | AssetLineChart | `src/features/assets/components/index.ts` |
| `src/features/assets/components/category-breakdown.tsx` | CategoryBreakdown | `src/features/assets/components/index.ts` |
| `src/features/assets/components/deployable-cash-breakdown.tsx` | DeployableCashBreakdown | `src/features/assets/components/investment-breakdown.tsx` |
| `src/features/assets/components/index.ts` | Internal module/stylesheet | `src/features/assets/index.ts` |
| `src/features/assets/components/investment-allocation.tsx` | InvestmentAllocation | `src/features/assets/components/index.ts` |
| `src/features/assets/components/investment-breakdown.tsx` | InvestmentBreakdown | `src/features/assets/components/index.ts`, `src/features/assets/components/index.ts`, `src/features/assets/components/investment-allocation.tsx` |
| `src/features/assets/components/market-allocation-table.tsx` | MarketAllocationTable | `src/features/assets/components/investment-allocation.tsx` |
| `src/features/assets/components/market-deployment-card.tsx` | MarketCardData, MarketDeploymentCard | `src/features/assets/components/investment-breakdown.tsx`, `test/features/assets/market-deployment-card.test.tsx` |
| `src/features/assets/components/monthly-investment-table.tsx` | MonthlyInvestmentTable | `src/features/assets/components/investment-breakdown.tsx` |
| `src/features/assets/components/planner-inputs.tsx` | PlannerInputs | `src/features/assets/components/salary-planner.tsx`, `test/features/assets/planner-inputs.test.tsx` |
| `src/features/assets/components/planner-results.tsx` | PlannerResults | `src/features/assets/components/salary-planner.tsx` |
| `src/features/assets/components/salary-planner.tsx` | PlannerValues, SalaryPlanner | `src/features/assets/components/index.ts`, `src/features/assets/components/index.ts` |
| `src/features/assets/components/snapshot-form.tsx` | SnapshotForm | `src/features/assets/components/index.ts` |
| `src/features/assets/components/snapshot-table.tsx` | SnapshotTable | `src/features/assets/components/index.ts` |
| `src/features/assets/components/summary-cards.tsx` | SummaryCards | `src/features/assets/components/index.ts`, `test/features/assets/summary-cards.test.tsx` |
| `src/features/assets/constants.ts` | CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, INVESTMENT_CATEGORIES | `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/category-breakdown.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/assets/components/summary-cards.tsx`, `src/features/assets/hooks/use-chart-data.ts`, `src/features/assets/schemas.ts` |
| `src/features/assets/hooks/index.ts` | Internal module/stylesheet | `src/features/assets/index.ts` |
| `src/features/assets/hooks/use-chart-data.ts` | useChartData | `src/features/assets/hooks/index.ts` |
| `src/features/assets/hooks/use-planner-settings.ts` | PLANNER_KEY, usePlannerSettings, useUpsertPlannerSettings | `src/features/assets/components/salary-planner.tsx`, `src/features/assets/hooks/index.ts` |
| `src/features/assets/hooks/use-snapshots.ts` | SNAPSHOTS_KEY, useSnapshots, useSnapshot, useUpsertSnapshot, useDeleteSnapshot | `src/features/assets/components/snapshot-form.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/assets/hooks/index.ts` |
| `src/features/assets/index.ts` | Internal module/stylesheet | `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/(overview)/page.tsx`, `src/app/dashboard/assets/page.tsx`, `src/app/dashboard/entry/page.tsx` |
| `src/features/assets/lib/calculations.ts` | calculateTotal, calculateMoMChange, getLatestSnapshot, getPreviousSnapshot | `src/features/assets/components/category-breakdown.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/assets/components/summary-cards.tsx`, `src/features/assets/hooks/use-chart-data.ts`, `src/features/assets/index.ts`, `test/features/assets/calculations.test.ts` |
| `src/features/assets/lib/investment-math.ts` | MarketBudget, MarketBudgets, Ratios, CashAlloc, floorH, sumCat, getCurrentQuarter, deployPctColor, computeMarketEquity, computeQuarterSpend, BreakdownInput, BreakdownResult, computeInvestmentBreakdown | `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/market-deployment-card.tsx`, `test/features/assets/investment-math.test.ts` |
| `src/features/assets/lib/salary-plan.ts` | ceilToThousand, sumByCategory, calcAllTimeAvgExpense, SalaryPlanInput, SalaryPlan, computeSalaryPlan | `src/features/assets/components/salary-planner.tsx`, `test/features/assets/salary-plan.test.ts` |
| `src/features/assets/schemas.ts` | assetEntrySchema, snapshotFormSchema, SnapshotFormValues, plannerSettingsSchema | `src/features/assets/actions/planner-actions.ts`, `src/features/assets/actions/snapshot-actions.ts`, `src/features/assets/components/snapshot-form.tsx` |
| `src/features/assets/types.ts` | AssetCategory, AssetEntryData, SnapshotData, SnapshotWithTotals, ChartDataPoint, PlannerSettingsData | `src/features/assets/actions/planner-actions.ts`, `src/features/assets/actions/snapshot-actions.ts`, `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/category-breakdown.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/salary-planner.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/assets/components/summary-cards.tsx`, `src/features/assets/constants.ts`, `src/features/assets/hooks/use-chart-data.ts`, `src/features/assets/hooks/use-planner-settings.ts`, `src/features/assets/hooks/use-snapshots.ts`, `src/features/assets/index.ts`, `src/features/assets/lib/calculations.ts`, `src/features/assets/lib/investment-math.ts`, `src/features/assets/lib/salary-plan.ts`, `src/features/assets/schemas.ts`, `src/features/profile/lib/export-data.ts`, `test/features/assets/calculations.test.ts`, `test/features/assets/summary-cards.test.tsx` |
| `src/features/auth/components/email-login-form.tsx` | EmailLoginForm | `src/features/auth/components/index.ts`, `src/features/auth/components/login-card.tsx` |
| `src/features/auth/components/idle-lock-watcher.tsx` | IdleLockWatcher | `src/features/auth/components/index.ts` |
| `src/features/auth/components/index.ts` | Internal module/stylesheet | `src/features/auth/index.ts` |
| `src/features/auth/components/login-button.tsx` | LoginButton | `src/features/auth/components/index.ts`, `src/features/auth/components/login-card.tsx` |
| `src/features/auth/components/login-card.tsx` | LoginCard | `src/features/auth/components/index.ts` |
| `src/features/auth/components/signout-button.tsx` | SignOutButton | `src/features/auth/components/index.ts` |
| `src/features/auth/components/vault-lock-context.tsx` | VaultLockProvider, useVaultLock | `src/features/auth/components/index.ts`, `src/features/auth/hooks/use-idle-lock.ts` |
| `src/features/auth/components/vault-unlock-flow.tsx` | VaultUnlockFlow | `src/features/auth/components/index.ts` |
| `src/features/auth/constants.ts` | IDLE_LIMIT_MS, IDLE_CHECK_MS | `src/features/auth/hooks/use-idle-lock.ts`, `src/features/auth/index.ts` |
| `src/features/auth/hooks/index.ts` | Internal module/stylesheet | `src/features/auth/index.ts` |
| `src/features/auth/hooks/use-idle-lock.ts` | useIdleLock | `src/features/auth/components/idle-lock-watcher.tsx`, `src/features/auth/hooks/index.ts` |
| `src/features/auth/index.ts` | Internal module/stylesheet | `src/app/(public)/login/page.tsx`, `src/app/dashboard/layout.tsx`, `src/components/layout/vault-gate.tsx`, `test/features/auth/use-idle-lock.test.tsx` |
| `src/features/auth/lib/email-login-schema.ts` | emailLoginSchema, EmailLoginValues | `src/features/auth/components/email-login-form.tsx`, `test/features/auth/email-login-schema.test.ts` |
| `src/features/equity/actions/dividend-actions.ts` | getDividends, createDividend, createDividends, updateDividend, deleteDividend | `src/features/equity/hooks/use-dividends.ts` |
| `src/features/equity/actions/equity-actions.ts` | getTrades, createTrade, updateTrade, deleteTrade | `src/features/equity/hooks/use-equity.ts`, `src/features/profile/hooks/use-export-data.ts` |
| `src/features/equity/actions/price-actions.ts` | StockPrice, fetchStockPrices, fetchExchangeRate, fetchDividends | `src/features/assets/lib/investment-math.ts`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/hooks/use-prices.ts` |
| `src/features/equity/components/distributions-section.tsx` | DistributionsSection | `src/features/equity/components/index.ts` |
| `src/features/equity/components/dividend-form.tsx` | DividendFormDialog | `src/features/equity/components/distributions-section.tsx` |
| `src/features/equity/components/dividend-income-chart.tsx` | DividendIncomeChart | `src/features/equity/components/distributions-section.tsx` |
| `src/features/equity/components/dividend-scan-dialog.tsx` | DividendScanDialog | `src/features/equity/components/distributions-section.tsx` |
| `src/features/equity/components/dividend-table.tsx` | DividendTable | `src/features/equity/components/distributions-section.tsx` |
| `src/features/equity/components/holdings-table.tsx` | HoldingsTable | `src/features/equity/components/index.ts` |
| `src/features/equity/components/index.ts` | Internal module/stylesheet | `src/features/equity/index.ts` |
| `src/features/equity/components/portfolio-summary.tsx` | PortfolioSummary | `src/features/equity/components/index.ts` |
| `src/features/equity/components/trade-form-summary.tsx` | TradeFeeBreakdown, TradeSummary | `src/features/equity/components/trade-form.tsx`, `test/features/equity/trade-form-summary.test.tsx` |
| `src/features/equity/components/trade-form.tsx` | TradeFormDialog | `src/features/equity/components/index.ts` |
| `src/features/equity/components/trade-table.tsx` | TradeTable | `src/features/equity/components/index.ts` |
| `src/features/equity/components/yield-on-cost-table.tsx` | YieldOnCostTable | `src/features/equity/components/distributions-section.tsx` |
| `src/features/equity/hooks/index.ts` | Internal module/stylesheet | `src/features/equity/index.ts` |
| `src/features/equity/hooks/use-dividends.ts` | useDividends, useCreateDividend, useCreateDividends, useUpdateDividend, useDeleteDividend | `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/dividend-table.tsx`, `src/features/equity/hooks/index.ts` |
| `src/features/equity/hooks/use-equity.ts` | useTrades, useCreateTrade, useUpdateTrade, useDeleteTrade | `src/features/assets/components/investment-allocation.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/equity/components/trade-table.tsx`, `src/features/equity/hooks/index.ts` |
| `src/features/equity/hooks/use-prices.ts` | useStockPrices, useExchangeRate | `src/features/assets/components/investment-allocation.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/equity/components/portfolio-summary.tsx`, `src/features/equity/hooks/index.ts` |
| `src/features/equity/index.ts` | Internal module/stylesheet | `src/app/dashboard/equity/page.tsx` |
| `src/features/equity/lib/broker-fees.ts` | FeeResult, BROKERS, Broker, calculateFees, TradeFeeInput, resolveTradeFees | `src/features/equity/components/trade-form.tsx`, `test/features/equity/broker-fees.test.ts` |
| `src/features/equity/lib/dividend-metrics.ts` | toSGD, totalSGD, incomeByYear, ttmDistributionsSGD, yieldOnCost | `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/dividend-income-chart.tsx`, `src/features/equity/components/yield-on-cost-table.tsx`, `test/features/equity/dividend-metrics.test.ts` |
| `src/features/equity/lib/dividend-scan.ts` | DividendCandidate, buildDividendCandidates | `src/features/equity/components/dividend-scan-dialog.tsx`, `test/features/equity/dividend-scan.test.ts` |
| `src/features/equity/lib/dividend-suggest.ts` | DividendPoint, sharesHeldAsOf, suggestAmount, nearestDpu | `src/features/equity/components/dividend-form.tsx`, `src/features/equity/lib/dividend-scan.ts`, `test/features/equity/dividend-scan.test.ts`, `test/features/equity/dividend-suggest.test.ts` |
| `src/features/equity/lib/holdings.ts` | Holding, computeHoldings | `src/features/assets/components/investment-allocation.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/market-allocation-table.tsx`, `src/features/assets/lib/investment-math.ts`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/equity/components/portfolio-summary.tsx`, `src/features/equity/components/yield-on-cost-table.tsx`, `src/features/equity/lib/dividend-metrics.ts`, `src/features/equity/lib/dividend-scan.ts`, `src/features/equity/lib/mwr.ts`, `test/features/assets/investment-math.test.ts`, `test/features/equity/dividend-metrics.test.ts`, `test/features/equity/dividend-scan.test.ts`, `test/features/equity/holdings.test.ts`, `test/features/equity/mwr.test.ts` |
| `src/features/equity/lib/mwr.ts` | CashFlow, computeIRR, buildCashFlows | `src/features/equity/components/portfolio-summary.tsx`, `test/features/equity/mwr.test.ts` |
| `src/features/equity/lib/ticker-map.ts` | getYahooSymbol, getMarket | `src/features/assets/components/investment-breakdown.tsx`, `src/features/equity/actions/price-actions.ts`, `src/features/equity/components/trade-form.tsx`, `src/features/equity/lib/broker-fees.ts`, `src/features/equity/lib/dividend-scan.ts`, `src/features/equity/lib/holdings.ts`, `src/features/equity/lib/mwr.ts`, `test/features/equity/ticker-map.test.ts` |
| `src/features/equity/lib/trade-form-defaults.ts` | TradeFormValues, buildTradeFormDefaults | `src/features/equity/components/trade-form.tsx`, `test/features/equity/trade-form-defaults.test.ts` |
| `src/features/equity/schemas.ts` | equityTradeInputSchema, dividendInputSchema | `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts` |
| `src/features/equity/types.ts` | TradeAction, EquityTradeData, DividendCurrency, DividendData | `src/features/assets/lib/investment-math.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/dividend-form.tsx`, `src/features/equity/components/dividend-income-chart.tsx`, `src/features/equity/components/dividend-scan-dialog.tsx`, `src/features/equity/components/dividend-table.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/equity/components/portfolio-summary.tsx`, `src/features/equity/components/trade-form.tsx`, `src/features/equity/components/trade-table.tsx`, `src/features/equity/components/yield-on-cost-table.tsx`, `src/features/equity/hooks/use-dividends.ts`, `src/features/equity/hooks/use-equity.ts`, `src/features/equity/index.ts`, `src/features/equity/lib/dividend-metrics.ts`, `src/features/equity/lib/dividend-scan.ts`, `src/features/equity/lib/dividend-suggest.ts`, `src/features/equity/lib/holdings.ts`, `src/features/equity/lib/mwr.ts`, `src/features/equity/lib/trade-form-defaults.ts`, `src/features/profile/lib/export-data.ts`, `test/features/assets/investment-math.test.ts`, `test/features/equity/dividend-metrics.test.ts`, `test/features/equity/dividend-scan.test.ts`, `test/features/equity/dividend-suggest.test.ts`, `test/features/equity/holdings.test.ts`, `test/features/equity/mwr.test.ts`, `test/features/equity/trade-form-defaults.test.ts` |
| `src/features/expenses/actions/expense-actions.ts` | getExpenses, upsertExpense, deleteExpense, settleSplit, settleMonthSplits, getDistinctPeople | `src/app/dashboard/(overview)/page.tsx`, `src/features/expenses/hooks/use-expenses.ts`, `src/features/profile/hooks/use-export-data.ts` |
| `src/features/expenses/components/editable-expense-row.tsx` | EditableRow | `src/features/expenses/components/expense-table.tsx` |
| `src/features/expenses/components/expense-chart.tsx` | ExpenseChart | `src/features/expenses/components/index.ts` |
| `src/features/expenses/components/expense-quick-add.tsx` | ExpenseQuickAdd | `src/features/expenses/components/index.ts`, `test/features/expenses/expense-quick-add.test.tsx` |
| `src/features/expenses/components/expense-table-toolbar.tsx` | ExpenseTableToolbar | `src/features/expenses/components/expense-table.tsx` |
| `src/features/expenses/components/expense-table.tsx` | ExpenseTable | `src/features/expenses/components/index.ts`, `test/features/expenses/expense-table.test.tsx` |
| `src/features/expenses/components/expense-type-select.tsx` | ExpenseTypeSelect | `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/components/index.ts` |
| `src/features/expenses/components/index.ts` | Internal module/stylesheet | `src/features/expenses/index.ts` |
| `src/features/expenses/components/owed-summary.tsx` | OwedSummary | `src/features/expenses/components/index.ts` |
| `src/features/expenses/components/sortable-header.tsx` | SortableHeader | `src/features/expenses/components/expense-table.tsx` |
| `src/features/expenses/components/split-dialog.tsx` | SplitDialog | `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/index.ts` |
| `src/features/expenses/constants.ts` | EXPENSE_TYPES, EXPENSE_TYPE_LABELS, EXPENSE_TOTAL_EXCLUDED_TYPES, EXPENSE_TYPE_COLORS | `src/features/expenses/components/expense-chart.tsx`, `src/features/expenses/components/expense-table-toolbar.tsx`, `src/features/expenses/components/expense-type-select.tsx`, `src/features/expenses/lib/expense-table.ts`, `src/features/expenses/lib/paste-parser.ts`, `src/features/expenses/lib/utils.ts`, `src/features/expenses/schemas.ts` |
| `src/features/expenses/hooks/index.ts` | Internal module/stylesheet | `src/features/expenses/index.ts` |
| `src/features/expenses/hooks/use-expenses.ts` | EXPENSE_KEY, buildUpsertMutationOptions, useExpenses, useUpsertExpense, buildDeleteMutationOptions, buildSettleSplitMutationOptions, buildSettleMonthMutationOptions, useDeleteExpense, useSettleSplit, useSettleMonthSplits, useDistinctPeople | `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/components/expense-table.tsx`, `src/features/expenses/components/owed-summary.tsx`, `src/features/expenses/hooks/index.ts`, `test/features/expenses/use-expenses-options.test.ts` |
| `src/features/expenses/index.ts` | Internal module/stylesheet | `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/(overview)/page.tsx`, `src/app/dashboard/expenses/page.tsx`, `src/features/assets/components/salary-planner.tsx`, `src/features/assets/lib/salary-plan.ts`, `src/features/assets/lib/salary-plan.ts`, `test/features/assets/salary-plan.test.ts` |
| `src/features/expenses/lib/expense-table.ts` | SortKey, SortDir, ExpenseFilters, filterExpenses, sortExpenses | `src/features/expenses/components/expense-table.tsx`, `src/features/expenses/components/sortable-header.tsx`, `test/features/expenses/expense-table.test.ts` |
| `src/features/expenses/lib/owed.ts` | MonthGroup, PersonGroup, buildPersonGroups | `src/features/expenses/components/owed-summary.tsx`, `test/features/expenses/owed.test.ts` |
| `src/features/expenses/lib/paste-parser.ts` | tryParseDate, tryParseCategory, ParsedRow, parsePastedRow | `src/features/expenses/components/expense-quick-add.tsx`, `test/features/expenses/paste-parser.test.ts` |
| `src/features/expenses/lib/utils.ts` | isCountedInExpenseTotals, generateId, buildSelfExpense, resolveSplitConfirm, applySplitSettlement | `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/hooks/use-expenses.ts`, `src/features/expenses/index.ts`, `test/features/expenses/split-confirm.test.ts` |
| `src/features/expenses/schemas.ts` | expenseSplitSchema, expenseDataSchema | `src/features/expenses/actions/expense-actions.ts` |
| `src/features/expenses/types.ts` | ExpenseType, ExpenseSplitData, ExpenseData | `src/features/expenses/actions/expense-actions.ts`, `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-chart.tsx`, `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/components/expense-table.tsx`, `src/features/expenses/components/expense-type-select.tsx`, `src/features/expenses/components/owed-summary.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/expenses/constants.ts`, `src/features/expenses/hooks/use-expenses.ts`, `src/features/expenses/index.ts`, `src/features/expenses/lib/expense-table.ts`, `src/features/expenses/lib/owed.ts`, `src/features/expenses/lib/paste-parser.ts`, `src/features/expenses/lib/utils.ts`, `src/features/profile/lib/export-data.ts`, `test/features/expenses/expense-actions.test.ts`, `test/features/expenses/expense-table.test.ts`, `test/features/expenses/owed.test.ts`, `test/features/expenses/split-confirm.test.ts`, `test/features/expenses/use-expenses-options.test.ts` |
| `src/features/household/actions/goal-actions.ts` | getGoals, createGoal, addContribution, deleteGoal | `src/features/household/hooks/use-household.ts`, `src/features/household/index.ts` |
| `src/features/household/actions/household-actions.ts` | createHousehold, getHousehold, unlockHousehold, createInvite, acceptInvite | `src/features/household/hooks/use-household.ts`, `src/features/household/index.ts` |
| `src/features/household/components/add-contribution-dialog.tsx` | AddContributionDialog | `src/features/household/components/goal-list.tsx` |
| `src/features/household/components/create-goal-dialog.tsx` | CreateGoalDialog | `src/features/household/components/household-overview.tsx` |
| `src/features/household/components/goal-card.tsx` | GoalCard | `src/features/household/components/goal-list.tsx` |
| `src/features/household/components/goal-list.tsx` | GoalList | `src/features/household/components/household-overview.tsx` |
| `src/features/household/components/household-overview.tsx` | HouseholdOverview | `src/features/household/components/index.ts` |
| `src/features/household/components/household-setup.tsx` | HouseholdSetup | `src/features/household/components/household-overview.tsx` |
| `src/features/household/components/household-skeleton.tsx` | HouseholdSkeleton | `src/features/household/components/household-overview.tsx` |
| `src/features/household/components/index.ts` | Internal module/stylesheet | `src/features/household/index.ts` |
| `src/features/household/components/invite-panel.tsx` | InvitePanel | `src/features/household/components/household-overview.tsx` |
| `src/features/household/constants.ts` | INVITE_TTL_HOURS, HOUSEHOLD_MEMBER_CAP | `src/features/household/actions/household-actions.ts` |
| `src/features/household/hooks/use-household.ts` | HOUSEHOLD_KEY, GOALS_KEY, useHousehold, useGoals, useCreateHousehold, useUnlockHousehold, useCreateInvite, useAcceptInvite, useCreateGoal, useAddContribution, useDeleteGoal | `src/features/household/components/add-contribution-dialog.tsx`, `src/features/household/components/create-goal-dialog.tsx`, `src/features/household/components/goal-list.tsx`, `src/features/household/components/household-overview.tsx`, `src/features/household/components/household-setup.tsx`, `src/features/household/components/invite-panel.tsx` |
| `src/features/household/index.ts` | Internal module/stylesheet | `src/app/dashboard/household/page.tsx` |
| `src/features/household/lib/goal-progress.ts` | GoalProgress, computeGoalProgress | `src/features/household/actions/goal-actions.ts`, `test/features/household/goal-progress.test.ts` |
| `src/features/household/schemas.ts` | createHouseholdSchema, acceptInviteSchema, createGoalSchema, addContributionSchema, CreateHouseholdInput, AcceptInviteInput, CreateGoalInput, AddContributionInput | `src/features/household/actions/goal-actions.ts`, `src/features/household/actions/household-actions.ts` |
| `src/features/household/types.ts` | HouseholdRole, HouseholdSummary, CreateHouseholdResult, InviteResult, AcceptInviteResult, GoalContribution, HouseholdGoal | `src/features/household/actions/goal-actions.ts`, `src/features/household/actions/household-actions.ts`, `src/features/household/components/add-contribution-dialog.tsx`, `src/features/household/components/goal-card.tsx`, `src/features/household/components/goal-list.tsx`, `src/features/household/index.ts` |
| `src/features/marketing/components/cta-band.tsx` | CtaBand | `src/features/marketing/index.ts` |
| `src/features/marketing/components/dashboard-preview.tsx` | DashboardPreview | `src/features/marketing/components/hero.tsx` |
| `src/features/marketing/components/faq.tsx` | Faq | `src/features/marketing/index.ts` |
| `src/features/marketing/components/feature-grid.tsx` | FeatureGrid | `src/features/marketing/index.ts` |
| `src/features/marketing/components/hero.tsx` | Hero | `src/features/marketing/index.ts`, `test/features/marketing/hero.test.tsx` |
| `src/features/marketing/components/moat-band.tsx` | MoatBand | `src/features/marketing/index.ts` |
| `src/features/marketing/components/motion-provider.tsx` | MotionProvider | `src/features/marketing/index.ts`, `test/features/marketing/hero.test.tsx` |
| `src/features/marketing/components/page-view-tracker.tsx` | PageViewTracker | `src/features/marketing/index.ts` |
| `src/features/marketing/components/reveal.tsx` | Reveal | `src/features/marketing/components/cta-band.tsx`, `src/features/marketing/components/faq.tsx`, `src/features/marketing/components/feature-grid.tsx`, `src/features/marketing/components/moat-band.tsx`, `src/features/marketing/components/security-band.tsx` |
| `src/features/marketing/components/security-band.tsx` | SecurityBand | `src/features/marketing/index.ts` |
| `src/features/marketing/components/tracked-cta-link.tsx` | TrackedCtaLink | `src/features/marketing/components/cta-band.tsx`, `src/features/marketing/components/hero.tsx`, `src/features/marketing/index.ts` |
| `src/features/marketing/constants.ts` | MarketingFeature, FEATURES, MoatPoint, MOAT_POINTS, TRUST_BADGES, FaqItem, FAQ_ITEMS | `src/features/marketing/components/faq.tsx`, `src/features/marketing/components/feature-grid.tsx`, `src/features/marketing/components/hero.tsx`, `src/features/marketing/components/moat-band.tsx`, `test/features/marketing/constants.test.ts` |
| `src/features/marketing/fonts.ts` | fraunces | `src/features/marketing/components/cta-band.tsx`, `src/features/marketing/components/hero.tsx` |
| `src/features/marketing/index.ts` | Internal module/stylesheet | `src/app/(public)/page.tsx` |
| `src/features/marketing/lib/track.ts` | trackEvent | `src/features/marketing/components/page-view-tracker.tsx`, `src/features/marketing/components/tracked-cta-link.tsx` |
| `src/features/profile/actions/profile-actions.ts` | getProfile, upsertProfile | `src/features/profile/hooks/use-export-data.ts`, `src/features/profile/hooks/use-profile.ts` |
| `src/features/profile/components/export-data-card.tsx` | ExportDataCard | `src/features/profile/components/index.ts` |
| `src/features/profile/components/index.ts` | Internal module/stylesheet | `src/features/profile/index.ts` |
| `src/features/profile/components/profile-form.tsx` | ProfileForm | `src/features/profile/components/index.ts` |
| `src/features/profile/hooks/index.ts` | Internal module/stylesheet | `src/features/profile/index.ts` |
| `src/features/profile/hooks/use-export-data.ts` | useExportData | `src/features/profile/components/export-data-card.tsx`, `src/features/profile/hooks/index.ts` |
| `src/features/profile/hooks/use-profile.ts` | useProfile, useUpsertProfile | `src/features/profile/components/profile-form.tsx`, `src/features/profile/hooks/index.ts`, `src/features/salary/hooks/use-salary-ytd-stats.ts` |
| `src/features/profile/index.ts` | Internal module/stylesheet | `src/app/dashboard/profile/page.tsx` |
| `src/features/profile/lib/export-data.ts` | EXPORT_VERSION, TaxReliefExport, ExportData, ExportEnvelope, buildExportEnvelope, serializeExport, exportFileName | `src/features/profile/hooks/use-export-data.ts`, `test/features/profile/export-data.test.ts` |
| `src/features/profile/schemas.ts` | profileSchema, ProfileFormValues | `src/features/profile/actions/profile-actions.ts`, `src/features/profile/components/profile-form.tsx` |
| `src/features/profile/types.ts` | ResidencyStatus, ProfileData | `src/features/profile/actions/profile-actions.ts`, `src/features/profile/components/profile-form.tsx`, `src/features/profile/hooks/use-profile.ts`, `src/features/profile/index.ts`, `src/features/profile/lib/export-data.ts` |
| `src/features/salary/actions/relief-actions.ts` | getTaxReliefs, getAllTaxReliefs, upsertTaxReliefs | `src/features/profile/hooks/use-export-data.ts`, `src/features/salary/hooks/use-tax-reliefs.ts` |
| `src/features/salary/actions/salary-actions.ts` | getSalaryRecords, getSalaryRecord, upsertSalaryRecord, deleteSalaryRecord | `src/app/dashboard/(overview)/page.tsx`, `src/features/profile/hooks/use-export-data.ts`, `src/features/salary/hooks/use-salary.ts` |
| `src/features/salary/components/index.ts` | Internal module/stylesheet | `src/features/salary/index.ts` |
| `src/features/salary/components/relief-row.tsx` | ReliefLabel, ReliefRow | `src/features/salary/components/tax-reliefs-dialog.tsx`, `test/features/salary/relief-row.test.tsx` |
| `src/features/salary/components/salary-chart.tsx` | SalaryChart | `src/features/salary/components/index.ts` |
| `src/features/salary/components/salary-form.tsx` | SalaryFormDialog | `src/features/salary/components/index.ts` |
| `src/features/salary/components/salary-summary-cards.tsx` | SalarySummaryCards | `src/features/salary/components/index.ts` |
| `src/features/salary/components/salary-summary.tsx` | ReliefItem, SalarySummary | `src/features/salary/components/index.ts`, `src/features/salary/components/tax-reliefs-dialog.tsx`, `src/features/salary/lib/tax-reliefs.ts` |
| `src/features/salary/components/salary-table.tsx` | SalaryTable | `src/features/salary/components/index.ts` |
| `src/features/salary/components/tax-reliefs-dialog.tsx` | TaxReliefsDialog | `src/features/salary/components/index.ts`, `src/features/salary/components/salary-summary.tsx` |
| `src/features/salary/constants.ts` | TAX_BRACKETS, NON_RESIDENT_RATE, CPF_EMPLOYEE_RATE, CPF_MONTHLY_CEILING, CPF_ANNUAL_CEILING, RELIEF_CATALOG | `src/features/salary/components/relief-row.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx`, `src/features/salary/lib/tax-cpf.ts`, `src/features/salary/lib/tax-reliefs.ts`, `test/features/salary/relief-row.test.tsx`, `test/features/salary/tax-reliefs.test.ts` |
| `src/features/salary/hooks/index.ts` | Internal module/stylesheet | `src/features/salary/index.ts` |
| `src/features/salary/hooks/use-salary-ytd-stats.ts` | SalaryYtdStats, useSalaryYtdStats | `src/features/salary/components/salary-summary-cards.tsx`, `src/features/salary/components/salary-summary.tsx` |
| `src/features/salary/hooks/use-salary.ts` | SALARY_KEY, useSalaryRecords, useSalaryRecord, useUpsertSalary, useDeleteSalary | `src/features/assets/components/salary-planner.tsx`, `src/features/salary/components/salary-form.tsx`, `src/features/salary/components/salary-table.tsx`, `src/features/salary/hooks/index.ts` |
| `src/features/salary/hooks/use-tax-reliefs.ts` | useTaxReliefs, useUpsertTaxReliefs | `src/features/salary/components/tax-reliefs-dialog.tsx`, `src/features/salary/hooks/index.ts` |
| `src/features/salary/index.ts` | Internal module/stylesheet | `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/(overview)/page.tsx`, `src/app/dashboard/salary/page.tsx` |
| `src/features/salary/lib/tax-cpf.ts` | getEarnedIncomeRelief, TaxProfileContext, computeAutoReliefs, calculateTax, getCpfMonthlyCeiling, getCpfAnnualCeiling, calculateMonthlyCpf, calculateAnnualCpf, TaxSummary, calculateTaxSummary | `src/features/salary/components/salary-summary.tsx`, `src/features/salary/hooks/use-salary-ytd-stats.ts`, `test/features/salary/tax-cpf.test.ts` |
| `src/features/salary/lib/tax-reliefs.ts` | ReliefState, ReliefStateMap, buildInitialState, buildReliefItems, computeTotal | `src/features/salary/components/relief-row.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx`, `test/features/salary/tax-reliefs.test.ts` |
| `src/features/salary/schemas.ts` | salaryDataSchema, taxReliefDataSchema | `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts` |
| `src/features/salary/types.ts` | SalaryData, TaxReliefData, ReliefVariant, ReliefDefinition | `src/features/profile/lib/export-data.ts`, `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts`, `src/features/salary/components/salary-chart.tsx`, `src/features/salary/components/salary-summary-cards.tsx`, `src/features/salary/components/salary-summary.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx`, `src/features/salary/constants.ts`, `src/features/salary/hooks/use-salary-ytd-stats.ts`, `src/features/salary/hooks/use-salary.ts`, `src/features/salary/hooks/use-tax-reliefs.ts`, `src/features/salary/index.ts`, `src/features/salary/lib/tax-reliefs.ts`, `test/features/salary/salary-actions.test.ts`, `test/features/salary/tax-reliefs.test.ts` |
| `src/integrations/clients/supabase.ts` | createSupabaseBrowserClient | `src/components/layout/user-menu-dropdown.tsx`, `src/features/auth/components/email-login-form.tsx`, `src/features/auth/components/login-button.tsx`, `src/features/auth/components/signout-button.tsx`, `src/features/auth/components/vault-unlock-flow.tsx` |
| `src/integrations/services/supabase.ts` | createSupabaseServerClient | `src/app/api/track/route.ts`, `src/app/api/vault/lock/route.ts`, `src/app/api/vault/route.ts`, `src/app/auth/callback/route.ts`, `src/components/layout/user-menu.tsx`, `src/features/admin/lib/get-marketing-stats.ts`, `src/lib/action-guard.ts` |
| `src/lib/action-guard.ts` | requireActionContext, requireDbContext, requireHouseholdContext | `src/features/assets/actions/planner-actions.ts`, `src/features/assets/actions/snapshot-actions.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/expenses/actions/expense-actions.ts`, `src/features/household/actions/goal-actions.ts`, `src/features/household/actions/household-actions.ts`, `src/features/profile/actions/profile-actions.ts`, `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts`, `src/lib/auth-guard.ts` |
| `src/lib/admin.ts` | parseAdminEmails, isAdminEmail | `src/features/admin/lib/get-marketing-stats.ts`, `test/lib/admin.test.ts` |
| `src/lib/auth-guard.ts` | requireUserId | `src/features/equity/actions/price-actions.ts` |
| `src/lib/client-crypto.ts` | deriveKeyClient, deriveKeyLegacy | `src/features/auth/components/vault-unlock-flow.tsx`, `test/lib/client-crypto.test.ts` |
| `src/lib/constants/env.ts` | isDev, getSupabaseEnv | `src/integrations/clients/supabase.ts`, `src/integrations/services/supabase.ts`, `src/lib/constants/index.ts`, `src/proxy.ts` |
| `src/lib/constants/index.ts` | Internal module/stylesheet | `src/lib/logger.ts` |
| `src/lib/constants/routes.ts` | PAGE_ROUTES, API_ROUTES | `src/app/auth/callback/route.ts`, `src/app/dashboard/(overview)/dashboard-overview.tsx`, `src/app/dashboard/assets/page.tsx`, `src/components/layout/dashboard-navbar.tsx`, `src/components/layout/public-navbar.tsx`, `src/components/layout/user-menu-dropdown.tsx`, `src/features/auth/components/email-login-form.tsx`, `src/features/auth/components/login-card.tsx`, `src/features/auth/components/signout-button.tsx`, `src/features/marketing/components/cta-band.tsx`, `src/features/marketing/components/hero.tsx`, `src/features/marketing/lib/track.ts`, `src/lib/constants/index.ts`, `src/proxy.ts` |
| `src/lib/constants/telemetry.ts` | MARKETING_EVENT_TYPES, MarketingEventType, TELEMETRY_PATH_MAX | `src/features/marketing/lib/track.ts`, `src/lib/validation/track-event.ts` |
| `src/lib/cookie-seal.ts` | getSessionSecret, sealCookie, openCookie | `src/app/api/vault/route.ts`, `src/lib/household-keystore.ts`, `src/lib/keystore.ts`, `src/lib/keystore.ts`, `test/lib/cookie-seal.test.ts`, `test/lib/household-keystore.test.ts` |
| `src/lib/crypto-constants.ts` | V2_ITERATIONS, KEY_LEN_BYTES, PBKDF2_DIGEST | `src/lib/client-crypto.ts`, `src/lib/household-key.ts`, `test/lib/client-crypto.test.ts` |
| `src/lib/crypto-fields.ts` | decryptNumber, decryptOptionalString, decryptOptionalNumber | `src/features/assets/actions/snapshot-actions.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/expenses/actions/expense-actions.ts`, `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts`, `test/lib/crypto-fields.test.ts` |
| `src/lib/crypto.ts` | DecryptionError, encryptPayload, decryptPayload | `src/app/api/vault/route.ts`, `src/features/assets/actions/snapshot-actions.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/expenses/actions/expense-actions.ts`, `src/features/household/actions/goal-actions.ts`, `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts`, `src/lib/crypto-fields.ts`, `src/lib/errors/handle-api-error.ts`, `src/lib/household-key.ts`, `src/lib/vault-migration.ts`, `test/api/vault.test.ts`, `test/features/assets/snapshot-actions.test.ts`, `test/features/equity/dividend-actions.test.ts`, `test/features/equity/equity-actions.test.ts`, `test/features/expenses/expense-actions.test.ts`, `test/features/household/goal-actions.test.ts`, `test/features/salary/relief-actions.test.ts`, `test/features/salary/salary-actions.test.ts`, `test/lib/crypto-fields.test.ts`, `test/lib/crypto.test.ts`, `test/lib/handle-api-error.test.ts`, `test/lib/household-key.test.ts` |
| `src/lib/errors/app-error.ts` | AppErrorCode, AppError | `src/lib/errors/handle-api-error.ts`, `src/lib/errors/index.ts`, `src/lib/errors/supabase-error.ts`, `test/lib/errors/supabase-error.test.ts`, `test/lib/handle-api-error.test.ts` |
| `src/lib/errors/handle-api-error.ts` | handleApiError | `src/lib/errors/index.ts`, `test/lib/handle-api-error.test.ts` |
| `src/lib/errors/index.ts` | Internal module/stylesheet | `src/app/api/track/route.ts`, `src/app/api/vault/lock/route.ts`, `src/app/api/vault/route.ts`, `src/features/assets/actions/planner-actions.ts`, `src/features/assets/actions/snapshot-actions.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/expenses/actions/expense-actions.ts`, `src/features/household/actions/goal-actions.ts`, `src/features/household/actions/household-actions.ts`, `src/features/profile/actions/profile-actions.ts`, `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts`, `src/lib/validation/parse-or-throw.ts`, `src/lib/vault-migration.ts` |
| `src/lib/errors/supabase-error.ts` | throwIfSupabaseError | `src/lib/errors/index.ts`, `test/lib/errors/supabase-error.test.ts` |
| `src/lib/household-cookie.ts` | HOUSEHOLD_KH_COOKIE, HOUSEHOLD_COOKIE_BASE_OPTS, HOUSEHOLD_COOKIE_MAX_AGE | `src/app/api/vault/lock/route.ts`, `src/lib/household-keystore.ts` |
| `src/lib/household-key.ts` | generateKh, wrapKh, unwrapKh, deriveInviteKey, hashInviteCode, generateInviteSecret | `src/features/household/actions/household-actions.ts`, `test/features/household/household-actions.test.ts`, `test/lib/household-key.test.ts` |
| `src/lib/household-keystore.ts` | getHouseholdKhSession, setHouseholdKhSession | `src/features/household/actions/household-actions.ts`, `src/lib/action-guard.ts` |
| `src/lib/keystore.ts` | getVaultDekSession | `src/app/dashboard/layout.tsx`, `src/lib/action-guard.ts` |
| `src/lib/logger.ts` | logger | `src/app/api/track/route.ts`, `src/app/api/vault/route.ts`, `src/features/admin/lib/get-marketing-stats.ts`, `src/lib/errors/handle-api-error.ts`, `src/lib/errors/supabase-error.ts`, `src/lib/household-keystore.ts`, `src/lib/keystore.ts`, `src/lib/utils/with-logging.ts`, `src/lib/validation/parse-or-throw.ts` |
| `src/lib/recharts.ts` | CHART_AXIS_TICK_PROPS, CHART_TOOLTIP_PROPS, Bar, BarChart, LabelList, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis | `src/features/admin/components/marketing-trend-chart.tsx`, `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/category-breakdown.tsx`, `src/features/assets/components/planner-results.tsx`, `src/features/equity/components/dividend-income-chart.tsx`, `src/features/expenses/components/expense-chart.tsx`, `src/features/salary/components/salary-chart.tsx`, `test/lib/recharts.test.ts` |
| `src/lib/utils/currency.ts` | formatSGD, formatSGDWhole, formatUSD, formatCurrency | `src/features/assets/components/asset-bar-chart.tsx`, `src/features/assets/components/category-breakdown.tsx`, `src/features/assets/components/deployable-cash-breakdown.tsx`, `src/features/assets/components/investment-breakdown.tsx`, `src/features/assets/components/market-allocation-table.tsx`, `src/features/assets/components/market-deployment-card.tsx`, `src/features/assets/components/monthly-investment-table.tsx`, `src/features/assets/components/planner-results.tsx`, `src/features/assets/components/snapshot-form.tsx`, `src/features/assets/components/snapshot-table.tsx`, `src/features/assets/components/summary-cards.tsx`, `src/features/equity/components/distributions-section.tsx`, `src/features/equity/components/dividend-income-chart.tsx`, `src/features/equity/components/dividend-table.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/equity/components/portfolio-summary.tsx`, `src/features/equity/components/trade-form-summary.tsx`, `src/features/equity/components/trade-table.tsx`, `src/features/equity/components/yield-on-cost-table.tsx`, `src/features/expenses/components/expense-chart.tsx`, `src/features/expenses/components/owed-summary.tsx`, `src/features/expenses/components/split-dialog.tsx`, `src/features/household/components/goal-card.tsx`, `src/features/salary/components/relief-row.tsx`, `src/features/salary/components/salary-chart.tsx`, `src/features/salary/components/salary-summary-cards.tsx`, `src/features/salary/components/salary-summary.tsx`, `src/features/salary/components/salary-table.tsx`, `src/features/salary/components/tax-reliefs-dialog.tsx`, `test/lib/currency.test.ts` |
| `src/lib/utils/index.ts` | cn | `src/components/layout/dashboard-navbar.tsx`, `src/components/layout/site-footer.tsx`, `src/components/ui/accordion.tsx`, `src/components/ui/avatar.tsx`, `src/components/ui/button-group.tsx`, `src/components/ui/button.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/card.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/field.tsx`, `src/components/ui/form.tsx`, `src/components/ui/input-group.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/select.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/shadcn-io/dropzone/index.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/tooltip.tsx`, `src/components/widgets/brand-text.tsx`, `src/components/widgets/empty-state.tsx`, `src/components/widgets/link-list.tsx`, `src/components/widgets/stat-card.tsx`, `src/features/auth/components/login-button.tsx`, `src/features/equity/components/holdings-table.tsx`, `src/features/expenses/components/editable-expense-row.tsx`, `src/features/expenses/components/expense-quick-add.tsx`, `src/features/expenses/components/expense-type-select.tsx`, `src/features/household/components/goal-card.tsx` |
| `src/lib/utils/local-store.ts` | loadLocal, saveLocal | `src/features/assets/components/investment-breakdown.tsx`, `test/lib/utils/local-store.test.ts` |
| `src/lib/utils/with-logging.ts` | withLogging | `src/app/api/health/route.ts`, `src/app/api/track/route.ts`, `src/app/api/vault/lock/route.ts`, `src/app/api/vault/route.ts` |
| `src/lib/validation/parse-or-throw.ts` | parseOrThrow | `src/features/assets/actions/planner-actions.ts`, `src/features/assets/actions/snapshot-actions.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/expenses/actions/expense-actions.ts`, `src/features/household/actions/goal-actions.ts`, `src/features/household/actions/household-actions.ts`, `src/features/profile/actions/profile-actions.ts`, `src/features/salary/actions/relief-actions.ts`, `src/features/salary/actions/salary-actions.ts` |
| `src/lib/validation/track-event.ts` | TrackEventSchema, TrackEventInput | `src/app/api/track/route.ts`, `test/lib/validation/track-event.test.ts` |
| `src/lib/vault-cookie.ts` | VAULT_DEK_COOKIE, VAULT_COOKIE_BASE_OPTS | `src/app/api/vault/lock/route.ts`, `src/app/api/vault/route.ts`, `src/lib/keystore.ts` |
| `src/lib/vault-migration.ts` | migrateUserVault | Convention/lifecycle or consumer tracing required |
| `src/lib/zod-utils.ts` | YYYY_MM | `src/features/assets/schemas.ts`, `src/features/salary/schemas.ts` |
| `src/proxy.ts` | isServerActionRequest, proxy, config | `test/proxy-request.test.ts` |
| `supabase/config.toml` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260411150000_init.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260413000000_add_vault_check.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260414000000_add_profile_insert_policy.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260527000000_add_vault_v2.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260528000000_fix_rekey_id_text.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260528010000_drop_rekey_rpc.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260528020000_drop_backup_tables.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260602000000_add_vault_unlock_throttle.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260611000000_add_marketing_telemetry.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260615000000_add_equity_dividends.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260616000000_add_trade_cdp_po.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260626000000_add_household.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260627000000_add_household_goals.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `supabase/migrations/20260705000000_fix_household_creator_select.sql` | Historical database migration; preserve replay order | Convention/lifecycle or consumer tracing required |
| `test/api/health.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/api/vault-lock.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/api/vault.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/components/dashboard-error.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/components/empty-state.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/components/page-header.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/components/site-footer.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/components/stat-card.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/components/theme-toggle.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/admin/compute-click-rate.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/calculations.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/investment-math.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/market-deployment-card.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/planner-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/planner-inputs.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/salary-plan.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/snapshot-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/assets/summary-cards.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/auth/email-login-schema.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/auth/use-idle-lock.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/broker-fees.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/dividend-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/dividend-metrics.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/dividend-scan.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/dividend-suggest.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/equity-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/holdings.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/mwr.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/price-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/ticker-map.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/trade-form-defaults.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/equity/trade-form-summary.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/expense-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/expense-quick-add.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/expense-table.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/expense-table.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/owed.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/paste-parser.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/split-confirm.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/expenses/use-expenses-options.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/household/goal-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/household/goal-progress.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/household/household-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/marketing/constants.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/marketing/hero.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/profile/export-data.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/profile/profile-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/salary/relief-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/salary/relief-row.test.tsx` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/salary/salary-actions.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/salary/tax-cpf.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/features/salary/tax-reliefs.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/helpers/fake-supabase.ts` | Test/helper; reviewed in tooling ledger | `test/features/assets/planner-actions.test.ts`, `test/features/assets/snapshot-actions.test.ts`, `test/features/equity/dividend-actions.test.ts`, `test/features/equity/equity-actions.test.ts`, `test/features/expenses/expense-actions.test.ts`, `test/features/household/goal-actions.test.ts`, `test/features/household/household-actions.test.ts`, `test/features/profile/profile-actions.test.ts`, `test/features/salary/relief-actions.test.ts`, `test/features/salary/salary-actions.test.ts` |
| `test/lib/action-guard.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/admin.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/client-crypto.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/cookie-seal.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/crypto-fields.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/crypto.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/currency.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/errors/supabase-error.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/handle-api-error.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/household-key.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/household-keystore.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/keystore.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/recharts.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/utils/local-store.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/lib/validation/track-event.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/proxy-request.test.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `test/stubs/server-only.ts` | Test/helper; reviewed in tooling ledger | Convention/lifecycle or consumer tracing required |
| `tsconfig.json` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |
| `vitest.config.ts` | Project/tool configuration or asset; see domain ledger | Convention/lifecycle or consumer tracing required |

## Identical-content groups (review candidates, not deletion authority)

## Supplemental regression files

These added tests were reviewed in the domain ledgers or continuation review.
Retain for boundary, lifecycle and real interaction regressions; coverage exclusions are unchanged.

<!-- prettier-ignore -->
| File | Purpose | Disposition |
| --- | --- | --- |
| `test/api/track.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/auth-callback.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/components/account-menu.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/components/navigation-workflows.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/components/vault-gate.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/admin/get-marketing-stats.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/chart-interactions.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/failed-reads.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/investment-allocation.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/investment-interactions.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/overview-workflows.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/snapshot-duplicate-submit.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/assets/snapshot-interactions.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/auth/email-login-form.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/auth/use-sign-out.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/auth/vault-unlock-flow.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/equity/equity-ui.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/equity/use-prices.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/expenses/expense-editing.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/expenses/expense-lifecycle.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/expenses/expense-rollback.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/expenses/expense-workflows.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/household/household-overview.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/household/household-workflows.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/marketing/storefront-workflows.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/profile/profile-form.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/profile/profile-workflows.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/profile/use-export-data.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/salary/salary-form.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/salary/salary-interactions.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/features/salary/tax-reliefs-dialog.test.tsx` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/helpers/fake-supabase.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/lib/with-logging.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
| `test/proxy-routing.test.ts` | Domain/boundary behavior and failure regression | Retain; assertions reviewed |
