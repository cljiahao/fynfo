---
id: '189'
slug: statement-import-followups
area: feature
status: shipped
author: Claude Code
created: 2026-11-15
approved: 2026-11-15
shipped: 2026-11-16
impl_pr: none (direct to main, a8b6798, b8993d4, 82b4bfb, 7888ce8)
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§5.1'
constitution_overrides:
---

# Spec 189: Statement import follow-ups (Citi billed amount, savings statements)

## Problem

Owner testing of the deployed statement import (main at `b2ba380`, evidence
date 2026-11-15) left two code changes and two closed observations from specs 181, 182, 186 and 188. No
statement text is quoted in this spec; every shape below is redacted (digits as
`9`, merchant letters as `a`, `x` is the left edge of the OCR or text token).

- **A. Citi rows land in Needs review.** On a real Citi card statement of 27
  rows, exactly 5 rows have an SGD-tagged amount in the middle of the line
  followed by the billed amount in the amount column. The suggested amount for
  those rows is the mid-line figure, and the dialog flags the amount columns as
  ambiguous. The 5 "Needs review" rows were matched to these 5 rows by count
  only; that is the evidence level, not a row-by-row comparison.
- **B. DBS or POSB savings statements are misparsed, not rejected.** Reasoned
  from the code, not run: with bank "DBS" chosen manually, a deposit-account
  statement is parsed by the generic date-row fallback, so a deposit line could
  be offered as an expense suggestion.

Three further observations are recorded as closed or still open so they are not
re-investigated.

- **Closed without change: Citi amount without a decimal point.** The admin OCR
  dump page always runs OCR (`components/ocr-dump.tsx`), while the review dialog
  reads the pdf.js text layer unless a page needs OCR
  (`lib/local-pdf.ts:145-173`). No code inserts or removes a decimal point:
  `MONEY` (`statement-layouts/patterns.ts:5-6`) requires a literal dot. The dump
  showed OCR dropping the dot; the value in the dialog came from the text layer.
  No code change.
- **Closed without change: HSBC row kept at 0% confidence with an empty
  amount.** See "Closed observation: HSBC unreadable-amount row" below.
- **Still open, not addressed here:** a real end-to-end SAVE of an imported
  statement has never been done. That is an owner test on the deployed site, not
  a code change, and it is not a precondition of this spec.

## Constitution check

- Satisfies: `§2.1` and `§5.1` (all logic runs on lines already extracted in the
  browser; nothing new leaves the browser, no PIN or DEK handling changes, no
  server change, no save-payload change), `§2.7` (named exports only), `§3.1`
  and `§3.2` (no new dependency, no banned pattern), `§3.4` (no new file names
  outside kebab-case), `§4.1` (all five gates), `§4.2` (each behaviour change is
  proved by a test on synthetic fixtures).
- Overrides: none. No `HARD` rule is touched. No `SOFT` override is needed.
- No new `'use client'`, no migration, no crypto change, no new dependency
  (`AGENTS.md §0.4` is not triggered).

## Current behaviour (verified against the code)

Each claim was read from the code on `b2ba380`. Where a pointer in the request
that led to this spec was wrong, it is corrected here.

### Item A: Citi

- `cleaned()` (`statement-layouts/citi.ts:26-32`) trims the line, drops a
  trailing 16-digit reference (`TRAILING_REFERENCE`, `citi.ts:20`) and drops an
  SGD trailer with `SGD_TRAILER` (`citi.ts:23-24`). `SGD_TRAILER` requires
  `SGD`, two amounts, and a lookahead for a third amount at the end of the line.
  It therefore matches `SGD 9.99 9.99 9.99` (strips the first two) and does not
  match `SGD 99.99 9.99` (only two amounts).
- `groupRows` (`citi.ts:59-72`) emits one single-line group per `ROW_START` line
  and skips `FOREIGN AMOUNT` continuation lines (`citi.ts:68`).
- `qualifyRow` (`statement-parser.ts:269-357`) collects every `MONEY` match in
  the body. With exactly one `SGD`-tagged match it chooses that match
  (`statement-parser.ts:282-290`), and with a second non-USD value it adds
  "Multiple amount columns are ambiguous; compare the original statement."
  (`statement-parser.ts:336-342`). The suggested amount is therefore the
  mid-line SGD figure and the row is flagged.
- Layout flags are `columns: { billedSgd: true, twoDate: false }` (`citi.ts:73`).

Redacted shape of the 5 rows (x of each token from the OCR dump; the review
dialog reads the text layer, which has no x, so the rule must work on text):

