# Soft-delete games with auto-restore

**Date:** 2026-04-25
**Status:** Approved (design)
**Owner:** Ryan

## Problem

Deleting a game in Gamearr cascades through every dependent table (`releases`, `download_history`, `game_events`, `game_updates`, `game_embeddings`, `game_folders`, `game_stores`, plus `library_files.matched_game_id` set null). Re-adding the same game creates a brand-new row with a new `id`, and all prior history is gone.

Two concrete symptoms:

1. **Stale references break.** Browser tabs, React Query caches, queued tasks, or pasted URLs that hold the old `id` (e.g., `409`) hit "Game not found" after the row is deleted, even after re-add.
2. **History is lost.** Past releases, downloads, events, and update detections vanish on delete.

## Goal

Replace the destructive delete with a soft-delete. Re-adding a previously-deleted game (matched by `igdb_id`) silently restores the existing row, preserving id and full history. Hard delete moves to a CLI/admin path.

Non-goals:

- No frontend changes. The fix is entirely backend.
- No change to slug-based lookups or routing. (Slug-based routing was the user's initial framing, but soft-delete is a stronger fix and addresses the real "keep history" requirement.)
- No retention policy automation. CLI is manual.

## Schema changes

### `games` table

Add column:

```ts
deletedAt: integer('deleted_at', { mode: 'timestamp' })  // null = live, set = soft-deleted
```

Add index `games_deleted_at_idx` on `deletedAt`.

### `game_events.event_type` enum

Extend with:

- `removed_from_library` — emitted on soft-delete
- `reimported_to_library` — emitted on auto-restore

### Foreign keys / cascade

No changes. Existing `onDelete: 'cascade'` and `onDelete: 'set null'` behavior continues to apply on the (rare) hard-delete path. Soft-delete does not trigger cascades because no DELETE statement is issued.

### Migration

One Drizzle migration:

- `ALTER TABLE games ADD COLUMN deleted_at INTEGER`
- Create `games_deleted_at_idx` on `deleted_at`
- Update `game_events.event_type` check constraint to include the two new values

No data backfill — existing rows have `deletedAt = null` = live.

## Repository layer (`GameRepository`)

All current "live" read methods filter `WHERE deleted_at IS NULL` by default:

- `findById`
- `findByIgdbId`
- `findByIgdbIds`
- `findAll`
- `findByStatus`
- `findByLibrary`
- Any list/search query

Add explicit escape hatches:

- `findByIgdbIdIncludingDeleted(igdbId)` — used by the restore path.
- `findDeleted({ olderThan? })` — used by the CLI.

Mutation methods:

- `delete(id)` becomes soft-delete: `UPDATE games SET deleted_at = unixepoch() WHERE id = ?`. Same return signature (boolean / row).
- `hardDelete(id)` — new method, performs the original cascading row delete. Used only by CLI.

## Service layer (`GameService`)

### `deleteGame(id)`

1. Set `deletedAt = now()`.
2. Emit `removed_from_library` game event.
3. Do **not** clear `status`, `folderPath`, `installedVersion`, etc. — leave the snapshot intact so a restore knows what was there.

### `addGameFromIGDB(igdbId, …)`

Modify the existing-row check to include soft-deleted rows:

1. Look up by `igdbId` including soft-deleted (`findByIgdbIdIncludingDeleted`).
2. **Found and `deletedAt == null`** → existing live game. Current behavior (no-op or error per current contract).
3. **Found and `deletedAt != null`** → **restore**:
   - Set `deletedAt = null`.
   - Reset volatile state:
     - `status = 'wanted'`
     - `folderPath = null`
     - `installedVersion = null`
     - `installedQuality = null`
     - `latestVersion = null`
     - `updateAvailable = false`
     - `monitored = true`
   - Refresh IGDB metadata via the existing fetch path (title, cover, summary, ratings, genres, etc.).
   - Emit `reimported_to_library` game event.
   - Trigger library re-scan/match for this game via the existing scan trigger.
   - Return the restored game.
4. **Not found** → insert new (current behavior).

State that is **preserved** through delete → restore: `id`, `igdbId`, `slug`, `addedAt`, all child rows (`releases`, `download_history`, `game_events`, `game_updates`, `game_embeddings`, `game_folders`, `game_stores`), HLTB and ProtonDB cached data.

State that is **reset** on restore: live operational fields listed above.

State that is **refreshed** on restore: IGDB metadata fields.

## Hard-delete CLI

New script: `scripts/games-gc.ts` (run via `bun run scripts/games-gc.ts`).

Modes:

- `--id <n>` — hard-delete one soft-deleted game (cascades).
- `--older-than <days>` — hard-delete all games whose `deletedAt < now - days`.
- `--dry-run` — list what would be deleted, do nothing.

Safety:

- Refuses to operate on rows where `deletedAt IS NULL` (live games). Print error and exit non-zero.
- No UI exposure.

## Effects on dependent reads

- **`library_files.matched_game_id`** — FK already `onDelete: 'set null'`. Library scan/match queries that join `games` will pick up the default `deleted_at IS NULL` filter and treat soft-deleted matches as unmatched. On restore, the explicit re-scan trigger re-matches.
- **`gameFolders`** — rows persist through soft-delete. Queries that read folders alongside a game must filter by the parent's `deleted_at IS NULL` (typically via the existing repo default when fetching the game).
- **Routes that take `:id`** (search, updates, releases, etc.) — return 404 for soft-deleted ids by default, since the repo filter excludes them. The bug fix does not depend on these resolving — it depends on re-add reusing the same `id`, which it does.

## Tests

Repository:

- Default queries exclude soft-deleted rows.
- `findByIgdbIdIncludingDeleted` returns soft-deleted rows.
- `findDeleted({ olderThan })` filters correctly.
- `delete` sets `deletedAt`; `hardDelete` removes the row and cascades.

Service:

- `deleteGame` sets `deletedAt`, emits `removed_from_library`, does not touch child rows.
- `addGameFromIGDB` on a soft-deleted `igdbId` restores in place, resets volatile state listed in §Service, emits `reimported_to_library`, refreshes metadata, returns the same `id`.
- Child rows (`releases`, `game_events`, `download_history`, `game_updates`, `game_embeddings`) survive a delete → restore round-trip.

CLI:

- Refuses to act on live rows.
- `--id` cascades correctly on soft-deleted rows.
- `--older-than` filters by `deletedAt`.
- `--dry-run` prints, does not mutate.

## Open questions

None.
