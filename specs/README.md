# Specs

Every feature, bugfix, refactor, or governance change starts here. No code without an approved spec.

## Flow

1. **Draft** — copy `SPEC_TEMPLATE.md` to `specs/<area>/<NNN>-<slug>.md` where `<area>` is one of: `feature`, `fix`, `refactor`, `governance`, `infra`.
2. **PR** — open a PR with branch `spec/<NNN>-<slug>` containing only the spec file. Tag `status: draft` in the frontmatter.
3. **Approve** — owner reviews. On approval, owner sets `status: approved` and merges.
4. **Implement** — new branch `impl/<NNN>-<slug>`. Code must link the spec PR. Quality gates block merge.
5. **Close** — after impl merges, mark spec `status: shipped` and link the impl PR.

## Rules

- One spec per change. Bundle = needs amendment spec first.
- Approved spec is immutable. Material changes = new spec, supersedes previous.
- Spec hash is checked on impl PR; if spec was edited post-approval, impl PR is blocked.
- Reject impl PR if: no linked spec, spec status != approved, spec hash mismatch, constitution sections not cited.

## Numbering

Zero-padded 3 digits. Find next: `ls specs/**/*.md | sort | tail -1`. Increment.

## Naming

`<NNN>-<short-slug>.md`, kebab-case. Examples:

- `feature/004-equity-cost-basis.md`
- `fix/012-vault-cookie-expiry.md`
- `governance/002-amend-soft-coverage-floor.md`
