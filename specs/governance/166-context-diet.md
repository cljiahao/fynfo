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

1. Thariq Shihipar, "The new rules of context engineering for Claude 5
   generation models", claude.com blog, 2026-07-24:
   https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models.
   Anthropic removed over 80 percent of Claude Code's own system prompt with
   no measurable loss on coding evals; the cause of the earlier regressions was
   over-constraint from overlapping and conflicting instructions. Guidance for
   `CLAUDE.md`: keep it lightweight, say what the repo is for, spend tokens on
   gotchas, avoid the obvious, reference a verification skill, and use
   `/doctor` to rightsize.
2. "Steering Claude Code", claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more:
   keep `CLAUDE.md` under 200 lines; "always do Y" belongs in hooks and "never
   do X" needs hooks or permissions; area conventions go in path-scoped
   `.claude/rules/`; skills cost only name and description until invoked.

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

| Section                                               |     Now | Action   |  Target | What remains                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------: | -------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preamble (marker, title, audience, authority, entry)  |      12 | condense |       8 | The templateCentral marker comment on line 1, authority order, "read before acting", `CLAUDE.md` re-export. Audience list shortened to "any AI coding agent".                                                                                                                                    |
| §0 Hard stops (including §0.3 exemption)              |      16 | keep     |      16 | All five stops and the permission-protected file list unchanged. The §0.3 exemption is kept in a faithful condensed form (see Open questions).                                                                                                                                                   |
| §1 Workflow (1.1 to 1.5)                              |      44 | condense |      28 | Receive task, spec-first (template, branch names, stop for approval), implementation (branch, scope, gates, PR title and body), closing frontmatter update. §1.5 audit path reduced to its six steps in one line each, pointing to `CONSTITUTION.md` §7.4 for detail.                            |
| §2 Project facts (stack, layout, key files, env)      |      60 | condense |      18 | Two-line purpose and stack. Layout tree deleted. Key-files table cut to entries with a non-obvious gotcha: `keystore.ts`, `client-crypto.ts`, `crypto-constants.ts`, `api/vault/route.ts`, `proxy.ts`. Required env var names kept, no values.                                                   |
| §3 Quality gates                                      |      22 | condense |      10 | The five `pnpm` gates as one short list, the spec and constitution linkage items, the no-`any` / no-`console.log` / no-suppression / no-new-dependency items, and a pointer to `/next-verify`.                                                                                                   |
| §4 Style and architecture rules                       |      23 | condense |      16 | Delete generic style (named exports, Tailwind only, naming, `unknown` over `any`: the model and lint already enforce these). Keep Fynfo gotchas: server actions not API routes, `requireUserId()` then `getVaultDekSession()` before DB access, Zod at the boundary, no Supabase text in errors. |
| §5 Investigation before code                          |      16 | condense |       6 | Read-only actions allowed without a spec; ordinary edits need a spec or audit record; reading secrets prohibited even when investigating; branch deletion and force push prohibited.                                                                                                             |
| §6 Multi-agent etiquette (Hermes fleet)               |      11 | delete   |       0 | Pending Open question 1. If the fleet is still used, keep as 4 lines.                                                                                                                                                                                                                            |
| §7 Drift and corrections                              |       9 | condense |       4 | Small in-scope drift fixed and noted in the PR; out-of-scope drift goes to a proposed spec.                                                                                                                                                                                                      |
| §8 Amendment of this file                             |       9 | condense |       6 | Governance spec plus explicit owner permission; conversational permission recorded with date and scope; agents cannot approve their own amendments; §0.3 exemption reference.                                                                                                                    |
| §9 Skills (project, plugin, scoping, deviations, use) |      50 | condense |      22 | Project skill table (`/next-verify`, `/regen-harness`). Plugin skill table collapsed to one line. "Fynfo deviations from templateCentral defaults" kept in full (load-bearing). Scoping priority and audit-use paragraphs reduced to one sentence each.                                          |
| §10 Skills security                                   |       9 | keep     |       7 | Review third-party `SKILL.md`, minimal `allowed-tools`, reject secret or network access, protected-path permission note.                                                                                                                                                                         |
| §11 AI Harness (hook table, manifest, policy notes)   |      30 | condense |      10 | One-line pointer to `.claude/settings.json` and `.claude/hooks/` for what each hook does. Kept: policy and enforcement are separate; hooks never grant bypass; the LF-versus-raw-bytes hash difference (spec 065) while unresolved; manifest drift is reported, not rehashed silently.           |
| §12 Project Notes (dated changelog)                   |      25 | delete   |       0 | Git history and `specs/` already record every entry. Any note that is still a live gotcha (for example `harness.json` records `templatecentral_version` 5.0.0 because the `regen-harness` skill hardcodes it) is folded into §11.                                                                |
| Spacing between kept sections                         |       0 | n/a      |      12 | Allowance for blank lines and separators.                                                                                                                                                                                                                                                        |
| **Total**                                             | **336** |          | **163** | With §6 kept the total is 167. Both are under the 200-line ceiling with margin.                                                                                                                                                                                                                  |

Current counts reconcile: 12 + 16 + 44 + 60 + 22 + 23 + 16 + 11 + 9 + 9 + 50 +
9 + 30 + 25 = 336. Target sum: 8 + 16 + 28 + 18 + 10 + 16 + 6 + 0 + 4 + 6 + 22

- 7 + 10 + 0 + 12 = 163.