```text
99 SEP aaaaaaaaaaaaaaaa   208|SGD 247|99.99   551|9.99
```

Date, a one-word description, an `SGD` token at x~208, an amount at x~247, then
the billed amount at x~551. Every Citi row's billed amount is the last token on
the line (x~533-551).

### Item B: DBS and POSB savings statements

- Auto-detect returns none: `dbsLayout.detect` (`statement-layouts/dbs.ts:16-19`)
  claims pages only when a `DATE DESCRIPTION AMOUNT (S$)` header exists
  (`dbs.ts:5`).
- Bank identity for `dbs` is `/\bDBS\b|\bPOSB\b/i` with an exclusion for PayLah
  wallet text (`constants.ts:11-18`), so a savings statement passes the manual
  bank gate in `matchesStatementIdentity` (`statement-parser.ts:361-370`).
- `parseStatementLines` (`statement-parser.ts:375-420`) builds groups from
  `layout.groupRows(...)` plus `groupDateRows(unclaimed)`; with no claimed page
  every line is unclaimed, so `groupDateRows` (`patterns.ts:17-39`) turns each
  date-led line into a row, and continuation lines are attached while a row has
  no `MONEY` match yet. A savings line such as a dated deposit becomes a
  candidate and can be suggested as an expense when it carries a positive amount
  and no credit wording. This is reasoned from the code and has not been run;
  acceptance requires a synthetic fixture proving it before the fix.
- The same fallback applies to every bank whose layout claims no page:
  `uob` and `paylah` when their own markers are missing, and `hsbc` and
  `citibank` when their column headers are missing (those layouts claim pages
  only on a header). This is a risk noted below, not scope here.

## Solution shape

All edits are client-side, pure line logic. The only files a later
implementation may touch are listed per item and in "Files". Nothing in
`src/app`, `src/proxy.ts`, server actions, API routes, `src/lib/**` crypto files
or Supabase is touched.

### Item A: Citi billed amount is the trailing amount

Rule. On a Citi row, the billed amount is the last amount token on the line. A
mid-line `SGD <amount>` that is followed by exactly one further amount at the
end of the line is description detail and is not a competing amount: it is
dropped in `cleaned()` the same way `SGD_TRAILER` already is. Implementation
shape: a second trailer pattern in `citi.ts`, applied after `SGD_TRAILER`,
matching `\s+SGD\s+<amount>(?=\s+\(?<amount>\)?\s*$)` where `<amount>` is
`[\d,]+\.\d{2}`. It works on `line.text`, so it behaves the same for text-layer
rows (no x) and OCR rows.

Edge cases the tests must pin:

- Credit in parentheses in the amount column: `SGD 99.99 (9.99)`. The trailing
  `(9.99)` stays; the mid-line figure is dropped; the existing credit handling
  in `suggestClassification` (`statement-parser.ts:167-168`, parentheses) still
  classifies the row as a credit and blocks it from becoming an expense.
- A row followed by a `FOREIGN AMOUNT` continuation line: that line is still
  skipped (`citi.ts:68`) and does not change the row's amounts.
- Text-layer row without x: same result as the OCR row.
- Trailing 16-digit reference after the billed amount: `TRAILING_REFERENCE` runs
  first (`citi.ts:29`), so the new pattern sees the amount last.
- `SGD <amount>` as the last amount with nothing after it (one amount only): not
  matched; unchanged.

Must NOT change:

- The existing `SGD_TRAILER` case (`SGD a b` followed by a third amount) keeps
  its current output.
- A row with a single amount keeps its current output, including a row whose
  single amount is `SGD`-tagged.
- A row that carries `USD` or another non-SGD tag keeps the current handling in
  `qualifyRow` (`statement-parser.ts:281-290, 338`).
- `qualifyRow`, `groupDateRows` and the generic ambiguity message are not
  edited; other banks are unaffected.

Out of scope for Item A: deciding what these 5 rows are; changing how the
amount is chosen for any other bank; reading the amount column by x position.

### Item B: reject deposit-account statements

Rule. When the bank is `dbs` (the identity that also matches POSB), the layout
claims no page, and the text carries a deposit-account column header (a line
containing the words `WITHDRAWAL` and `DEPOSIT` and `BALANCE` as column labels,
in any order on one line, case-insensitive, for example the shape
`aaaaaaaaaa  aaaaaaa  aaaaaaa  aaaaaaa`), `parseStatementLines` throws:
"Savings account statements are not supported yet. Import a card statement."
Surfacing the message needs a small UI edit. The `catch` in `reparse()`
(`components/statement-review.tsx:316-327`) discards the thrown error and always
shows "The selected bank could not be identified in this PDF...", so a thrown
savings message would never reach the owner. Proposed: export a named error
class (for example `UnsupportedStatementError`) from `statement-parser.ts`,
throw it for this case, and in the `catch` show its message when
`error instanceof UnsupportedStatementError`, keeping the current text for every
other error. The component already is a client component; no new `'use client'`.

