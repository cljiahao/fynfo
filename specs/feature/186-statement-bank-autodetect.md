---
id: '186'
slug: statement-bank-autodetect
area: feature
status: draft # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-10
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
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

# Spec 186: Detect the statement bank automatically

## Problem

The statement import makes the user pick the bank before extracting. The
"Statement bank" `<select>` in
`src/features/import-review/components/statement-source-form.tsx:87-101` is
fed by `STATEMENT_BANKS` (`src/features/import-review/constants.ts:1-21`) and
`statement-review.tsx:105` defaults it to UOB. A user who forgets to change it
gets "The selected bank could not be identified in this text PDF."
(`statement-parser.ts:358-365`) or the generic failure text at
`statement-review.tsx:312`, and has to guess which setting was wrong. The
statement already says which bank it is from; the app should read that.

The hint under the form (`statement-source-form.tsx:229-231`) also still says
"Scans and some bank layouts need manual entry". That has been untrue since
spec 182 (scanned statements are read by local OCR) and spec 181 (DBS, Citibank,
HSBC and PayLah layouts), so it needs correcting.

## Constitution check

- Satisfies: `§2.1` and `§5.1` (detection reads lines that are already
  extracted in the browser; nothing new leaves the browser, no PIN or DEK
  handling changes, no server change), `§2.7` (named exports only), `§3.1` and
  `§3.2` (no new dependency; no banned pattern), `§3.4` (kebab-case files),
  `§4.1` (all gates), `§4.2` (new pure logic is covered by tests).
- Overrides: none.
- No `HARD` rule is touched. The server actions, the import payload schema
  (`src/features/expenses/lib/import-expense.ts:38`) and the Supabase schema are
  unchanged.

## Current mechanism (verified against the code)

Bank selection is checked in two separate places, and both matter.

1. **Identity gate, whole-document regexes.** `STATEMENT_BANKS` entries carry an
   `identity` regex and an optional `exclude` regex (`constants.ts:1-21`).
   `parseStatementLines` runs them over the joined text of all lines
   (`statement-parser.ts:357-365`) and throws if the chosen bank's identity does
   not match or its `exclude` does. The gate lives in `statement-parser.ts`, not
   in the layouts. Array order is the order shown in the select (UOB, DBS
   PayLah, DBS, HSBC, Citibank). The comment "Checked ahead of DBS" on the
   PayLah entry is only about that order; today nothing reads the order for
   resolution.
2. **Layout page claim, `StatementLayout.detect(lines)`**
   (`statement-layouts/types.ts:4-5`). `getStatementLayout(bank)`
   (`statement-layouts/index.ts:17-20`) returns the chosen bank's layout and
   `parseStatementLines` calls `layout.detect(lines)` at
   `statement-parser.ts:370-371`; `statementTotalBlocks` calls it again at
   `statement-parser.ts:427`. Each detector looks for a table header:
   - UOB: per page, `HEADER` in `uob.ts` (two-date table), `uob.ts:9-21`.
   - DBS: `DATE DESCRIPTION AMOUNT (S$)`, whole document, `dbs.ts:4,15-19`.
   - PayLah: anchored `^DATE DESCRIPTION AMOUNT$`, whole document,
     `paylah.ts:4,13-17`.
   - Citibank: `DATE DESCRIPTION AMOUNT (SGD)`, whole document,
     `citi.ts:4,28-32`.
   - HSBC: `DATE DATE DESCRIPTION AMOUNT (SGD)` on the joined table text,
     whole document, `hsbc.ts:20,186-190`.

Real overlaps, from the code:

- **PayLah and DBS identity.** PayLah statements name DBS, so the DBS identity
  regex matches them. Today this is handled by `exclude` markers on the DBS
  entry (`STATEMENT DATE ... MOBILE NUMBER ... WALLET ACCOUNT` or `Total Balance
Carried Forward`) and by an `exclude` on the PayLah entry
  (`AMOUNT (S$)`, so a DBS card statement that mentions PayLah! in a merchant
  line is not read as PayLah) (`constants.ts:3-17`). The two `detect`s do not
  overlap: the DBS header requires `(S$)`, the PayLah header is anchored with no
  suffix.
