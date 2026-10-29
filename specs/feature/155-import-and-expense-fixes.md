---
id: '155'
slug: import-and-expense-fixes
area: feature
status: approved
author: Claude Code
created: 2026-10-29
approved: 2026-10-29
shipped:
impl_pr: direct commit to main (no PR)
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.4'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.3'
constitution_overrides: []
---

# Spec 155: Statement import and expense fixes

## Approval

The owner reported these issues in chat on 2026-10-29 and asked for them to be
fixed. On the same day they approved the import split migration ("Add
migration") and asked for a recommendation on the discard prompts; the
recommendation below was applied.

## Problems and changes

1. **Duplicate check timed out in production.** "Check possible duplicates"
   and "Check saved expenses" called `getExpenses()`. That reads and decrypts
   every expense and every split under a 15 s deadline. Vercel logged
   `Request timed out` on `/dashboard/expenses`. A new server action,
   `getExpensesInRange(from, to)`, reads only the expenses dated within the
   rows being checked, with their splits. Both checks use it.
2. **"Keep both" was unclear.** The match was one line of text, so it was not
   clear what "both" meant. The warning now shows two labelled columns: "This
   row" and "Already saved" (or "Row #N in this statement"). Each shows date,
   Item / Brand and amount. The buttons read "Save both", "Don't save this
   row" and "Edit this row".
3. **Split at import.** Each row's "Description and details" gets a Split
   control next to the description. It uses the transaction history's split
   dialog. A row with splits saves as a shared expense.
   - A new insert-only RPC, `insert_imported_expenses(p_records, p_splits)`,
     inserts the records and their splits in one transaction. It never updates
     an existing id; a duplicate id raises `23505` and rolls back the group,
     the same as today's bulk insert.
   - Groups without splits keep the plain insert, so imports keep working
     before the migration is applied. A missing RPC (`PGRST202`) counts as
     not saved.
   - Split order is not stored, so save checks compare splits by person.
   - Splits do not affect the duplicate check.
4. **Merchant rules only from an import.** A "Merchant rules" button on the
   Expenses page opens the saved rules without a statement. The rule list gets
   a search box (rule name, matching words, Item / Brand) and pages of 10.
5. **Chosen file not shown.** The native file input was cleared after each
   pick, so it kept saying "No file chosen". The picker now shows a "Choose
   PDF" button and the chosen file's name.
6. **Discard prompts.** Closing the merchant rules window with an unsaved rule
   asks before discarding it. Closing the statement import window asks only
   when saves are in flight or unconfirmed, or a rule save is pending; a
   selection alone no longer asks.
7. **Mobile.** At 375 px, the Expenses page and the import and rules windows
   have no horizontal page scroll, and the row and rule controls wrap.
8. **Household goal items read error.** Not changed. `readAllRows` throws
   `household goal items read failed` for a Supabase error, which logs a
   `supabase error` line with its code just before, or for a row count that
   changed between pages. It happened in the same window as the expense
   timeouts, so a slow database is likely. The owner will supply the logged
   code before any fix.

## Migration

`supabase/migrations/20261029000155_insert_imported_expenses.sql` adds the
RPC. It is additive. The owner applies it to production; agents never run
production SQL. Rollback: `DROP FUNCTION public.insert_imported_expenses(jsonb, jsonb);`.

## Acceptance

- Gates: `pnpm check && pnpm test:ci && pnpm build`.
- Tests cover the range read, the side-by-side duplicate labels, split save
  through the RPC, order-insensitive split checks, rule search and paging, the
  file name, and both discard rules.
- Local browser check at desktop and 375 px with the seed user.