Shape (redacted, synthetic form used in tests):

```text
DATE   DESCRIPTION   WITHDRAWAL   DEPOSIT   BALANCE
99 Sep aaaaaaaaaaaaa   9.99   9,999.99
```

Implementation shape: one exported pattern and a small predicate in
`statement-layouts/patterns.ts` (for example `isDepositAccountHeader(text)`),
and one guard in `parseStatementLines` (`statement-parser.ts`) placed after the
identity check and before grouping, active only when `bank === 'dbs'` and
`claimedPages.size === 0`. A card statement that happens to mention the word
"balance" or "deposit" is not affected because the guard needs all three column
words on a single line and no claimed page.

Edge cases the tests must pin:

- Savings header present, bank `dbs`: throws the message above (today the same
  fixture yields candidate rows; the test first asserts that, then the fix flips
  it, which records the current misparse).
- A real card fixture (header `DATE DESCRIPTION AMOUNT (S$)`) with a
  description containing `DEPOSIT`: parses as before.
- The PayLah fixture and the UOB fixture: unchanged.
- A DBS text with no header of either kind: unchanged (still falls back, still
  returns rows or the existing "No supported transaction rows" error).
- In the dialog, a savings fixture with bank DBS shows the savings message and
  no rows; any other parse error still shows the existing bank message.
- Auto-detect (`statement-bank-detect.ts`) is unchanged; the guard acts only on
  the manual or confirmed `dbs` parse.

Risk noted, not widened: the generic fallback also exposes `uob` and `paylah`
(when their markers are missing) and `hsbc` and `citibank` (when their column
header is missing) to misparsing unrelated statement types. This spec does not
guard them; a later spec may generalise the check once a real sample of another
bank's deposit statement exists.

Out of scope for Item B: parsing savings statements; any real savings sample;
changes to bank identity patterns or auto-detect; guarding other banks.

## Files a later implementation may touch

- `src/features/import-review/lib/statement-layouts/citi.ts` (Item A)
- `src/features/import-review/lib/statement-layouts/patterns.ts` (Item B
  predicate)
- `src/features/import-review/lib/statement-parser.ts` (Item B guard and error
  class only)
- `src/features/import-review/components/statement-review.tsx` (Item B: show
  the error message in the `catch` of `reparse()`)
- `test/features/profile/statement-review.test.tsx` (Item B: the message reaches
  the dialog)
- `test/features/profile/statement-layouts-citi.test.ts` (Item A tests)
- `test/features/profile/statement-parser.test.ts` (Item B tests)
- This spec file (appendix of redacted shapes, then status and ship fields)

Nothing else. `test/features/profile/statement-layouts-dbs.test.ts`,
`test/features/import-review/statement-guards.test.ts` and
`test/features/import-review/statement-bank-detect.test.ts` are run unchanged as
regression and must still pass.

## Out of scope

- Supporting savings or deposit-account statements.
- Any change to bank auto-detect, `validStatementPeriod`, period readers or the
  total-check tolerance.
- Deciding what the 5 Citi rows are or changing how any other bank picks its
  amount.
- Any HSBC parsing change (see the closed observation).
- Re-OCR of a low-confidence line at higher scale: a possible future item, not
  proposed or scoped here.
