---
id: 059
slug: snapshot-month-editable-dedup
area: fix
status: shipped
author: Claude (Opus 4.8)
created: 2026-07-04
approved: 2026-07-04
shipped: 2026-07-04
impl_pr: direct-to-main
supersedes:
constitution_satisfies:
  - '§3.4'
constitution_overrides:
---

# Spec 059: Editable snapshot month + duplicate guard

## Problem

A monthly snapshot's month cannot be changed once saved — the month picker is
hard-disabled on the edit form (`snapshot-form.tsx` `disabled={!!editId}`). A
user who saved a snapshot under the wrong month has no way to correct it short
of deleting and re-entering every account row. Meanwhile the underlying
`upsertSnapshot` action keys purely on `(user_id, month)` with a fresh row UUID
each call and has no notion of the original month, so naively re-enabling the
picker would either silently overwrite a different month's snapshot (collision)
or orphan the old row and its entries (rename to a free month).

## Constitution check

- Satisfies: `§3.4` (file naming), general §3/§4 architecture (server action for
  mutation, Zod boundary parse, opaque errors).
- Overrides: none.
- No `HARD` rule touched. No enforcement-layer, secret, migration, or dependency
  change.

## Solution shape

Two-layer duplicate prevention plus a true rename on the server.

**Frontend — `src/features/assets/components/snapshot-form.tsx`**

- Remove `disabled={!!editId}` on the month `Input` so the picker is editable
  when editing.
- Reactive duplicate flag:
  ```ts
  const selectedMonth = form.watch('id');
  const isDuplicate = !!allSnapshots?.some(
    (s) => s.id === selectedMonth && s.id !== editId
  );
  ```
  New form (`editId` undefined): any existing month matches → dup. Edit form:
  keeping the snapshot's own month is allowed; any _other_ existing month → dup.
- Hint rendered below the month input when `isDuplicate`, styled like the
  existing `errors.id` slot (`text-destructive text-sm`): `A snapshot for this
month already exists.`
- Save button `disabled={upsert.isPending || isDuplicate}`.

**Hook — `src/features/assets/hooks/use-snapshots.ts`**

- `useUpsertSnapshot` mutationFn accepts `{ data, originalId }` and calls
  `upsertSnapshot(data, originalId)`. Form passes `originalId: editId`.

**Server — `src/features/assets/actions/snapshot-actions.ts`**

- `upsertSnapshot(data: SnapshotData, originalId?: string)`.
- Resolve the target row id:
  - **Rename** (`originalId && originalId !== data.id`): `UPDATE
monthly_snapshots SET month = data.id, updated_at = now() WHERE user_id AND
month = originalId` → `.select('id').single()`. Moves the existing row; no
    orphan. The DB `UNIQUE(user_id, month)` rejects a collision — server-side
    dedup backstop. Wrap any error via `throwIfSupabaseError` (opaque, no
    Postgres text leaked).
  - **Else** (new, or same-month edit): existing `upsert` with
    `onConflict: 'user_id, month'`, unchanged.
- Entry replacement (delete `asset_entries` by `snapshot_id`, re-encrypt +
  insert) unchanged, using the resolved row id.
- Encryption-touching paths: unchanged — DEK usage and `encryptPayload` calls
  are identical; only the parent-row resolution branches.

No migration: `UNIQUE(user_id, month)` already exists
(`supabase/migrations/20260411150000_init.sql`).

## Out of scope

- Separate month/year inputs — the field is a single `YYYY-MM` picker; not
  splitting it.
- Copy/duplicate-snapshot semantics — edit means rename (move), decided
  2026-07-04.
- Changing the new-snapshot overwrite behavior (re-saving the current month on
  the _new_ form still upserts; that is intended).
- Any change to `deleteSnapshot`, `getSnapshot(s)`, or the entries schema.

## Acceptance

- [ ] `pnpm check` green (format:check, lint max-warnings=0, typecheck)
- [ ] `pnpm test:ci` green; new action tests cover: rename to a free month moves
      the row (old month gone, entries preserved under new month, no orphan row);
      rename to an occupied month is rejected; same-month edit still updates in
      place.
- [ ] `pnpm build` green
- [ ] Manual: edit a snapshot, change its month to a free month → row moves, old
      month disappears from dashboard. Change it to an existing month → Save
      disabled, hint shown. New form with an existing month → Save disabled, hint
      shown.
- [ ] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius**: `monthly_snapshots` + `asset_entries` for the single user;
  the assets/entry surface only. A wrong rename branch could move or fail to
  move a snapshot, but the DB `UNIQUE` constraint prevents data-corrupting
  collisions.
- **Reversibility**: single `git revert`; no schema change to roll back.
- **Backout plan**: revert the commit. Snapshots already renamed stay renamed
  (valid data); the disabled-picker behavior returns.

## Open questions

- [x] Q: Rename to a free month — move or copy the original? — Owner: Clarence —
      A: Move (rename). Resolved 2026-07-04.
