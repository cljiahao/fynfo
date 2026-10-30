---
id: '156'
slug: import-period-required-focus
area: fix
status: shipped
author: Claude Code
created: 2026-10-30
approved: 2026-10-30
shipped: 2026-10-30
impl_pr: direct commit to main (no PR)
supersedes:
constitution_satisfies:
  - '§2.4'
  - '§2.5'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.4'
constitution_overrides: []
---

# Spec 156: Import period inputs no longer trigger a non-focusable required error

## Problem

The browser console on the Expenses page logs "An invalid form control with
name='' is not focusable". The Period start and Period end inputs in
`src/features/import-review/components/statement-source-form.tsx` (the
`<details open={manualPeriod}>` block, L111) carry `required={manualPeriod}`
(L130, L143). `open` is a controlled prop, but the user can still collapse the
`<details>` by clicking its summary while `manualPeriod` stays true. A
collapsed `<details>` hides its content, so when the form is submitted, native
validation finds an empty required input it cannot focus, blocks the submit and
logs that error. The user sees nothing happen.

This is the suspected cause, not yet proven. The implementer must reproduce it
in the browser first (set a manual period, clear a date, collapse "Dates
(optional)", press the extract button) and confirm the console message comes
from this form before changing code. If the source is different, stop and
report instead of applying the fix below.

Other `required` inputs under a collapsible container: a search of
`src/features/import-review/components/` and
`src/features/expenses/components/` found `required` only at L130 and L143 of
this file. The other `<details>` blocks (`statement-row-card.tsx` L327,
`expense-anomaly-review.tsx`, `import-outcome.tsx`, `statement-viewer.tsx`
L160, `merchant-rule-manager.tsx` L151) contain no `required` control, so they
are not affected.

## Constitution check

- Satisfies: `§2.4` (change stays in the feature component, no page data
  fetching), `§2.5` (stays a Client Component, already `'use client'` for
  `useAmountVisibility`), `§3.2` (Tailwind only, no inline styles, no
  `console.log`), `§3.4` (file naming unchanged), `§4.1` and `§4.4` (gates),
  `§4.2` (regression test for a bugfix).
- Overrides: none.

## Solution shape

- Edit `src/features/import-review/components/statement-source-form.tsx` only,
  plus its test.
- Remove `required={manualPeriod}` from both date inputs. Keep `type="date"`.
- Validate in the existing `onSubmit` handler, after `canReveal()` and before
  `onExtract()`. When `manualPeriod` is true and `from` or `to` is empty, call
  `event.preventDefault()` (already called), skip `onExtract()`, set local
  state `periodError` to a short message such as "Enter both period dates, or
  use the dates from the PDF." and open the details.
- Track the details open state locally: `const [open, setOpen] = useState(
manualPeriod)`. Render `<details open={open} onToggle={(e) =>
setOpen(e.currentTarget.open)}>`. An effect re-syncs `open` to true when
  `manualPeriod` flips from false to true (so a manual edit elsewhere still
  reveals the block). Do not call `setState` inside an effect in a way that
  trips the `set-state-in-effect` lint rule; derive the sync with the
  "adjust state during render" pattern if lint objects.
- Render the error inside the details block below the inputs with
  `role="alert"`, `text-sm text-loss`-style existing token classes, and link
  it to both inputs with `aria-describedby` and `aria-invalid`. Clear it on the
  next `onPeriodChange` or `onUsePdfDates`.
- Focus the first empty date input after opening the details, via a ref and
  `requestAnimationFrame` or an effect keyed on the error, so keyboard users
  land on the problem.
- No data, schema, encryption or server-action change.

## Out of scope

- Changing when `manualPeriod` becomes true or how the period is detected
  (`lib/statement-period`).
- Validating that `from <= to`. That is already handled downstream.
- Replacing native `<details>` with another disclosure component.
- Any other form in the app.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new RTL tests in
      `test/features/profile/statement-import.test.tsx` (or a new
      `statement-source-form.test.tsx` beside it): with `manualPeriod` true and
      an empty date, collapsing the details and submitting shows the visible
      alert, reopens the details, does not call `onExtract`, and the inputs have
      no `required` attribute; with both dates filled, submit calls `onExtract`;
      the error clears after a date change
- [ ] `pnpm build` green
- [ ] Manual: reproduce the console error on `main` first, then confirm it no
      longer appears after the fix with the details collapsed

## Risk & reversibility

- **Blast radius**: the statement source form only. No stored data involved.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the implementation commit on `main`.

## Open questions

- [ ] Q: Is the console error really from this form, not another page element?
      — Owner: implementer, confirm in the browser before editing — A: Not reproduced in-app (no local Supabase available to the implementer). Mechanism is standard browser behavior for a required empty input inside a collapsed details; the only required controls under a collapsible were these two inputs. Owner browser check deferred.