Moves to path-scoped `.claude/rules/*.md` are not proposed in this spec.
Everything cut is either already enforced by lint and typecheck, repo-inferable,
or recorded in git and specs, so there is nothing worth relocating. If the owner
wants a rule file later (for example for crypto code under `src/lib/`), that is
a separate owner-applied step because `.claude/**` is permission-protected.

## Rationale

- Source 1 reports no measurable loss after removing over 80 percent of a
  system prompt, and attributes earlier problems to overlapping and conflicting
  instructions. `AGENTS.md` overlaps `CONSTITUTION.md` (authority order,
  quality gates, secrets) and the owner's global rules; the cut removes the
  duplicate statements and keeps one authoritative location for each.
- Source 1 says to spend tokens on gotchas and avoid the obvious. The directory
  tree, most of the key-files table and generic style rules are obvious or
  recoverable with grep; the retained entries are the ones a model would get
  wrong without being told (DEK derivation is client-only, `requireUserId()`
  ordering, opaque errors).
- Source 2 sets 200 lines as the ceiling and says "never do X" needs hooks or
  permissions. Fynfo already has hooks for that (§11); the prose stays as the
  stated policy, and the long hook table is replaced by a pointer so it cannot
  drift from `.claude/settings.json`.
- Dated notes (§12) are history, not instruction. They cost about 25 lines per
  session and change no agent behavior.

## Safety invariance

No rule is weakened. Each hard rule and where it lives after the cut:

| Rule                                                                              | Location after the cut                                                                                                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No implementation without an approved spec or §7.4 audit scope (§0.1)             | `AGENTS.md` §0.1, §1; `CONSTITUTION.md` §7                                                                                                                |
| No violation of a `HARD` constitution rule (§0.2)                                 | `AGENTS.md` §0.2; `CONSTITUTION.md`                                                                                                                       |
| No secret, key, credential or live vault access; no destructive migrations (§0.3) | `AGENTS.md` §0.3 in full, including the permission-protected file list; `guard-protected-paths.mjs`, `guard-destructive-bash.mjs`; `CONSTITUTION.md` §8.2 |
| Never bypass an active hook or tool denial (§0.3)                                 | `AGENTS.md` §0.3, §11                                                                                                                                     |
| No new dependency without approval (§0.4)                                         | `AGENTS.md` §0.4, §3                                                                                                                                      |
| Confidence threshold, research before editing (§0.5)                              | `AGENTS.md` §0.5                                                                                                                                          |
| Spec-first with a stop until `status: approved` (§1.2)                            | `AGENTS.md` §1.2                                                                                                                                          |
| Quality gates before review (§3)                                                  | `AGENTS.md` §3; `/next-verify`; CI                                                                                                                        |
| Reading secret contents prohibited during investigation (§5)                      | `AGENTS.md` §5, §0.3                                                                                                                                      |
| Branch deletion and force push prohibited (§5)                                    | `AGENTS.md` §5; `guard-destructive-bash.mjs`; `CONSTITUTION.md` §8.2                                                                                      |
| Amendments need a governance spec and owner permission (§8)                       | `AGENTS.md` §8; `CONSTITUTION.md` §7.1                                                                                                                    |
| Skills vetted before install, minimal `allowed-tools` (§10)                       | `AGENTS.md` §10                                                                                                                                           |
| Protected-path list (settings, hooks, harness, skills, workflows, build script)   | `AGENTS.md` §0.3; `guard-protected-paths.mjs`                                                                                                             |
| Error responses never leak Supabase or Postgres text (§4)                         | `AGENTS.md` architecture rules                                                                                                                            |
| Vault DEK handling (cookie, client-only derivation, shared constants)             | `AGENTS.md` §2 key-files entries                                                                                                                          |

Rules enforced by a hook are still stated in prose, because the prose is the
policy and the hook is the mechanism.

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
4. Measure `/context` token usage for the memory-files line before and after
   and record both numbers in this spec.
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

- [ ] `wc -l AGENTS.md` is below 200.
- [ ] Every §0 rule is preserved verbatim or with equivalent meaning, and the
      permission-protected file list is unchanged.
- [ ] Every row of the safety invariance table can be located in the edited
      file.
- [ ] `pnpm format:check` green.
- [ ] Diff reviewed by the owner; harness hash drift for `AGENTS.md` reported
      to the owner.
- [ ] `/context` token counts before and after recorded in this spec.

## Risk & reversibility

- **Blast radius**: agent behavior in every future session. The risk is that a
  rule cut as obvious turns out to have been load-bearing.
- **Reversibility**: documentation only; a single `git revert` restores the
  file. The harness hash needs a matching owner rerun of `/regen-harness`.
- **Backout plan**: revert the impl commit, rerun `/regen-harness`. A cut rule
  that proves necessary can be restored individually in a follow-up spec.

## Open questions

- [ ] Q: Is the Hermes fleet (atlas, heph, argus) still in use? If not, §6 and
      the fleet names in the preamble are deleted; if so, §6 is kept at about 4
      lines. — Owner: Clarence — A:
- [ ] Q: Keep the §0.3 standing exemption text verbatim, or condense it to one
      sentence naming the bounded templateCentral v4 alignment edits? — Owner:
      Clarence — A:
- [ ] Q: Should the known manifest mismatch (`harness.json` records
      `templatecentral_version` 5.0.0, and the LF-versus-raw-bytes hashing
      difference) stay in `AGENTS.md` §11, or move to a spec or issue now that
      it is only relevant to the owner? — Owner: Clarence — A:
- [ ] Q: Should a path-scoped `.claude/rules/` file for crypto code be created
      as a separate owner-applied step, or are the retained key-files entries
      enough? — Owner: Clarence — A:
