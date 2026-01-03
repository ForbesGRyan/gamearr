# Gamearr Product Plan
**Bun + Hono Stack**

## Project Overview

**Name:** Gamearr
**Description:** Automated game library management following the *arr ecosystem pattern
**Stack:** Bun, TypeScript, Hono, Drizzle ORM, SQLite, React + Vite
**Target Users:** PC gamers who want automated game collection management

---

## MVP Feature Set (v0.1.0)

### Core Features

**1. Game Library Management**
- Add games via IGDB search
- Monitor/unmonitor games
- View library status (wanted/downloading/downloaded)
- Display game metadata and cover art
- PC platform only

**2. Metadata Integration**
- IGDB API integration
- Auto-fetch: title, year, cover art, description, platforms
- Cache metadata locally

**3. Indexer Integration**
- Prowlarr API support (leverage existing indexers)
- Manual search for specific games
- RSS feed monitoring (15-min intervals)
- Parse and rank results

**4. Download Management**
- qBittorrent integration
- Send torrents to download client
- Monitor download progress
- Track completion status

**5. File Organization**
- Auto-rename completed downloads
- Move to library folder
- Pattern: `{Title} ({Year})/`
- Basic duplicate detection

**6. Web Interface**
- Game grid view with cover art
- Add game search modal
- Activity feed (current downloads)
- Settings page (API keys, paths, clients)
- Responsive design

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
  "components": "shadcn/ui",
  "jobs": "node-cron",
  "websocket": "Bun native WebSocket"
}
```

### Project Structure

```
gamearr/
├── src/
│   ├── server/
│   │   ├── index.ts                    # Hono app entry
│   │   ├── routes/
│   │   │   ├── games.ts                # Game CRUD
│   │   │   ├── search.ts               # Manual search
│   │   │   ├── indexers.ts             # Indexer config
│   │   │   ├── downloads.ts            # Download status
│   │   │   ├── settings.ts             # App settings
│   │   │   └── system.ts               # Health/status
│   │   ├── services/
│   │   │   ├── GameService.ts
│   │   │   ├── IndexerService.ts
│   │   │   ├── DownloadService.ts
│   │   │   ├── MetadataService.ts      # IGDB client
│   │   │   ├── FileService.ts
│   │   │   └── MatchingService.ts      # Release matching
│   │   ├── repositories/
│   │   │   ├── GameRepository.ts
│   │   │   ├── ReleaseRepository.ts
│   │   │   └── SettingsRepository.ts
│   │   ├── jobs/
│   │   │   ├── RssSync.ts
│   │   │   ├── DownloadMonitor.ts
│   │   │   └── SearchScheduler.ts
│   │   ├── integrations/
│   │   │   ├── igdb/
│   │   │   │   ├── IGDBClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── prowlarr/
│   │   │   │   ├── ProwlarrClient.ts
│   │   │   │   └── types.ts
│   │   │   └── qbittorrent/
│   │   │       ├── QBittorrentClient.ts
│   │   │       └── types.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── parser.ts               # Release name parsing
│   │   │   └── matcher.ts              # Game matching
│   │   └── websocket/
│   │       └── handlers.ts
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── GameCard.tsx
│   │   │   │   ├── GameGrid.tsx
│   │   │   │   ├── AddGameModal.tsx
│   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   └── Settings/
│   │   │   ├── pages/
│   │   │   │   ├── Library.tsx
│   │   │   │   ├── Activity.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useGames.ts
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   └── useSettings.ts
│   │   │   ├── api/
│   │   │   │   └── client.ts
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── shared/
│       └── types.ts                    # Shared types
├── tests/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── README.md
```

---

## Development Phases

### **Phase 1: Foundation (Week 1)**

**Goals:** Set up project, database, basic API

**Tasks:**
- [ ] Initialize Bun project
- [ ] Set up TypeScript config
- [ ] Configure Drizzle ORM + migrations
- [ ] Create database schema (games, releases, settings)
- [ ] Set up Hono server
- [ ] Create basic API routes structure
- [ ] Set up logging
- [ ] Initialize React + Vite frontend

**Deliverable:** Running server with database, empty frontend

---

### **Phase 2: Metadata Integration (Week 2)**

**Goals:** IGDB integration, search functionality

**Tasks:**
- [ ] Build IGDBClient service
- [ ] Implement game search endpoint
- [ ] Create GameService with CRUD operations
- [ ] Build GameRepository
- [ ] Create "Add Game" UI flow
- [ ] Display game metadata (cover, title, year)
- [ ] Build game library grid view

**Deliverable:** Can search IGDB and add games to library

---

### **Phase 3: Indexer Integration (Week 3)**

**Goals:** Connect to Prowlarr, search for releases

**Tasks:**
- [ ] Build ProwlarrClient service
- [ ] Create IndexerService
- [ ] Implement manual search endpoint
- [ ] Build release matching logic
- [ ] Create ReleaseRepository
- [ ] Build manual search UI
- [ ] Display search results with quality info

**Deliverable:** Can manually search for game releases

---

### **Phase 4: Download Client (Week 4)**

**Goals:** qBittorrent integration, download management

**Tasks:**
- [ ] Build QBittorrentClient service
- [ ] Create DownloadService
- [ ] Implement "grab release" functionality
- [ ] Build download monitoring job
- [ ] Track download progress
- [ ] Create Activity feed UI
- [ ] WebSocket for real-time updates

**Deliverable:** Can send torrents and track downloads

---

### **Phase 5: File Management (Week 5)**

**Goals:** Organize completed downloads

**Tasks:**
- [ ] Build FileService
- [ ] Implement file moving/renaming
- [ ] Create folder structure logic
- [ ] Handle completion webhook from qBittorrent
- [ ] Update game status to "downloaded"
- [ ] Build library folder scanner
- [ ] Handle duplicate detection

**Deliverable:** Auto-organizes completed downloads

---

### **Phase 6: Automation (Week 6)**

**Goals:** RSS monitoring, automatic searching

**Tasks:**
- [ ] Build RSS sync job (15-min cron)
- [ ] Implement automatic game matching
- [ ] Create quality scoring algorithm
- [ ] Auto-grab best releases
- [ ] Build search scheduler for wanted games
- [ ] Add retry logic for failed downloads
- [ ] Implement basic error handling

**Deliverable:** Fully automated workflow

---

### **Phase 7: Polish & Settings (Week 7)**

**Goals:** UI polish, settings management

**Tasks:**
- [ ] Build Settings UI (all integrations)
- [ ] Create settings persistence
- [ ] Add form validation
- [ ] Improve error messages
- [ ] Add loading states
- [ ] Build system status page
- [ ] Create health check endpoint
- [ ] Write basic documentation

**Deliverable:** Production-ready MVP

---

## Database Schema

```typescript
// Core tables
games {
  id: number (PK)
  igdbId: number (unique)
  title: string
  year: number
  platform: string
  monitored: boolean
  status: 'wanted' | 'downloading' | 'downloaded'
  coverUrl: string
  folderPath: string
  addedAt: timestamp
}

releases {
  id: number (PK)
  gameId: number (FK)
  title: string
  size: number
  seeders: number
  downloadUrl: string
  indexer: string
  quality: string
  grabbedAt: timestamp
  status: 'pending' | 'downloading' | 'completed' | 'failed'
}

download_history {
  id: number (PK)
  gameId: number (FK)
  releaseId: number (FK)
  downloadId: string
  status: string
  progress: number
  completedAt: timestamp
}

settings {
  id: number (PK)
  key: string (unique)
  value: string (JSON)
}
```

---

## API Endpoints

```
GET    /api/v1/games                  # List all games
POST   /api/v1/games                  # Add game
GET    /api/v1/games/:id              # Get game details
PUT    /api/v1/games/:id              # Update game
DELETE /api/v1/games/:id              # Remove game

GET    /api/v1/search/games           # Search IGDB
POST   /api/v1/search/releases/:id    # Manual release search

GET    /api/v1/downloads              # Current downloads
DELETE /api/v1/downloads/:id          # Cancel download

GET    /api/v1/indexers               # List indexers
POST   /api/v1/indexers               # Add indexer
PUT    /api/v1/indexers/:id           # Update indexer
DELETE /api/v1/indexers/:id           # Remove indexer

GET    /api/v1/settings               # Get all settings
PUT    /api/v1/settings               # Update settings

GET    /api/v1/system/status          # Health check
GET    /api/v1/system/logs            # Recent logs

WS     /ws                            # WebSocket for updates
```

---

## Quality Scoring (MVP)

Simple scoring algorithm:

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

Auto-grab if: score >= 100 && seeders >= 5
```

---

## Success Metrics

**MVP Launch Criteria:**
- [ ] Can add 10 games via search
- [ ] Auto-downloads at least 1 game
- [ ] Successfully organizes files
- [ ] RSS sync runs without errors
- [ ] Web UI loads in <2s
- [ ] Zero crashes in 24hr test
- [ ] Documentation covers setup

---

## Post-MVP Roadmap (v0.2.0+)

**Features to add later:**
- Multiple quality profiles
- DLC tracking
- Game updates/patches
- Import existing library
- Custom renaming patterns
- Discord/Telegram notifications
- Calendar view
- Multiple platforms (console ROMs)
- Authentication
- Multi-user support
- Backup/restore
- Statistics dashboard

---

## Deployment Strategy

**Development:**
```bash
bun dev              # Backend
bun dev:web          # Frontend with HMR
```

**Production:**
```bash
bun run build:web    # Build frontend
bun build --compile  # Single binary
./gamearr            # Run
```

**Docker:**
```dockerfile
FROM oven/bun:1
# Copy and run
EXPOSE 7878
VOLUME /config /downloads /library
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| IGDB rate limits | Cache aggressively, implement backoff |
| Bun package incompatibility | Test early, have Node fallback plan |
| Game matching accuracy | Start conservative, tune based on feedback |
| Large game files | Stream downloads, don't load into memory |
| qBittorrent API changes | Version lock, test thoroughly |

---

## Timeline Summary

**7 weeks to MVP**
- Weeks 1-2: Foundation + metadata
- Weeks 3-4: Indexers + downloads
- Weeks 5-6: Automation + file management
- Week 7: Polish

**Target Launch:** End of Week 7
