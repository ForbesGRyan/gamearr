# Gamearr 🎮

Automated game library management following the *arr ecosystem pattern. Built with Bun, TypeScript, Hono, and React.

## Project Status

**Current Version:** v0.2.0 (Phase 2 - Metadata Integration Complete)

### Phase 1 ✅ Complete
- [x] Project scaffolding
- [x] Database schema with Drizzle ORM
- [x] Hono API server with route structure
- [x] React + Vite frontend
- [x] Logging utility

### Phase 2 ✅ Complete
- [x] IGDB API integration with OAuth
- [x] Game search functionality
- [x] Add games to library
- [x] Game library grid view
- [x] Monitor/unmonitor games
- [x] Delete games

### Upcoming Phases
- **Phase 3:** Prowlarr/indexer integration
- **Phase 4:** qBittorrent download client
- **Phase 5:** File management & organization
- **Phase 6:** RSS monitoring & automation
- **Phase 7:** Settings UI & polish

## Tech Stack

### Backend
- **Runtime:** Bun 1.x
- **Framework:** Hono 4.x
- **Database:** SQLite (bun:sqlite)
- **ORM:** Drizzle ORM
- **Validation:** Zod

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite 5
- **Styling:** TailwindCSS
- **Routing:** React Router

## Prerequisites

- [Bun](https://bun.sh) 1.0 or higher

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gamearr.git
cd gamearr
```

2. Install backend dependencies:
```bash
bun install
```

3. Install frontend dependencies:
```bash
cd src/web
bun install
cd ../..
```

4. Configure IGDB API credentials:
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your IGDB credentials
# Get credentials from: https://dev.twitch.tv/console/apps
```

5. Initialize database (auto-creates tables):
```bash
bun run db:push
```

## Development

### Easy Start (Recommended)

**Option 1: Using run scripts (automatic setup)**

Windows PowerShell:
```powershell
.\run.ps1
```

Windows Command Prompt:
```cmd
run.bat
```

macOS/Linux/WSL:
```bash
chmod +x run.sh
./run.sh
```

**Option 2: Using npm/bun script**
```bash
bun run dev:all
# Runs both backend and frontend in one terminal
```

### Manual Start

**Terminal 1 - Backend:**
```bash
bun dev
# Server runs on http://localhost:7878
```

**Terminal 2 - Frontend:**
```bash
bun dev:web
# Frontend runs on http://localhost:3000
```

### View Database
```bash
bun run db:studio
# Opens Drizzle Studio in browser
```

## Building for Production

### Build Frontend
```bash
bun run build:web
```

### Build Standalone Binary
```bash
bun run build
# Creates ./gamearr executable
```

### Run Production Build
```bash
./gamearr
# Serves frontend and API on port 7878
```

## Project Structure

```
gamearr/
├── src/
│   ├── server/              # Backend
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Database access
│   │   ├── integrations/    # External API clients
│   │   ├── jobs/            # Background jobs
│   │   ├── db/              # Database schema & migrations
│   │   ├── utils/           # Utilities
│   │   └── index.ts         # Server entry point
│   ├── web/                 # Frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── pages/       # Page components
│   │   │   ├── hooks/       # Custom hooks
│   │   │   ├── api/         # API client
│   │   │   └── App.tsx      # Root component
│   │   └── index.html
│   └── shared/              # Shared types
├── data/                    # SQLite database (gitignored)
├── dist/                    # Built frontend (gitignored)
└── PRODUCT_PLAN.md          # Detailed development plan
```

## API Endpoints

All endpoints are prefixed with `/api/v1`

### Games
- `GET /games` - List all games
- `POST /games` - Add a new game
- `GET /games/:id` - Get game details
- `PUT /games/:id` - Update game
- `DELETE /games/:id` - Delete game

### Search
- `GET /search/games?q=query` - Search IGDB
- `POST /search/releases/:id` - Search releases for game

### Downloads
- `GET /downloads` - Current downloads
- `DELETE /downloads/:id` - Cancel download

### Indexers
- `GET /indexers` - List indexers
- `POST /indexers` - Add indexer
- `PUT /indexers/:id` - Update indexer
- `DELETE /indexers/:id` - Delete indexer

### Settings
- `GET /settings` - Get settings
- `PUT /settings` - Update settings

### System
- `GET /system/status` - Health check
- `GET /system/logs` - Recent logs

## Database Schema

### Games
- Game metadata from IGDB
- Monitor status
- Download status

### Releases
- Torrent/NZB releases
- Quality information
- Indexer source

### Download History
- Download progress tracking
- Completion status

### Settings
- Application configuration
- API credentials
- Paths

## Contributing

This is currently in active development. See `PRODUCT_PLAN.md` for the roadmap.

## License

MIT

## Acknowledgments

Inspired by [Radarr](https://github.com/Radarr/Radarr) and the *arr ecosystem.
