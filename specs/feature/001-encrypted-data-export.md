---
id: 001
slug: encrypted-data-export
area: feature
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # owner reviewed spec + approved
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # owner can always retrieve their own (decrypted-client-side) data
  - '§4.2' # ships unit tests for the export assembly + the new action
constitution_overrides:
---

# Spec feature/001: Encrypted-vault data export (JSON backup)

## Problem

Fynfo is a zero-knowledge vault: all data is encrypted at rest and only the owner (with the PIN-derived
DEK) can read it. But there is **no way to get the data out**. If Supabase is lost, the account is
deleted, or the owner simply wants an offline archive, the data is trapped. For a personal wealth
record this is the highest-value missing capability — own-your-data portability.

## Constitution check

- Satisfies `§2.1` (the owner can always retrieve their own data) and `§4.2` (tests). Overrides: none.
- **No migration** (the new action is a plain `SELECT`), **no new dependency** (Blob/anchor download is
  native), no change to encryption. The `get*` actions already decrypt server-side using the
  session DEK and return plaintext to the authenticated client — export reuses that path.

## Solution shape

Pure client-side assembly + browser download. No new server endpoint.

- **`src/features/profile/lib/export-data.ts`** (pure, unit-testable):
  - `EXPORT_VERSION = 1`.
  - `buildExportEnvelope(parts, exportedAt) → ExportEnvelope` =
    `{ version, app: 'fynfo', exportedAt, data: { profile, snapshots, expenses, salary, taxReliefs,
trades, plannerSettings } }`. Stable, versioned shape (designed so a future import can branch on
    `version`).
  - `serializeExport(envelope) → string` (pretty JSON) and `exportFileName(date) →
'fynfo-backup-YYYY-MM-DD.json'`.
- **`src/features/salary/actions/relief-actions.ts`**: add `getAllTaxReliefs(): Promise<Array<{ year:
number } & TaxReliefData>>` — selects every relief row for the user (no year filter), decrypts
  `amount` via the shared `decryptNumber` helper. Mirrors the existing decrypt-list pattern; needed
  because reliefs are stored per-year and there is no all-years getter today.
- **`src/features/profile/hooks/use-export-data.ts`** (`'use client'`): a `useExportData()` returning
  `{ exportData, isExporting }`. `exportData()` runs the seven `get*` calls via `Promise.all`, builds
  the envelope, and triggers a download by creating a `Blob`, an object URL, and a temporary anchor
  click (revoked after). Errors → `toast.error`, no partial file; success → `toast.success`.
- **Profile page** (`src/app/dashboard/profile/page.tsx`): an "Export my data" section/button wired to
  the hook, with a spinner while exporting.

**Data flow:** click → parallel decrypt-fetch (existing auth + DEK) → assemble JSON in the browser →
Blob download saved by the user. Nothing decrypted is persisted anywhere new.

## Out of scope (YAGNI)

- **Import / restore** — the envelope is _shaped_ for it (`version`), but the import path is a separate
  feature.
- CSV / per-domain files / zip (would need a zip dep).
- Encrypting the export file (it is a user-initiated plaintext backup the owner controls).
- Scheduling / automatic backups.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] `buildExportEnvelope` tests: correct version/app/shape, all seven domains present, empty-data
      (nulls/[]), deterministic `exportedAt`. `getAllTaxReliefs` tested via `fake-supabase`
      (decrypts amount, includes year, opaque error path).
- [ ] Manual: button on Profile downloads `fynfo-backup-<date>.json` containing all domains; error
      toast on a failed fetch; works only when the vault is unlocked.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: additive — a new read-only export path + one new `SELECT` action; no existing
  feature or data touched. The export contains decrypted financial data in a file the user saves;
  that is the intended behavior (their data, their device), and matches what the app already returns to
  the client today.
- **Reversibility**: `git revert` (delete the new files + button + action).
- **Backout plan**: revert the commit.

## Open questions

- None (export-only, JSON, all domains incl. profile — confirmed with owner).
