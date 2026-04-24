# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gamearr is an automated game library management system following the *arr ecosystem pattern (like Radarr/Sonarr). It monitors, downloads, and organizes PC games automatically using IGDB for metadata, Prowlarr for torrent indexing, and qBittorrent for downloads.

**Tech Stack:**
- Runtime: Bun 1.x
- Backend: Hono 4.x framework with TypeScript
- Database: SQLite with Drizzle ORM
- Frontend: React 18 + Vite 5 + TailwindCSS
- Build: Single binary compilation via Bun

## Essential Commands

### Development
```bash
# Start both frontend and backend (recommended)
bun run dev:all

# Or start manually in separate terminals:
bun dev              # Backend on :8484
bun dev:web          # Frontend on :3000

# Database operations
bun run db:push      # Push schema changes
bun run db:studio    # Open Drizzle Studio
```

### Production Build
```bash
bun run build        # Builds frontend and compiles to ./gamearr binary
./gamearr            # Run production binary (serves on :8484)
```

### Environment Setup
Copy `.env.example` to `.env` and configure:
- IGDB credentials (from Twitch Developer Console)
- Prowlarr URL and API key
- qBittorrent connection details
- Library path for organized downloads

## Architecture Patterns

### Service Layer Architecture
The backend uses a strict layered architecture:
- **Routes** (`src/server/routes/`) - Handle HTTP requests/responses only
- **Services** (`src/server/services/`) - Business logic and external API integration
- **Repositories** (`src/server/repositories/`) - Database access layer
- **Integrations** (`src/server/integrations/`) - External API clients (IGDB, Prowlarr, qBittorrent)

**Critical Rule:** Routes should NEVER access the database directly. Always go through repositories.

### Integration Clients
External services use dedicated client classes:
- **IGDBClient** - Handles OAuth token refresh automatically, caches tokens
- **ProwlarrClient** - Searches torrents, supports category filtering
- **QBittorrentClient** - Manages authentication, torrent operations

All clients implement connection testing and return consistent error formats.

### Database Schema
Three core tables with cascade deletes:
- `games` - Game metadata (IGDB ID is unique, used for deduplication)
- `releases` - Torrent releases linked to games
- `download_history` - Download tracking linked to games and releases

Status flow: Game status changes from `wanted` → `downloading` → `downloaded` as downloads complete.

### Background Jobs
- **DownloadMonitor** (`src/server/jobs/DownloadMonitor.ts`) - Syncs qBittorrent status every 30s
  - Updates game/release status based on download progress
  - Marks games as "downloaded" when torrents complete

### Settings Management
Settings stored as key-value pairs in database with JSON values. The `SettingsService` provides type-safe getters/setters. Settings keys defined in `SETTINGS_KEYS` constant.

Common settings:
- `prowlarr_url`, `prowlarr_api_key`
- `qbittorrent_host`, `qbittorrent_username`, `qbittorrent_password`
- `igdb_client_id`, `igdb_client_secret`
- `prowlarr_categories` (array of category IDs)
- `qbittorrent_category` (download category filter)
- `library_path` (for file organization and scanning)

### Frontend State Management
React components use standard hooks without a global state library:
- API calls through `src/web/src/api/client.ts` (centralized fetch wrapper)
- Component-level state with useState
- Data refetching via callbacks (e.g., `onGameAdded` triggers `loadGames()`)

### Library Folder Matching
The `FileService` scans library folders and parses names using pattern `{Title} ({Year})`:
- `scanLibrary()` returns folders with parsed metadata
- Matches folders to existing games in database
- Unmatched folders can be manually linked via `MatchFolderModal`
- Matched games automatically set to "downloaded" status

### API Response Format
All API endpoints return consistent format:
```typescript
{
  success: boolean;
  data?: T;
  error?: string;
}
```

### Quality Scoring
`IndexerService.scoreRelease()` ranks torrents based on:
- Preferred terms (GOG, DRM-Free, Scene) add points
- High seeders improve score
- Suspicious patterns (low seeders, wrong size) subtract points
- Used for automatic release selection

## Project Structure Notes

### Key Files
- `src/server/index.ts` - Hono app entry point, route registration, job startup
- `src/server/db/schema.ts` - All database tables and type exports
- `src/web/src/App.tsx` - React Router setup, navigation
- `docs/PRODUCT_PLAN.md` - Complete development roadmap and implementation status

### Phase Status
All 7 MVP phases are complete, plus extended features:
- ✅ Phase 1: Foundation
- ✅ Phase 2: IGDB metadata
- ✅ Phase 3: Prowlarr integration with category filtering
- ✅ Phase 4: qBittorrent downloads
- ✅ Phase 5: Library scanning and folder matching
- ✅ Phase 6: RSS automation (SearchScheduler, RssSync jobs)
- ✅ Phase 7: Polish & settings (comprehensive Settings UI, health checks)

Extended features beyond MVP: Multi-library support, Steam/GOG import, Discord notifications, update checking, semantic search, game events tracking.

### Important Conventions
- All timestamps stored as Unix epoch integers (Drizzle `mode: 'timestamp'`)
- Game status enum: `'wanted' | 'downloading' | 'downloaded'`
- Release status enum: `'pending' | 'downloading' | 'completed' | 'failed'`
- IGDB IDs used for deduplication (unique constraint on `games.igdb_id`)
- File paths stored as strings, no validation (assumes valid paths from settings)

## Common Workflows

### Adding a New Integration
1. Create client in `src/server/integrations/{service}/`
2. Add client initialization and config to service layer
3. Store credentials in settings table via `SettingsService`
4. Add UI inputs in `src/web/src/pages/Settings.tsx`
5. Test connection method required for settings validation

### Adding a New API Endpoint
1. Add route handler in `src/server/routes/{resource}.ts`
2. Implement business logic in corresponding service
3. Add method to `src/web/src/api/client.ts`
4. Use in React component with error handling

### Adding Background Job
1. Create job class in `src/server/jobs/`
2. Start job in `src/server/index.ts` after server initialization
3. Use cron for scheduling or setInterval for polling
4. Include comprehensive error logging

## Development Tips

### File Organization
User sets `library_path` in settings. FileService.scanLibrary() reads this path and returns folder information with automatic matching against database games.

### Category Filtering
Prowlarr categories are loaded from `/api/indexer/categories` and stored as array of category IDs. UI uses `CategorySelector` component for multi-select. QBittorrent category is separate (single string) and filters which downloads appear in Activity page.

### Testing Connections
Each integration client has a `testConnection()` method. Settings page calls these on save to validate credentials before storing.

### Database Migrations
Use Drizzle Kit for schema changes:
```bash
bun run db:push  # Push changes (development)
```
Production migrations managed through Drizzle migrations folder.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