- A decimal-point fix for Citi (closed without change, see Problem).
- The end-to-end SAVE of an imported statement (owner test).
- New banks, new dependencies, server changes, schema, payload or crypto changes.
- Real statement content in the repo: fixtures are synthetic and built from the
  redacted shapes in this spec, never from the PDFs.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` all green (`§4.1`).
- [ ] Item A: a synthetic Citi row with the shape
      `99 SEP aaaa SGD 99.99 9.99` yields the trailing amount `9.99` with no
      "Multiple amount columns are ambiguous" issue and status `candidate`; the
      same row with `(9.99)` stays a credit and is not an expense candidate; a
      row followed by a `FOREIGN AMOUNT` line and a row with a trailing 16-digit
      reference give the same amount; a text-layer (no x) variant gives the same
      result.
- [ ] Item A, unchanged cases: the existing `SGD a b c` fixture and single-amount
      rows produce the same output as before (existing assertions untouched).
- [ ] Item B: a synthetic savings-layout fixture first asserted to produce
      candidate rows under the old code path (recorded in the PR body), then
      asserted to throw the savings message; card, PayLah and UOB fixtures
      unchanged.
- [ ] No new dependency (`package.json` and lockfile unchanged); no `any`, no
      `console.log`, no `@ts-ignore` (`§3.2`, `AGENTS.md §3`).
- [ ] Only the files in "Files a later implementation may touch" changed.
- [ ] Manual (owner, deployed site): the Citi statement shows the 5 rows with
      the billed amount; a savings PDF with bank DBS chosen shows the "not supported yet" message.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: the statement import dialog only, one layout and one guard.
  Item A changes which amount a Citi row suggests; a wrong rule could suggest the
  wrong figure for a row type not yet seen, so the pattern is anchored to the
  line end and to exactly one further amount. Item B can only add a rejection,
  and only for a `dbs` parse with no claimed page and a three-word column
  header.
- **Reversibility**: pure client logic; a single git revert per item. No data,
  migration or encryption path changes. Nothing is saved by this change.
- **Backout plan**: revert the item's commit; items are independent.
- **Residual**: the generic fallback exposure of other banks (Item B risk note)
  and unrecoverable letter-misread HSBC amounts (closed observation) remain.

## Open questions

- [x] Q1: What are the 5 Citi rows (fee, conversion or foreign-spend rows?) and
      is the trailing figure the right expense amount? — Owner: Clarence. — A:
      The 5 rows were matched to the 5 "Needs review" rows by count only.
      Compare them against the paper statement before approving Item A; if the
      mid-line SGD figure is the right amount for any of them, the rule changes.
- [x] Q2: For Item B, is a single-line `WITHDRAWAL` + `DEPOSIT` + `BALANCE`
      header the right deposit-account signal, given no real savings statement
      has been examined? — Owner: Clarence. — Proposed default: yes; if a real
      savings PDF prints these labels on separate lines, the owner supplies a
      redacted shape and the predicate is adjusted.

Owner decision (accepted 2026-11-15, "Approve as drafted"): the proposed defaults
for Q1 and Q2 are accepted as written.

## Closed observation: HSBC unreadable-amount row

No code change. On the real HSBC scan one row was kept with an empty amount at
0% confidence and the statement total check (`reconcileStatement`,
`statement-guards.ts:54-80`, exact cents, no tolerance) was off by 1.00.
Evidence (admin OCR dump, deployed main `b2ba380`, 2026-11-15, character
classes only) shows the row is unreadable because OCR misread the entire line:
line confidence 1, date and month glued, and the amount token is all letters.
`parseRow` failing closed (empty amount, confidence 0, `hsbc.ts:125-127`) is the
intended outcome: the row is flagged and the user types the amount in review. No
parsing rule can recover letters that carry no amount. The total-check mismatch
follows from that row counting as 0 in `reconcileStatement`. A 4-character
amount token is consistent with a difference of 1.00, but the sign and value are
not established.

The earlier hypothesis, a punctuation-only token after a valid amount, is not the
cause: `tableTokens` already drops tokens with no ASCII letter or digit
(`hsbc.ts:59`), and `statement-layouts-hsbc.test.ts:231-248` covers it. Spec 188
observation e (`specs/feature/188-statement-period-detection.md`, lines 199-202
and 227-228) is the origin of this item.

Possible future item, explicitly out of scope and not proposed: re-OCR of a
low-confidence line at a higher scale.

## Appendix A: redacted HSBC dump shapes

The four row-shaped lines on page 1 of that statement. Classes: `U` upper case
letter, `l` lower case letter, `9` digit, `~` non-ASCII character. Numbers before
`|` are token x positions.

- Line 20, confidence 90: lead `99 Ull 99 Ull`, amount column `334|9,999.99`. A
  valid amount.
- Line 22, confidence 50: lead `99 Ull 99 Ull`, amount column `349|9.99` then
  `383|-~` (2 characters, no ASCII letter or digit). The junk token is dropped by
  `tableTokens`, so the row parses normally. This is not the 0% row.
- Line 23, confidence 1: lead `61|99Ull 102|99Ull` (date and month glued), amount
  column one token `348|Ulll` (4 characters, one upper and three lower, no dot,
  no digit). Substituting O->0, l or I->1, S->5, B->8 does not yield an amount.
  This is the 0% row with an empty amount.
- Line 25, confidence 58: lead `99 Ull 99 Ull`, amount column `332|9,999.99UU` (an
  attached `CR`): a credit, excluded.

This matches the review dialog: two rows with amounts, one excluded, one
unreadable.