- **Citibank and HSBC detect.** The Citi header regex is not anchored, so it
  matches inside the HSBC header (`DATE DATE DESCRIPTION AMOUNT (SGD)` contains
  `DATE DESCRIPTION AMOUNT (SGD)`). On an HSBC statement both `citiLayout.detect`
  and `hsbcLayout.detect` return every page. The Citi identity regex only
  matches if the text also says Citi or Citibank, so today the manual choice
  hides the overlap; running every detector would expose it.
- **UOB and others.** The UOB identity `\bUOB\b` can match a payment line on any
  other bank's statement, and the DBS, HSBC and Citi identity words can appear in
  payment descriptions. Identity alone is therefore weak evidence; the table
  header from `detect` is the stronger signal.

Other facts the design relies on:

- `STATEMENT_BANKS` has exactly the five banks that `LAYOUTS` registers
  (`statement-layouts/index.ts:9-15`); `LAYOUTS` is typed `Partial<Record<...>>`,
  so a layout-less bank would type-check. None exists today. `StatementBank` is
  `'uob' | 'dbs' | 'hsbc' | 'citibank' | 'paylah'` (`types.ts:3`).
- Text extraction and OCR both happen inside one call,
  `LocalStatementPdf.extract()` (`local-pdf.ts:136-230`; OCR only for pages
  without a text layer, `statement-ocr-items.ts`). `extract()` in
  `statement-review.tsx:275-278` receives the final `StatementLine[]` once, then
  calls `detectStatementPeriod`, then `parseStatementLines(lines, bank, period)`
  (`statement-review.tsx:284-301`). So the lines that detection needs, text or
  OCR, are already in hand at `statement-review.tsx:296`; detection can run there
  with no second OCR pass.
- `lines` is local to `extract()`. `changeBank` (`statement-review.tsx:417-420`)
  calls `reset()`, which destroys the opened PDF and clears rows
  (`statement-review.tsx:206-227`), so today a bank change after extraction means
  re-reading the file, including OCR.
- The bank is not stored as its own column. It is part of the import payload
  validated by `importedExpenseSchema` (`import-expense.ts:38`) and appears in the
  saved source text `Statement source: <bank> · <period>`
  (`import-expense.ts:101`). It also scopes merchant rules
  (`merchant-rules.ts:12-19`) and labels the completion message
  (`import-complete.tsx:33-35`). The payload therefore always needs one concrete
  `StatementBank`; "auto" can never reach the save step.

## Solution shape

### State and types

- New type `StatementBankChoice = StatementBank | 'auto'` next to `StatementBank`
  in `src/features/import-review/types.ts`. `statement-review.tsx` keeps the
  user's choice (`'auto'` by default) and a separate `resolvedBank:
StatementBank | null`. Everything downstream of extraction (save hook, merchant
  rules, row card, completion message) receives `resolvedBank`, never the raw
  choice, so no payload or schema changes.
- The select in `statement-source-form.tsx` gets a first option "Auto-detect"
  (value `auto`) followed by the existing banks. Its prop types change from
  `StatementBank` to `StatementBankChoice`.

### Detection

- New pure module `src/features/import-review/lib/statement-bank-detect.ts`
  exporting `detectStatementBank(lines): BankDetection` with
  `BankDetection = { status: 'match'; bank: StatementBank } | { status: 'none' }
