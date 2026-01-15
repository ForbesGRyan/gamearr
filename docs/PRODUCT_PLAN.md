# Gamearr Product Plan
**Bun + Hono Stack**

## Project Overview

**Name:** Gamearr
**Description:** Automated game library management following the *arr ecosystem pattern
**Stack:** Bun, TypeScript, Hono, Drizzle ORM, SQLite, React + Vite
**Target Users:** PC gamers who want automated game collection management
**Current Version:** 0.1.8

---

## Implementation Status

### MVP Complete (v0.1.x)

All 7 phases of the original MVP plan have been implemented, plus significant additional features.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Foundation - Project setup, database, basic API |
| Phase 2 | ✅ Complete | Metadata - IGDB integration, game search |
| Phase 3 | ✅ Complete | Indexers - Prowlarr integration, release search |
| Phase 4 | ✅ Complete | Downloads - qBittorrent integration |
| Phase 5 | ✅ Complete | Files - Library scanning, folder matching |
| Phase 6 | ✅ Complete | Automation - RSS sync, auto-search |
| Phase 7 | ✅ Complete | Polish - Settings UI, health checks |

---

## Core Features (Implemented)

### 1. Game Library Management
- [x] Add games via IGDB search with semantic matching
- [x] Monitor/unmonitor games
- [x] View library status (wanted/downloading/downloaded)
- [x] Display game metadata and cover art
- [x] Multi-view support: Poster grid, Table, Health tab
- [x] Advanced filtering: Status, Store, Platform, Search
- [x] Bulk operations: Monitor, status change, delete
- [x] Game events tracking (imports, matches, status changes)

### 2. Metadata Integration
- [x] IGDB API integration with OAuth token management
- [x] Auto-fetch: title, year, cover art, description, platforms, genres, rating
- [x] Cover image caching with automatic cleanup
- [x] Semantic search with vector embeddings
- [x] Batch IGDB queries (10 games at a time)

### 3. Indexer Integration
- [x] Prowlarr API support with category filtering
- [x] Manual search for specific games
- [x] RSS feed monitoring (configurable intervals)
- [x] Quality scoring algorithm (GOG, DRM-Free, Scene, seeders)
- [x] Auto-grab based on score/seeder thresholds
- [x] GUID deduplication to prevent duplicate grabs

### 4. Download Management
- [x] qBittorrent integration
- [x] Send torrents to download client
- [x] Monitor download progress (30-second sync)
- [x] Track completion status
- [x] Pause/resume/cancel operations
- [x] Category support for filtering
- [x] Dry-run mode for testing

### 5. File Organization
- [x] Library folder scanning
- [x] Pattern parsing: `{Title} ({Year})/`
- [x] Auto-match with semantic search
- [x] Manual folder-to-game matching
- [x] Duplicate detection
- [x] Loose file organization
- [x] Multi-folder per game (base, DLC, updates)

### 6. Web Interface
- [x] Game grid view with cover art
- [x] Add game search modal
- [x] Activity feed (current downloads)
- [x] Comprehensive settings page
- [x] Responsive design (mobile/desktop)
- [x] Setup wizard for first run
- [x] Toast notification system
- [x] Accessibility improvements (ARIA, keyboard navigation)

---

## Extended Features (Implemented)

### Multi-Library Support
- [x] Multiple library paths with independent settings
- [x] Platform filtering per library (PC, Steam, GOG, etc.)
- [x] Priority ordering for libraries
- [x] Download category per library

### Game Store Integration
- [x] Steam library import with SSE streaming
- [x] GOG library import with OAuth flow
- [x] Store-specific game ID tracking
- [x] Many-to-many game-store relationships
- [x] Playtime and ownership tracking

### Update Management
- [x] Automatic update detection for downloaded games
- [x] Update policy per game (notify/auto-grab/ignore)
- [x] Update types: version updates, DLC, better releases
- [x] Scheduled and manual update checks

### Discover Page
- [x] Trending/popular games from IGDB
- [x] 8 popularity type filters
- [x] Torrent search with quality indicators
- [x] Quick add-to-library workflow

### Notifications
- [x] Discord webhook integration
- [x] Download complete notifications with embeds
- [x] Rate limiting for webhook calls

### Authentication & Security
- [x] Optional API key authentication
- [x] CSRF protection via Origin validation
- [x] Tiered rate limiting by endpoint
- [x] Path security for file operations

### System Monitoring
- [x] Comprehensive health checks
- [x] Log viewer with rotation
- [x] Service connection testing
- [x] Cache statistics

---

## Technical Architecture

### Stack Details

```json
{
  "runtime": "Bun 1.x",
  "backend": "Hono 4.x",
  "database": "SQLite (bun:sqlite)",
  "orm": "Drizzle ORM",
  "validation": "Zod",
  "frontend": "React 18 + TypeScript",
  "bundler": "Vite 5",
  "styling": "TailwindCSS",
  "jobs": "setInterval + cron patterns",
  "build": "Single binary compilation"
}
```

### API Routes (17 route files)

```
/api/v1/games          # Game CRUD, folders, releases, history, events
/api/v1/search         # IGDB search, release search, grab
/api/v1/discover       # Popular games, popularity types
/api/v1/downloads      # Download management, pause/resume
/api/v1/library        # Library scanning, matching, organization
/api/v1/libraries      # Multi-library CRUD
/api/v1/indexers       # Prowlarr integration, categories
/api/v1/steam          # Steam import
/api/v1/gog            # GOG import
/api/v1/settings       # Configuration management
/api/v1/system         # Health, logs, setup
/api/v1/auth           # Authentication management
/api/v1/updates        # Update checking, grab/dismiss
/api/v1/images         # Cover image caching
/api/v1/notifications  # Discord webhook testing
```

### Background Jobs (7 jobs)

1. **DownloadMonitor** - Sync downloads every 30s
2. **SearchScheduler** - Search wanted games (configurable, default 15min)
3. **RssSync** - Fetch new releases (configurable, default 15min)
4. **UpdateCheckJob** - Check for game updates (daily)
5. **MetadataRefreshJob** - Refresh IGDB metadata
6. **DiscoverCacheJob** - Maintain trending cache
7. **LogRotationJob** - Rotate and compress logs

### Services (11 services)

1. **GameService** - Game operations, search, rematch
2. **DownloadService** - Download orchestration
3. **IndexerService** - Release search and scoring
4. **FileService** - Library scanning
5. **LibraryService** - Multi-library management
6. **UpdateService** - Update detection
7. **SettingsService** - Configuration
8. **ImageCacheService** - Cover caching
9. **CacheService** - API response caching
10. **SemanticSearchService** - Vector matching
11. **EmbeddingService** - Embedding generation

### Integrations (6 external services)

1. **IGDBClient** - Game metadata with OAuth
2. **ProwlarrClient** - Torrent indexing
3. **QBittorrentClient** - Download management
4. **SteamClient** - Steam library
5. **GogClient** - GOG library
6. **DiscordWebhookClient** - Notifications

---

## Database Schema

### Core Tables (13 tables)

```typescript
// Game management
games {
  id, igdbId (unique), title, year, platform, monitored,
  status ('wanted'|'downloading'|'downloaded'),
  coverUrl, description, rating, genres, gameModes, themes,
  developer, publisher, folderPath, libraryId,
  updatePolicy ('notify'|'auto'|'ignore'),
  importSource, addedAt, updatedAt
}

releases {
  id, gameId (FK), title, size, seeders, downloadUrl,
  indexer, quality, guid, grabbedAt,
  status ('pending'|'downloading'|'completed'|'failed')
}

download_history {
  id, gameId (FK), releaseId (FK), downloadId, qbittorrentHash,
  status, progress, startedAt, completedAt
}

game_folders {
  id, gameId (FK), path, folderType ('base'|'dlc'|'update'),
  version, quality, size, isPrimary, addedAt
}

game_events {
  id, gameId (FK), eventType, metadata, createdAt
}

game_updates {
  id, gameId (FK), releaseId (FK), updateType,
  currentVersion, newVersion, detectedAt, grabbedAt, dismissedAt
}

// Library management
libraries {
  id, name, path, platform, priority, downloadCategory,
  isDefault, createdAt, updatedAt
}

library_files {
  id, libraryId (FK), path, name, parsedTitle, parsedYear,
  matchStatus ('unscanned'|'unmatched'|'matched'|'ignored'),
  gameId (FK), isDirectory, extension, size, modifiedAt, scannedAt
}

// Store integration
stores {
  id, name, slug, iconUrl
}

game_stores {
  gameId (FK), storeId (FK), storeGameId, addedAt
}

// System
settings {
  id, key (unique), value (JSON)
}

game_embeddings {
  id, gameId (FK), titleHash, embedding (Float32Array), createdAt
}

api_cache {
  id, key (unique), value, expiresAt, createdAt
}
```

---

## Quality Scoring

```
Base Score: 100

Preferred terms (+points):
- "GOG": +50
- "DRM Free": +40
- "Repack": +20
- "Scene": +10

Penalties (-points):
- Low seeders (<5): -30
- Very old (>2 years): -20
- Suspicious size: -50

Auto-grab criteria (configurable):
- Minimum score: 100 (default)
- Minimum seeders: 5 (default)
```

---

## Deployment

### Development
```bash
bun run dev:all       # Frontend + Backend with HMR
bun run db:push       # Push schema changes
bun run db:studio     # Open Drizzle Studio
```

### Production
```bash
bun run build         # Build frontend + compile binary
./gamearr             # Run on port 7878
```

### Docker
```dockerfile
FROM oven/bun:1
EXPOSE 7878
VOLUME /config /downloads /library
ENV DATA_PATH=/config
```

---

## Post-MVP Roadmap (v0.2.0+)

### Planned Features
- [ ] Multiple quality profiles
- [ ] DLC tracking improvements
- [ ] Custom renaming patterns
- [ ] Telegram notifications
- [ ] Calendar view for releases
- [ ] Multiple platform support (console ROMs)
- [ ] Multi-user support with permissions
- [ ] Backup/restore functionality
- [ ] Statistics dashboard
- [ ] Additional download clients (Deluge, Transmission)
- [ ] Bulk download controls (Pause All, Resume All)
- [ ] ProtonDB/Wine compatibility integration
- [ ] Metacritic integration

### Technical Improvements
- [ ] WebSocket for real-time updates
- [ ] GraphQL API option
- [ ] Plugin system for integrations
- [ ] Improved test coverage

---

## Configuration

### Settings Keys

**Integration:**
- `igdb_client_id`, `igdb_client_secret`
- `prowlarr_url`, `prowlarr_api_key`
- `qbittorrent_host`, `qbittorrent_username`, `qbittorrent_password`
- `steam_api_key`, `steam_id`
- `gog_refresh_token`
- `discord_webhook_url`

**Categories:**
- `prowlarr_categories` (array of IDs)
- `qbittorrent_category` (string)

**Automation:**
- `rss_sync_interval` (default: 15min)
- `search_scheduler_interval` (default: 15min)
- `auto_grab_min_score` (default: 100)
- `auto_grab_min_seeders` (default: 5)
- `update_check_enabled` (default: true)
- `update_check_schedule` (default: daily)
- `default_update_policy` (default: notify)

**System:**
- `dry_run` (testing mode)
- `trusted_proxies`

---

## Success Metrics

**MVP Launch Criteria:** ✅ All Complete
- [x] Can add games via search
- [x] Auto-downloads releases meeting criteria
- [x] Successfully organizes files
- [x] RSS sync runs without errors
- [x] Web UI loads quickly
- [x] Stable operation over 24hr
- [x] Setup wizard guides configuration

---

*Last Updated: January 2026*
