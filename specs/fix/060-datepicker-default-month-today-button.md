---
id: 060
slug: datepicker-default-month-today-button
area: fix
status: approved
author: Claude (Opus 4.8)
created: 2026-07-04
approved: 2026-07-04
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§1.1'
constitution_overrides:
---

# Spec 060: Date picker opens on selected date + Today shortcut

## Problem

The expense date pickers (`expense-quick-add`, `editable-expense-row`) open the
calendar on the current month instead of the month of the date already shown in
the field. Editing an expense dated three months ago forces the user to page
back manually every time. react-day-picker only honours `selected` for
highlighting — without `defaultMonth` it defaults the visible month to today.

## Constitution check

- Satisfies: `§1.1` (personal wealth dashboard usability)
- Overrides: none.

## Solution shape

- `src/features/expenses/components/expense-quick-add.tsx` and
  `src/features/expenses/components/editable-expense-row.tsx`:
  - Pass `defaultMonth={<field date> ?? undefined}` to `<Calendar>` so the
    calendar opens on the stored date's month.
  - Add a "Today" button in a bordered footer below the calendar inside
    `PopoverContent`; clicking it sets the field to today (`yyyy-MM-dd`) and
    closes the popover — same commit path as clicking a day.
- No new dependency, no shared component change (the two call sites are the only
  day-picker calendars; salary/snapshot forms use a month `<input>`).

## Out of scope

- Salary and snapshot month `<input>` fields.
- Any `src/components/ui/calendar.tsx` change.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: open the picker on an expense dated in a prior month — calendar
      shows that month; "Today" button jumps the field to today and closes.

## Risk & reversibility

- **Blast radius**: two expense date-picker popovers only.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- none.
