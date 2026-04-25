# Changelog

## v0.2.0 (2026-04-25)

### Highlights

A big release focused on making Gamearr feel snappier, easier to manage, and more reliable when things are running for days at a time.

- **Faster, smoother UI.** The whole web app was rebuilt on a new foundation. Pages load quicker, switching between them feels instant, and your changes show up right away instead of after a refresh. Hovering a game now quietly preloads it so opening it is immediate.
- **Better Library page.** The library has a redesigned filter bar with include/exclude chips for platforms, genres, and status, plus a new poster size toggle (small/medium/large). Filtering, sorting, and paging through large libraries is much faster.
- **Smarter Updates page.** Available updates are now grouped by game and you can expand each one to see the specific releases. A confirmation toast lets you know when an action actually went through.
- **Discover & Search improvements.** When adding a game from Discover, you can now pick which platform you want. Search results have a per-result library selector, the search query stays put when you switch tabs, and the "Add & Find Releases" button is clearer about what it does. Game pages now have shareable, deep-linkable tabs.
- **Imports actually link back to your games.** Files imported through the library importer now correctly attach to the right game, with a toast to confirm.
- **Dry-run mode is impossible to miss.** When dry-run is on, a banner appears across the app and a prominent callout sits on the Downloads tab so you know nothing is actually being downloaded.
- **Settings tests are trustworthy.** "Test Connection" buttons (Prowlarr, qBittorrent, SABnzbd, Discord, Steam, GOG, IGDB) now test what's currently in the form — not the last saved value — and they honestly fail when the connection fails instead of pretending it worked.
- **Background jobs you can see.** Settings → System has a new view showing scheduled jobs and a log of recently completed tasks, so you can tell at a glance what Gamearr is doing in the background.
- **More reliable behind the scenes.** Long-running background work now uses a proper, durable queue. If Gamearr restarts mid-task, work resumes from where it left off instead of being silently lost. Old completed tasks get archived automatically so the system stays fast.
- **Lots of small fixes.** Better mobile layouts, fewer false-positive errors in metadata lookups, GOG-style version numbers parsed correctly, faster first search after the app has been idle, and more.

> **Heads up:** Gamearr's default port changed from `7878` to `8484`. See the Breaking Changes section below if you're upgrading.

### Breaking Changes

- **Default HTTP port changed from `7878` to `8484`.** `7878` is Radarr's default port and caused first-run collisions on hosts running the full *arr stack. The `PORT` environment variable still works — users who want to keep the old port can set `PORT=7878`. Docker users must update any pinned `7878:7878` host mappings, and users behind a reverse proxy must update upstream config. Bookmarks and stored Gamearr URLs (Discord webhooks, cross-service callbacks, etc.) also need updating. See [docs/PORT_MIGRATION.md](docs/PORT_MIGRATION.md) for the full migration guide.

### New Features

- **Durable task queue** - New SQLite-backed task queue replaces ad-hoc background work. Includes a `TaskWorker` with exponential backoff, per-kind concurrency caps, wake events, abort signals, and per-kind visibility timeouts. A daily archive sweep moves terminal tasks to a separate `tasks_archive` table to keep the active queue lean. The first handler running on the new queue is `metadata.refresh`, with `MetadataRefreshJob` now enqueueing tasks instead of running inline. New `/api/v1/tasks` endpoints expose list/retry/delete (deletion blocked for done/running tasks).
- **Central job registry** - All scheduled jobs are now registered through a central `JobRegistry` and exposed via `/api/v1/jobs`. Settings → System surfaces a new "Scheduled jobs" view alongside a tasks log so you can see what's running and what just completed.
- **Frontend rewrite on TanStack Router + Query** - The web app migrated from `react-router-dom` to TanStack Router (typed search params per page, route loaders, error boundaries, deep-linkable tabs) and from ad-hoc fetch state to TanStack Query (optimistic updates, hover prefetch, persisted cache). Settings, Search, Library, Discover, Updates, Activity, and GameDetail were all reworked.
- **Library overhaul** - Library page now uses TanStack Table with a redesigned filter UI, including tri-state include/exclude chips for platforms/genres/status. Poster grid has a sm/md/lg size toggle. Updates page gained expandable game groups with per-game release detail, plus a confirmation toast when actions complete.
- **Discover & Search polish** - Discover now shows a platform selector when adding a game to your library. Search results expose a per-card library selector and a clearer "Add & Find Releases" CTA, and search queries now persist across tab switches. GameDetail tabs are URL-synced and the Add & Find Releases flow is deep-linkable.
- **Dry-run mode UX** - When `dry_run` is enabled, a global banner is shown across the app and a prominent callout sits at the top of the Downloads tab so it's impossible to forget you're not actually downloading.
- **Settings test buttons honor live form values** - Test Connection on Prowlarr, qBittorrent, SABnzbd, Discord, Steam, GOG, and IGDB now uses what's currently in the form, not the last saved value. Test buttons surface failures clearly instead of misleadingly reporting success on rejected reads.
- **Frontend stack upgrade** - React 19 (with the React Compiler), Tailwind 4, and Vite 8. ESLint v9 + the React Compiler plugin are wired into the web package.

### Bug Fixes

- **Imported downloads link to games** - Imports completed via the library importer are now correctly linked back to the originating game, with a toast confirming the import.
- **Skip semantic search init in compiled binaries** - Embedder initialization is now skipped in Bun-compiled binaries where the model can't be loaded, removing a startup error from the single-binary distribution.
- **Drop legacy CHECK constraint on `game_events.event_type`** - The old constraint blocked newer event types from being inserted; it's now removed via migration.
- **Parse GOG-style `v1 06` / `v1_06` versions** - The version parser handles GOG's space- and underscore-separated version strings in addition to dotted SemVer.
- **Prefer PC platform when adding from IGDB** - When an IGDB game has multiple platforms, the PC platform is now selected by default instead of an arbitrary first match.
- **Include episodic/expanded game types in IGDB queries** - Episodic games and standalone expansions previously failed to surface in metadata lookups.
- **Paginate top-torrents fetch and use category RSS** - The indexer's top-torrents fetch now paginates correctly and uses the per-category RSS endpoint, fixing missing results on busy indexers.
- **Add missing `releases` columns for SABnzbd** - A leftover migration gap meant SABnzbd-routed releases couldn't persist their full metadata. Schema now has the missing columns.
- **Raise Bun `idleTimeout` and warm the embedder at startup** - First search-after-idle no longer eats a long cold-start penalty.
- **Settings layout polish** - Tab layouts tightened, the update-check toggle behaves correctly, and the Downloads tab uses a two-column layout.
- **Mobile Activity table** - Low-priority columns are hidden at narrow widths, the view-mode toggle is visible on mobile, and pagination no longer overflows.
- **Scroll-locked main shell + centralized view transitions** - Replaces the previous patchwork of per-page scroll containers and ad-hoc page transitions.

## v0.1.14 (2026-04-16)

### New Features

- **SABnzbd download client support** - Gamearr now supports SABnzbd as a second download client alongside qBittorrent. Usenet releases from Prowlarr automatically route to SABnzbd while torrent releases continue to qBittorrent. Configure SABnzbd host, API key, and category under Settings > Downloads. Activity page shows unified download status across both clients with protocol badges (Torrent/NZB) on search results. (Closes #1)
- **Dual-client status sync** - DownloadMonitor tracks connection state independently per client, so one client going offline does not break the other's sync. Per-client error logging makes it easy to see which client is having issues.

## v0.1.12 (2026-02-17)

### Bug Fixes

- **Fix Prowlarr proxy URL download failures** - Gamearr now prefers magnet links over Prowlarr proxy URLs when sending releases to the download client. This fixes download failures in Docker/networked setups where qBittorrent cannot reach Prowlarr's internal proxy endpoint. When only a proxy URL is available, Gamearr downloads the .torrent file and uploads it to qBittorrent with response validation, and falls back to magnet links if the proxy fetch fails.
- **Fix Docker build failure with Node 24** - The `oven/bun:1` Docker image updated to report as Node 24 via Bun's compatibility layer, causing `node-gyp` compilation failures for `better-sqlite3`. The builder stage now installs Node.js 22 LTS for reliable native module compilation.

### New Features

- **Update/Patch release detection** - Gamearr now detects whether torrent releases are full games, updates, patches, or DLC. Configurable handling modes: penalize score (default), hide from results, or show warning only. Release type badges are displayed in search results.

## v0.1.10.1 (2026-01-26)

### Bug Fixes

- Fix Docker migration module import error

## v0.1.10 (2026-01-26)

### New Features

- Automatic database migrations on Docker startup