| { status: 'ambiguous'; banks: StatementBank[] }`.
- A bank is a **candidate** when both signals pass on the same lines: its
  `STATEMENT_BANKS` identity matches and its `exclude` does not (the existing
  gate, factored into a shared `matchesStatementIdentity(bank, text)` that
  `parseStatementLines` also calls, so manual and auto paths cannot drift), and
  `getStatementLayout(bank)?.detect(lines).size > 0`. Identity alone or a header
  alone is not enough.
- A new exported `LAYOUT_PRECEDENCE` table in `statement-layouts/index.ts` lists
  declared pairs `{ winner, loser }`: `{ paylah, dbs }` and `{ hsbc, citibank }`.
  After collecting candidates, any candidate that is the `loser` of a pair whose
  `winner` is also a candidate is dropped. Then:
  - one candidate left: `match`;
  - none: `none`;
  - two or more: `ambiguous`. There is no general priority order, so an
    undeclared overlap is never guessed.
- The PayLah/DBS rule is expressed as a pair even though the identity `exclude`
  markers usually separate them already; the pair is the backstop if a layout
  change ever makes both candidates.
- HSBC over Citi is the declared tie-break because the Citi header is a suffix of
  the HSBC header. Making the two gates mutually exclusive instead would mean
  editing `HEADER` in `citi.ts` or `hsbc.ts`, which changes parser behaviour and
  is out of scope (see Alternatives).

### Where it runs in the existing flow

In `extract()` at `statement-review.tsx:296`, right after the period is
settled and before `parseStatementLines`:

1. If the choice is a concrete bank, `resolvedBank = choice`; detection is not
   run and never overrides it.
2. If the choice is `auto`, call `detectStatementBank(lines)`. `lines` is the
   output of `opened.extract()`, so on a scanned PDF it is the OCR result, and
   on a text PDF it is the text-layer result. There is one `extract()` call and
   one OCR pass; detection is a cheap pure function over the returned lines.
3. `match`: set `resolvedBank`, run `parseStatementLines(lines, bank, period)`
   and `statementTotalBlocks(lines, bank)` as today.
4. `none` or `ambiguous`: do not parse and do not guess. Keep `lines` and the
   open PDF, and show a message (wording in Open questions) asking the user to
   choose a bank from the select, then press Extract again.

### Reusing the extracted lines

- Store the extracted `lines`, the settled `period` and `detectedBasis` in a
  ref (`extractedLines`) next to `session` in `statement-review.tsx`, cleared in
  `reset()` and when the file or period changes.
- Changing the bank select after an extraction, or after a `none`/`ambiguous`
  result, re-runs only the parse step on the stored lines: a new
  `reparse(bank)` calls `parseStatementLines` and `statementTotalBlocks` and does
  not call `opened.extract()` again, so OCR is not repeated. It still goes
  through the existing `allowDiscard` guard, because reparsing drops row edits.
  Changing the file or the period still does a full reset and re-extraction.
- The review UI shows the resolved bank near the source form, for example
  "Bank: HSBC (detected)" or "Bank: UOB (chosen by you)". The select stays
  visible as the way to change it.

### Banks without a layout

`STATEMENT_BANKS` has none today. The rule for the future: a `STATEMENT_BANKS`
entry without a registered layout is never an auto-detect candidate (candidate
needs `getStatementLayout`), is still listed as a manual choice, and a manual
choice behaves as today (the identity gate and the generic date-row heuristic in
`parseStatementLines`, `statement-parser.ts:366-400`). A test asserts every
`STATEMENT_BANKS` value that can be auto-detected has a layout, so adding a bank
without one is a conscious decision.

### Copy

- Replace the hint at `statement-source-form.tsx:229-231` with text that matches
  reality, for example: "PDFs up to 10 MiB and 100 pages. Use an unprotected
  PDF. Scanned statements are read on this device and can take longer. Leave the
  bank on Auto-detect or pick it yourself." Final wording is an Open question.
- The catch message at `statement-review.tsx:311-313` says "Check the bank and
  period"; keep it, and make the parser-identity message distinguish the manual
  case ("The selected bank could not be identified in this PDF. Choose a
  different bank or use Auto-detect.").

### Privacy

All of this runs on text that is already in browser memory. No statement text,
detection result or bank guess is sent anywhere new, logged, or stored; the
save payload is unchanged (`§2.1`, `§5.1`). Detection results are not added to
telemetry.

### Alternatives considered

- **Make the identity and header gates mutually exclusive instead of a
  precedence table.** Cleaner in theory (no ordering rule), but it means editing
  the Citi or HSBC `HEADER` regexes, a parser change that needs its own
  real-layout test pass and risks the shipped 181/182 behaviour. Rejected for
  this spec; the precedence table is data, small, and easy to reason about.
- **First match wins in `STATEMENT_BANKS` order.** Simple, but a UOB payment
  line on another bank's statement would make UOB win ahead of the right bank,
  and it silently guesses on any undeclared overlap. Rejected.
- **Score candidates and pick the highest.** More tolerant, but unexplainable to
  the user and untestable without real data. Rejected; this spec prefers asking.
- **Detect from the file name or PDF metadata.** Unreliable and unrelated to the
  content. Rejected.
- **Run detection inside `parseStatementLines` (no new module).** Would mix
  selection with parsing and make the parser's signature depend on `auto`.
  Rejected; the parser keeps taking a concrete bank.
- **Always detect and ignore the select.** Rejected: a manual choice must always
  win, and it is the fallback when a statement matches nothing.

## Out of scope

- New bank layouts, new `StatementBank` values, or changes to any layout's row
  parsing, totals or `columns`.
- Statements that combine several banks in one PDF; one PDF is one bank.
- Parser changes beyond calling the shared identity helper and the new
  precedence data; no regex edits in `constants.ts` or the layouts.
- Persisting the detected bank anywhere new, server changes, schema or
  migration changes, new dependencies, telemetry.
- Remembering the last manual choice across sessions (see Open questions).
- Any change to OCR, period detection, row review or save behaviour.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` and
      `pnpm build` green.
- [ ] The bank select defaults to "Auto-detect"; every existing bank is still
      selectable and a concrete choice behaves exactly as before.
- [ ] With Auto-detect, a synthetic statement for each of UOB, DBS, PayLah, HSBC
      and Citibank resolves to that bank and produces the same candidates and
      totals as choosing that bank manually.
- [ ] PayLah wins over DBS and HSBC wins over Citibank on the overlap fixtures;
      an undeclared overlap returns `ambiguous` and does not parse.
- [ ] A statement that matches no bank leaves rows empty, shows the choose-a-bank
      message, and does not throw an unhandled error.
- [ ] A manual choice is never replaced by detection, even when detection would
      pick another bank.
- [ ] For a scanned (OCR) statement, detection runs on the OCR lines and the OCR
      recogniser is invoked once per page for the whole flow, including after the
      user changes the bank following a `none` result.
- [ ] The review UI shows the resolved bank and whether it was detected or
      chosen; the bank select is still usable to change it.
- [ ] Save payloads, merchant-rule scoping and the completion label use the
      resolved bank; `bank: 'auto'` cannot reach `importedExpenseSchema`.
- [ ] The stale hint text is gone and the new copy renders.
- [ ] No new dependency; no change under `src/app/api`, server actions, or
      `supabase/`.
- [ ] Manual: import a real statement of each bank on Auto-detect and confirm
      the detected label; confirm nothing is sent over the network beyond the
      existing save call. Not part of the automated gates and uses the owner's
      own files only.
- [ ] Spec hash matches at impl PR time.

## Test plan

Synthetic fixtures only, built in the test files as arrays of `StatementLine`
like the existing layout tests (`test/features/profile/statement-layouts-*.test.ts`);
no real names, card numbers, addresses or amounts.

- `statement-bank-detect.test.ts` (pure unit tests):
  - one fixture per bank (UOB, DBS, PayLah, HSBC, Citibank) resolves to that
    bank;
  - overlap case 1: a PayLah-shaped fixture containing DBS wording resolves to
    PayLah, not DBS and not ambiguous;
  - overlap case 2: an HSBC `DATE DATE DESCRIPTION AMOUNT (SGD)` fixture that
    also contains the word Citibank in a payment line (both candidates) resolves
    to HSBC; a plain Citi fixture still resolves to Citibank;
  - identity-only and header-only fixtures are not candidates (UOB word in a
    payment line of another bank's statement does not make UOB a candidate);
  - empty or unrelated lines return `none`;
  - an undeclared two-bank overlap returns `ambiguous` with both banks;
  - every auto-detectable `STATEMENT_BANKS` value has a registered layout.
- `statement-parser.test.ts`: `parseStatementLines` keeps throwing for a wrong
  manual bank; the shared identity helper gives the same results as the old
  inline check for each existing fixture.
- `statement-source-form.test.tsx`: Auto-detect option exists and is the
  default; picking a bank calls `onBankChange` with that bank; new hint text.
- `statement-review.test.tsx`: Auto-detect with each bank's fixture shows the
  "detected" label and rows; a no-match PDF shows the choose-a-bank message and
  no rows; choosing a bank after the message parses the stored lines; a manual
  bank on a statement that detection would assign elsewhere keeps the manual
  bank (or shows the existing identity error, as today) and never switches.
- OCR path in `statement-review.test.tsx`, using the existing fake recogniser
  seam (see `statement-ocr.test.ts`): a scanned HSBC fixture on Auto-detect
  resolves to HSBC, and the fake recogniser's call count does not increase when
  the user changes the bank afterwards.

## Risk & reversibility

- **Blast radius**: the statement import dialog only. Manual selection keeps
  today's code path, so existing users who pick a bank are unaffected. A wrong
  auto-detect would route a statement to the wrong layout; the identity gate,
  the per-layout header requirement, the existing row review and the
  statement-total check still apply, and the resolved bank is shown so the user
  can see and change it before saving.
- **Risks**: (1) a new overlap appears when a layout's header regex changes;
  mitigated by `ambiguous` instead of guessing and by the overlap tests.
  (2) The Auto-detect default changes what first-time use looks like; users who
  relied on the UOB default see one extra step only when detection fails.
  (3) Keeping `lines` in a ref holds statement text in memory slightly longer
  than today; it is cleared by `reset()`, on file or period change, and on
  unmount, and is no longer than the already-retained `LocalStatementPdf`
  session.
- **Reversibility**: a single `git revert`; no data, migration or server state.
- **Backout plan**: revert the implementation commit(s); the select returns to
  the five banks with UOB default.

## Suggested implementation slices

1. **Detection core (no UI).** Add `lib/statement-bank-detect.ts` and its tests,
   the `LAYOUT_PRECEDENCE` export in `statement-layouts/index.ts`, the shared
   `matchesStatementIdentity` helper used by `parseStatementLines` in
   `statement-parser.ts`, and the `StatementBankChoice` type in `types.ts`. Tests:
   `statement-bank-detect.test.ts`, additions to `statement-parser.test.ts`.
2. **UI and flow.** `statement-source-form.tsx` (Auto-detect option, new hint),
   `statement-review.tsx` (choice vs `resolvedBank`, stored lines, `reparse`,
   detected label, no-match message), plus `statement-source-form.test.tsx` and
   `statement-review.test.tsx`. Depends on slice 1; touches no server code.

## Open questions

- [ ] Q: Should the app remember the last manual bank choice and use it as the
      starting select value (instead of always starting on Auto-detect)? Saved
      in `localStorage` it would only be a convenience, but it adds state and
      could pin a wrong bank across statements. Default proposed: no, always
      start on Auto-detect. — Owner: Clarence — A:
- [ ] Q: Wording of the detected-bank label and the no-match message. Proposed:
      "Detected: HSBC" / "Chosen: HSBC", and "We could not tell which bank this
      statement is from. Choose the bank above, then extract again." — Owner:
      Clarence — A:
- [ ] Q: On an `ambiguous` result, is "choose the bank" enough, or should the
      message name the candidate banks (for example "This looks like DBS or
      Citibank")? Proposed: name them, since it narrows the choice. — Owner:
      Clarence — A:
- [ ] Q: When a manual bank is chosen but detection (run for information only)
      would pick a different bank, should the UI show a non-blocking warning?
      Proposed: no, keep a manual choice silent, as it is today. — Owner:
      Clarence — A:
