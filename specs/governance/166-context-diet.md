---
id: '166'
slug: context-diet
area: governance
status: draft # draft | approved | shipped | superseded
author: Claude (Sonnet 5.5)
approved_by:
created: 2026-11-02
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§7.1'
  - '§7.4'
constitution_overrides: []
---

# Spec 166: AGENTS.md context diet

## Problem

`AGENTS.md` is 336 lines and loads into every agent session through
`CLAUDE.md` (`@AGENTS.md`). Much of it is dated history (§12 Project Notes),
a directory tour and key-files table that an agent can recover with grep and
glob, a hook table that duplicates `.claude/settings.json`, and generic
framework conventions that current models already follow. Several rules also
overlap with `CONSTITUTION.md` and the owner's global rules. Anthropic's
guidance for Claude 5 generation models says this kind of overlapping,
history-laden instruction text over-constrains the model and costs context on
every turn without improving results.

## Sources

Both retrieved 2026-11-02 and summarized from the builder's brief; the owner is
asked to confirm them (Open questions).

1. Thariq Shihipar, "The new rules of context engineering for Claude 5
   generation models", claude.com blog, 2026-07-24,
   https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models
   . Reported: Anthropic removed most of Claude Code's own system prompt
   (over 80 percent) with no measurable loss on coding evals, and attributed
   earlier problems to over-constraint from overlapping or conflicting
   instructions. Suggested `CLAUDE.md` practice: keep it lightweight, say what
   the repo is for, spend tokens on gotchas, avoid the obvious, reference a
   verification skill, and use `/doctor` to rightsize.
2. "Steering Claude Code: skills, hooks, rules, subagents and more",
   https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more
   . Reported: keep `CLAUDE.md` under about 200 lines; "always do Y" belongs in
   hooks and "never do X" needs hooks or permissions; area conventions suit
   path-scoped `.claude/rules/`; skills cost only name and description until
   invoked.

## Constitution check

- Satisfies: `§7.1` (this spec is the governance spec that an `AGENTS.md`
  amendment requires, with explicit owner permission before the edit) and
  `§7.4` (a documentation-only amendment is reviewed by formatting and diff).
- Overrides: none. No `HARD` rule in `CONSTITUTION.md` is touched, and
  `CONSTITUTION.md` itself is not edited. `AGENTS.md` §8 requires a
  `governance/` spec and explicit owner permission before editing; this spec is
  the request for that permission.

## Solution shape

Edit `AGENTS.md` only, after approval, to fewer than 200 lines. Safety and
approval rules are kept; history, repo-inferable description and generic
convention are cut. Current line counts are measured on the file (`wc -l` =
336); targets include blank lines and headings.

| Section                                               |     Now | Action   |  Target | What remains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------: | -------- | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preamble (marker, title, audience, authority, entry)  |      12 | condense |       8 | The templateCentral marker comment on line 1, authority order, "read before acting", `CLAUDE.md` re-export. Audience list shortened to "any AI coding agent".                                                                                                                                                                                                                                                                                                                                                                            |
| §0 Hard stops                                         |      16 | keep     |      16 | Verbatim, 16 lines: all five stops, the permission-protected file list, the §0.3 standing exemption paragraph, the "Stopping looks like" paragraph and the "use permission already given" paragraph.                                                                                                                                                                                                                                                                                                                                     |
| §1 Workflow (1.1 to 1.5)                              |      44 | condense |      32 | Receive task, spec-first (template, branch names, stop for approval), implementation (branch, scope, gates, PR title and body), closing frontmatter update. §1.5 keeps its approval boundaries in full (see Safety invariance); only its inventory and review detail is shortened, with a pointer to `CONSTITUTION.md` §7.4.                                                                                                                                                                                                             |
| §2 Project facts (stack, layout, key files, env)      |      60 | condense |      20 | Two-line purpose and stack. Layout tree deleted. Key-files table cut to entries with a non-obvious gotcha: `keystore.ts`, `client-crypto.ts`, `crypto-constants.ts`, `api/vault/route.ts`, `proxy.ts`. Retained rules, not only rows: PIN to DEK derivation is client-only (`client-crypto.ts`); `crypto-constants.ts` keeps server and client derivation in lock-step. Env names kept: `SESSION_SECRET` is 32 bytes (`openssl rand -base64 32`); `ADMIN_EMAILS` unset means the admin page 404s for everyone (fails closed). No values. |
| §3 Quality gates                                      |      22 | condense |      10 | The five `pnpm` gates as one short list, the spec and constitution linkage items, the no-`any` / no-`console.log` / no-suppression / no-new-dependency items, and a pointer to `/next-verify`.                                                                                                                                                                                                                                                                                                                                           |
| §4 Style and architecture rules                       |      23 | condense |      20 | Delete generic style (named exports, Tailwind only, naming). Keep one compact line each for: Server Components by default and justify `'use client'`; no data-fetching in page components; React Query hooks live in `features/<name>/hooks/`; barrel imports from the feature index; server actions not API routes; `requireUserId()` then `getVaultDekSession()` before DB access; Zod at the boundary with `z.flattenError()` for client-facing 400s; no Supabase or Postgres text in errors.                                         |
| §5 Investigation before code                          |      16 | condense |       6 | Read-only actions allowed without a spec; ordinary edits need a spec or audit record; reading secrets prohibited even when investigating; branch deletion and force push prohibited.                                                                                                                                                                                                                                                                                                                                                     |
| §6 Multi-agent etiquette (Hermes fleet)               |      11 | condense |       4 | Kept by default. Sub-agent output goes to atlas; sub-agents do not message Clarence directly unless escalating; reviewers do not approve their own PR; coder agents iterate on gate failures without escalating unless a §0 trigger fires. Deleted only if the owner answers Open question 1 with "fleet retired".                                                                                                                                                                                                                       |
| §7 Drift and corrections                              |       9 | condense |       4 | Small in-scope drift fixed and noted in the PR; out-of-scope drift goes to a proposed spec.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| §8 Amendment of this file                             |       9 | condense |       6 | Governance spec plus explicit owner permission; conversational permission recorded with date and scope; agents cannot approve their own amendments; §0.3 exemption reference.                                                                                                                                                                                                                                                                                                                                                            |
| §9 Skills (project, plugin, scoping, deviations, use) |      50 | condense |      22 | Project skill table (`/next-verify`, `/regen-harness`). Plugin skill table collapsed to one line. "Fynfo deviations from templateCentral defaults" kept in full (load-bearing). Scoping priority and audit-use paragraphs reduced to one sentence each.                                                                                                                                                                                                                                                                                  |
| §10 Skills security                                   |       9 | condense |       7 | Review third-party `SKILL.md`, minimal `allowed-tools`, reject secret or network access, protected-path permission note.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| §11 AI Harness (hook table, manifest, policy notes)   |      30 | condense |      10 | One-line pointer to `.claude/settings.json` and `.claude/hooks/` for what each hook does. Kept: policy and enforcement are separate; hooks never grant bypass; manifest drift is reported, not rehashed silently. The LF-versus-raw-bytes hash note (spec 065) and the `templatecentral_version` 5.0.0 note stay only if Open question 3 keeps them; if they are removed the target drops to 7.                                                                                                                                          |
| §12 Project Notes (dated changelog)                   |      25 | delete   |       0 | Git history and `specs/` record every entry. Live gotchas (the `harness.json` 5.0.0 note) are handled in §11 per Open question 3, not kept here.                                                                                                                                                                                                                                                                                                                                                                                         |
| Spacing between kept sections                         |       0 | n/a      |      12 | Allowance for blank lines and separators.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Total**                                             | **336** |          | **177** | Both under the 200-line ceiling with margin; if Open question 3 removes the §11 notes the total is 174, and if Open question 1 deletes §6 it drops by 4 more.                                                                                                                                                                                                                                                                                                                                                                            |

Current counts reconcile: 12, 16, 44, 60, 22, 23, 16, 11, 9, 9, 50, 9, 30 and
25 sum to 336. Target counts, in the same order with the spacing allowance
last, are 8, 16, 32, 20, 10, 20, 6, 4, 4, 6, 22, 7, 10, 0 and 12, which sum to 177.

Moves to path-scoped `.claude/rules/*.md` are not proposed in this spec. Most
of what is cut is already enforced by lint and typecheck (named exports, naming,
`unknown` over `any`), recoverable by grep and glob (the layout tree and most of
the key-files table), recorded in git and `specs/` (§12), or duplicated in
`.claude/settings.json` (the hook table). If the owner wants a rule file later
(for example for crypto code under `src/lib/`), that is a separate owner-applied
step because `.claude/**` is permission-protected.

## Rationale

- Source 1 reports no measurable loss after removing most of a system prompt,
  and attributes earlier problems to overlapping and conflicting instructions.
  `AGENTS.md` overlaps `CONSTITUTION.md` (authority order, quality gates,
  secrets) and the owner's global rules; the cut removes the duplicate
  statements and keeps one authoritative location for each.
- Source 1 says to spend tokens on gotchas and avoid the obvious. The directory
  tree, most of the key-files table and generic style rules are obvious or
  recoverable with grep; the retained entries are the ones a model would get
  wrong without being told (DEK derivation is client-only, `requireUserId()`
  ordering, opaque errors, fail-closed admin gate).
- Source 2 sets about 200 lines as the ceiling and says "never do X" needs hooks
  or permissions. Fynfo already has hooks for that (§11); the prose stays as the
  stated policy, and the long hook table is replaced by a pointer so it cannot
  drift from `.claude/settings.json`.
- Dated notes (§12) are history, not instruction. They cost about 25 lines per
  session and change no agent behavior.

## Safety invariance

No rule is weakened. Each hard rule and where it lives after the cut:

| Rule                                                                                                                                     | Location after the cut                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| §0 item 1: no implementation without an approved spec or §7.4 audit scope                                                                | `AGENTS.md` §0 item 1, §1; `CONSTITUTION.md` §7                                                    |
| §0 item 2: no violation of a `HARD` constitution rule                                                                                    | `AGENTS.md` §0 item 2; `CONSTITUTION.md`                                                           |
| §0 item 3: no real secret env files, private keys, credentials or live vault secrets                                                     | `AGENTS.md` §0 item 3 verbatim; `guard-protected-paths.mjs`, `guard-destructive-bash.mjs`          |
| §0 item 3: no destructive migrations                                                                                                     | `AGENTS.md` §0 item 3 verbatim; `CONSTITUTION.md` §8.2                                             |
| §0 item 3: permission-protected file list                                                                                                | `AGENTS.md` §0 item 3 verbatim; `guard-protected-paths.mjs`                                        |
| §0 item 3: draft governance specs need owner approval before commit                                                                      | `AGENTS.md` §0 item 3 verbatim                                                                     |
| §0 item 3: `.env.example` editable with placeholders only                                                                                | `AGENTS.md` §0 item 3 verbatim                                                                     |
| §0 item 3: exclude secret contents from searches, tool output and audit tooling                                                          | `AGENTS.md` §0 item 3 verbatim                                                                     |
| §0 item 3: never bypass an active hook or tool denial                                                                                    | `AGENTS.md` §0 item 3 verbatim, §11                                                                |
| §0 item 4: no new dependency without approval                                                                                            | `AGENTS.md` §0 item 4, §3                                                                          |
| §0 item 5: confidence threshold, research before editing                                                                                 | `AGENTS.md` §0 item 5                                                                              |
| §0.3 exemption: templateCentral v4 alignment edits are the only pre-authorized bounded case                                              | `AGENTS.md` §0 exemption paragraph verbatim; further changes still need a `specs/governance/` spec |
| §0 "Stopping looks like" and "use permission already given" paragraphs                                                                   | `AGENTS.md` §0 verbatim                                                                            |
| §1.2: spec-first with a stop until `status: approved`                                                                                    | `AGENTS.md` §1.2                                                                                   |
| §1.5: record owner request and scope in `specs/`                                                                                         | `AGENTS.md` §1.5                                                                                   |
| §1.5: do not claim approval of findings the owner has not reviewed                                                                       | `AGENTS.md` §1.5                                                                                   |
| §1.5: never read secret files                                                                                                            | `AGENTS.md` §1.5, §0 item 3                                                                        |
| §1.5: separate approval still required for §0 protected operations, new dependencies or features, migrations and crypto protocol changes | `AGENTS.md` §1.5, §0                                                                               |
| §1.5: do not rewrite prior approvals                                                                                                     | `AGENTS.md` §1.5                                                                                   |
| §1.5: do not mark work shipped until merged                                                                                              | `AGENTS.md` §1.5, §1.4                                                                             |
| §3: quality gates before review                                                                                                          | `AGENTS.md` §3; `/next-verify`; CI                                                                 |
| §5: reading secret contents prohibited during investigation                                                                              | `AGENTS.md` §5, §0 item 3                                                                          |
| §5: branch deletion and force push prohibited                                                                                            | `AGENTS.md` §5; `guard-destructive-bash.mjs`; `CONSTITUTION.md` §8.2                               |
| §6: reviewer agents do not approve their own PR                                                                                          | `AGENTS.md` §6 (kept, about 4 lines)                                                               |
| §6: coder agents iterate on gate failures without escalating unless a §0 trigger fires                                                   | `AGENTS.md` §6                                                                                     |
| §6: sub-agents do not message Clarence directly unless escalating                                                                        | `AGENTS.md` §6                                                                                     |
| §8: amendments need a governance spec and owner permission                                                                               | `AGENTS.md` §8; `CONSTITUTION.md` §7.1                                                             |
| §10: skills vetted before install, minimal `allowed-tools`                                                                               | `AGENTS.md` §10                                                                                    |
| §4: error responses never leak Supabase or Postgres text                                                                                 | `AGENTS.md` architecture rules                                                                     |
| §2: PIN to DEK derivation is client-only; `crypto-constants.ts` keeps server and client in lock-step                                     | `AGENTS.md` §2 as explicit rules, plus key-files rows                                              |

If the owner answers Open question 1 with "fleet retired", the three §6 rows
are removed from this table deliberately and `AGENTS.md` §6 is deleted. Rules
enforced by a hook are still stated in prose, because the prose is the policy
and the hook is the mechanism.

## Implementation steps after approval

1. A builder edits `AGENTS.md` per the table on branch `impl/166-context-diet`.
   Only `AGENTS.md` changes; no other file.
2. Owner step: run `/regen-harness` to refresh the `AGENTS.md` hash in
   `.claude/harness.json`. The platform self-modification check blocks agent
   commits of `.claude/**`, so the owner applies it. The builder reports the
   expected drift instead of rehashing.
3. Gates for a documentation-only change under `CONSTITUTION.md` §7.4:
   `pnpm format:check` and a diff review of every removed line against the
   safety invariance table.
4. `/context` is an interactive command that an implementing builder cannot
   run. The owner records the memory-files token figure in this spec before the
   `AGENTS.md` edit lands (before) and again once it has landed (after).
   - Before: not yet measured.
   - After: not yet measured.
5. Rollback: `git revert` of the impl commit restores the previous file; then
   the owner reruns `/regen-harness`.

## Out of scope

- Editing `CONSTITUTION.md`, `CLAUDE.md`, `.claude/**`, `.github/**`.
- Creating `.claude/rules/*.md` files or changing skills.
- Changing any hook, permission or enforcement behavior.
- Any change to application code, tests or dependencies.

## Acceptance

- [ ] `wc -l AGENTS.md` is below 200, checked again after `prettier --write`.
- [ ] Line 1 templateCentral marker comment unchanged.
- [ ] §0 preserved verbatim (16 lines), including the §0.3 exemption, "Stopping
      looks like" and "use permission already given" paragraphs, and the
      permission-protected file list.
- [ ] Every row of the safety invariance table can be located in the edited
      file.
- [ ] `pnpm format:check` green.
- [ ] Diff reviewed by the owner; harness hash drift for `AGENTS.md` reported
      to the owner.
- [ ] `/context` token counts before and after recorded in this spec by the
      owner.

## Risk & reversibility

- **Blast radius**: agent behavior in every future session. The risk is that a
  rule cut as obvious turns out to have been load-bearing.
- **Reversibility**: documentation only; a single `git revert` restores the
  file. The harness hash needs a matching owner rerun of `/regen-harness`.
- **Backout plan**: revert the impl commit, rerun `/regen-harness`. A cut rule
  that proves necessary can be restored individually in a follow-up spec.

## Open questions

- [ ] Q1: Is the Hermes fleet (atlas, heph, argus) still in use? Default is to
      keep §6 at about 4 lines; it is deleted only if the answer is "fleet
      retired". — Owner: Clarence — A:
- [ ] Q2: Is the §0 exemption paragraph correct to keep verbatim (this spec
      assumes yes, with §0 unchanged at 16 lines)? — Owner: Clarence — A:
- [ ] Q3: Should the LF-versus-raw-bytes hashing note and the `harness.json`
      `templatecentral_version` 5.0.0 note stay in `AGENTS.md` §11, or move to
      a spec or issue now that they matter only to the owner? — Owner:
      Clarence — A:
- [ ] Q4: Should a path-scoped `.claude/rules/` file for crypto code be created
      as a separate owner-applied step, or are the retained rules enough? —
      Owner: Clarence — A:
- [ ] Q5: Please confirm the two cited sources and the paraphrased claims, which
      were taken from the brief and not independently re-fetched by the author.
      — Owner: Clarence — A:
