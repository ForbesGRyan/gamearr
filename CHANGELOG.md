# Changelog

## Unreleased

### Breaking Changes

- **Default HTTP port changed from `7878` to `8484`.** `7878` is Radarr's default port and caused first-run collisions on hosts running the full *arr stack. The `PORT` environment variable still works — users who want to keep the old port can set `PORT=7878`. Docker users must update any pinned `7878:7878` host mappings, and users behind a reverse proxy must update upstream config. Bookmarks and stored Gamearr URLs (Discord webhooks, cross-service callbacks, etc.) also need updating. See [docs/PORT_MIGRATION.md](docs/PORT_MIGRATION.md) for the full migration guide.

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
