---
id: '157'
slug: merchant-rule-starts-with
area: feature
status: approved
author: Claude Code
created: 2026-10-30
approved: 2026-10-30
shipped:
impl_pr: direct commit to main (no PR)
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.6'
  - '§2.7'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.4'
constitution_overrides: []
---

# Spec 157: Merchant rule "Starts with word" match mode

## Problem

A merchant rule with text "mcdonald" and mode "Contains these words" does not
match statement lines such as "MCDONALDS" or "MCDONALD'S". The rule needs the
pattern to sit between non-word characters on both sides
(`phraseMatches` in `src/features/merchant-rules/lib/matching.ts`, L18-L28), so
"mcdonald" followed by "s" fails. `normalizeMerchant` (L4-L11) keeps
apostrophes, so "mcdonald's" also splits the word. The owner has to add one
rule per spelling. The "Exact text" mode is no help either.

## Constitution check

- Satisfies: `§2.1` and `§2.3` (the rulebook is already an encrypted payload
  read through the existing actions; no new data path), `§2.2` (no new mutation
  surface; saves go through the existing rulebook action), `§2.6` and `§2.7`
  (barrel and named exports unchanged), `§3.2` (no `any`, no inline styles, mode
  labels live in `constants.ts`), `§3.4`, `§4.1`, `§4.4`, `§4.2` (tests for the
  new matching logic and schema).
- Overrides: none. No migration: the rulebook is an encrypted payload, not a
  column, and the payload `schemaVersion` stays `1`.

## Solution shape

- `src/features/merchant-rules/constants.ts`: change `MERCHANT_MATCH_MODES` to
  `['exact', 'phrase', 'starts'] as const`. Add `MERCHANT_MATCH_MODE_LABELS`
  (`exact: 'Exact text'`, `phrase: 'Contains these words'`,
  `starts: 'Starts with word'`) so the select options and the list label read
  from one place instead of two inline ternaries.
- `src/features/merchant-rules/schemas.ts` L26: `z.enum(MERCHANT_MATCH_MODES)`
  already follows the constant, so the schema accepts `starts` with no other
  change. `schemaVersion: z.literal(1)` (L50) is untouched. Old payloads contain
  only `exact` and `phrase`, so they still parse. A payload that contains
  `starts` will not parse in an older deployed build; this is a single-owner app
  that deploys `main` only, so that is accepted (see Risk).
- `src/features/merchant-rules/lib/matching.ts`:
  - Add a pure `normalizeForWordPrefix(value)`: `normalizeMerchant`, then
    delete apostrophes (`'`, `’`, `‘`, `ʼ`), then replace every run of
    characters that are not `\p{L}\p{M}\p{N}` with one space, then trim. Split
    on a space into words.
  - Add `startsWithWordMatches(source, pattern)`. Both sides go through
    `normalizeForWordPrefix`. Return false when the pattern has no words. For a
    pattern of N words, scan the source words for an index `i` where words
    `i..i+N-2` equal the first N-1 pattern words exactly and word `i+N-1` starts
    with the last pattern word. Single-word pattern: some word starts with it.
    Plain string `startsWith` and equality only. No user-supplied regular
    expression is built, so there is no ReDoS surface.
  - In `matchMerchantRules`, keep the existing guard
    `!pattern || !/[\p{L}\p{N}]/u.test(pattern)` and dispatch on `matchMode`:
    `exact` and `phrase` unchanged, `starts` via the new function.
  - Tier selection becomes ordered: `exact`, then `phrase`, then `starts`. Take
    the first tier that has any match; `winners` are the rules in that tier
    only. Conflict detection (different `displayName` or `category`) stays
    within the winning tier. The returned `tier` is typed through
    `MerchantRule['matchMode']` in `types.ts`, which widens automatically.
- `src/features/merchant-rules/components/merchant-rule-manager.tsx`:
  - L220: replace `rule.matchMode === 'exact' ? 'Exact' : 'Phrase'` with a short
    label lookup (`Exact`, `Phrase`, `Starts with`).
  - L349-L364: the select `onChange` coerces to `exact` or `phrase` only.
    Replace it with a type guard over `MERCHANT_MATCH_MODES`, and render the
    options from the constant so "Starts with word" appears.
  - Add one line of helper text under the select explaining that "Starts with
    word" matches "mcdonald" in "MCDONALDS" and "McDonald's".
- The implementer greps `src/features/merchant-rules` and `import-review` for
  any other `matchMode` or `tier` consumer (for example
  `merchant-suggestion.tsx`) and updates it only if it branches on the mode.
- No server action, migration or encryption change. The rulebook still passes
  through `encryptPayload` in the existing action.

## Out of scope

- User-written regular expressions or wildcards.
- Changing "Exact" or "Contains" behaviour, including their apostrophe handling.
- An "ends with" mode.
- Re-running rules over expenses that are already saved.
- Bumping `schemaVersion`.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests in
      `test/features/merchant-rules/matching.test.ts` and `schemas.test.ts`:
      "mcdonald" (starts) matches "MCDONALDS", "MCDONALD'S", "McDonald's
      Orchard" and "MCDONALD’S" (curly apostrophe); does not match "XMCDONALD";
      a two-word pattern "grab food" matches "GRAB FOODS SG" and not "GRAB TAXI
      FOOD" or "GRABFOOD"; punctuation-only and empty patterns do not match;
      tier priority exact > phrase > starts in either rule order (an `exact`
      rule beats a conflicting `starts` rule, a `phrase` rule beats a
      conflicting `starts` rule); two `starts` rules with different outputs give
      `status: 'conflict'` with `tier: 'starts'`; a payload with only `exact`
      and `phrase` rules and `schemaVersion: 1` still parses, and one with
      `starts` also parses; an unknown mode is still rejected
- [ ] `test/features/merchant-rules/merchant-rule-manager.test.tsx`: the select
      offers "Starts with word", saving a draft with it keeps `starts`, and the
      saved rule is listed with the "Starts with" label
- [ ] `pnpm build` green
- [ ] Manual: add a "Starts with word" rule "mcdonald" and import a statement
      containing "MCDONALDS"; the suggestion appears

## Risk & reversibility

- **Blast radius**: merchant suggestions during statement import. A broad
  prefix such as "mc" would match many merchants; the rule is the owner's own
  and only suggests, it never saves silently.
- **Reversibility**: code is a single `git revert`. Once a `starts` rule is
  saved in the encrypted rulebook, reverting the code leaves a payload the older
  schema rejects.
- **Backout plan**: before reverting, change any `starts` rules to "Contains
  these words" in the manager and save, then revert the commit.

## Open questions

- [ ] Q: Should "Starts with word" also join hyphenated or dotted tokens (so
      "E-GRAB" matches "egrab")? Proposed answer: no, treat them as spaces, same
      as other punctuation. — Owner: Clarence — A: No. Hyphens and dots split words like other punctuation ("grab" matches "E-GRAB").
