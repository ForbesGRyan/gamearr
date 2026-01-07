# Gamearr

Automated game library management following the *arr ecosystem pattern. Built with Bun, TypeScript, Hono, and React.

## Features

- **IGDB Integration** - Search and add games with full metadata (cover art, year, platforms)
- **Prowlarr Integration** - Search multiple torrent indexers for game releases
- **qBittorrent Integration** - Automated download management
- **Library Scanning** - Scan existing game folders and match to database
- **Library Health** - Detect duplicate games and organize loose files
- **RSS Automation** - Automatically grab new releases matching your wanted games
- **Quality Scoring** - Intelligent release selection (prefers GOG, DRM-Free, repacks)
- **Multiple View Modes** - Posters, table, or detailed overview
- **Dry-Run Mode** - Test your configuration without downloading

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- [Prowlarr](https://prowlarr.com/) (for indexer management)
- [qBittorrent](https://www.qbittorrent.org/) with Web UI enabled
- [IGDB API credentials](https://dev.twitch.tv/console) (free via Twitch Developer Console)

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/gamearr.git
cd gamearr
bun install
cd src/web && bun install && cd ../..

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
bun run db:push

# Start development servers
bun run dev:all
```

Open http://localhost:3000 in your browser.

## Configuration

### Required Settings

Configure these in the Settings page (http://localhost:3000/settings):

| Setting | Description |
|---------|-------------|
| **IGDB Client ID/Secret** | From [Twitch Developer Console](https://dev.twitch.tv/console) |
| **Prowlarr URL** | e.g., `http://localhost:9696` |
| **Prowlarr API Key** | Found in Prowlarr Settings > General |
| **qBittorrent Host** | e.g., `http://localhost:8080` |
| **qBittorrent Username/Password** | Web UI credentials |
| **Library Path** | Where your games are stored |

### Optional Settings

| Setting | Description |
|---------|-------------|
| **Prowlarr Categories** | Filter search to specific categories (e.g., Games/PC) |
| **qBittorrent Category** | Category for Gamearr downloads |
| **Dry-Run Mode** | Log downloads without actually grabbing |

## Usage

### Adding Games

1. Go to **Library** page
2. Click **Add Game**
3. Search for a game by name
4. Select the game and click **Add to Library**

### Manual Search

1. Click on a game in your library
2. Click **Search Releases**
3. Review available releases and quality scores
4. Click **Grab** to download

### Automatic Downloads

Gamearr runs two background jobs:

- **RSS Sync** (every 15 min) - Checks indexers for new releases matching wanted games
- **Search Scheduler** (every 15 min) - Actively searches for all wanted games

Games meeting the auto-grab criteria (score >= 100, seeders >= 5) are automatically downloaded.

### Library Import

1. Go to **Library** page and click the **Import** tab
2. Click **Refresh Scan** to scan your library folder
3. Unmatched folders appear with an **Auto Match** button
4. Click **Auto Match** to search IGDB, or **Match** to search manually
5. Confirm the match to add the game as "downloaded"

### Library Health

The **Health** tab helps keep your library organized:

**Duplicate Detection**
- Finds games with similar titles (>80% match)
- Shows both games side-by-side with sizes
- Click **Dismiss** to hide false positives

**Loose Files**
- Detects standalone archives (.iso, .rar, .zip, .7z) in your library
- Click **Organize** to create a folder and move the file into it
- Organized files then appear in the Import tab for matching

## API Endpoints

All endpoints prefixed with `/api/v1`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/games` | GET | List all games |
| `/games` | POST | Add a game |
| `/games/:id` | GET/PUT/DELETE | Game CRUD |
| `/search/games?q=` | GET | Search IGDB |
| `/search/releases/:id` | POST | Search releases for game |
| `/search/grab` | POST | Grab a release |
| `/downloads` | GET | Active downloads |
| `/downloads/test` | GET | Test qBittorrent connection |
| `/indexers` | GET | List Prowlarr indexers |
| `/indexers/test` | GET | Test Prowlarr connection |
| `/settings/:key` | GET/PUT | Get/set setting |
| `/system/status` | GET | Basic health check |
| `/system/health` | GET | Detailed health with service status |
| `/library/scan` | GET/POST | Get cached / refresh library scan |
| `/library/auto-match` | POST | Auto-match folder to IGDB |
| `/library/match` | POST | Match folder to game |
| `/library/health/duplicates` | GET | Find potential duplicate games |
| `/library/health/loose-files` | GET | Find loose archive files |
| `/library/health/organize-file` | POST | Organize loose file into folder |

## Development

### Commands

```bash
# Development (both servers)
bun run dev:all

# Or separately:
bun dev          # Backend on :7878
bun dev:web      # Frontend on :3000

# Database
bun run db:push    # Push schema changes
bun run db:studio  # Open Drizzle Studio

# Production build
bun run build      # Creates ./gamearr binary
./gamearr          # Run on :7878
```

### Project Structure

```
gamearr/
├── src/
│   ├── server/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Database access
│   │   ├── integrations/    # IGDB, Prowlarr, qBittorrent clients
│   │   ├── jobs/            # RssSync, SearchScheduler, DownloadMonitor
│   │   ├── db/              # Drizzle schema
│   │   └── utils/           # Logger, errors
│   └── web/
│       └── src/
│           ├── pages/       # Library (Games/Import/Health), Activity, Settings
│           ├── components/  # GameCard, AddGameModal, etc.
│           └── api/         # API client
├── data/                    # SQLite database
└── dist/                    # Production build
```

## Quality Scoring

Releases are scored based on:

| Factor | Points |
|--------|--------|
| Title match | +50 |
| Year match | +20 |
| GOG release | +50 |
| DRM-Free | +40 |
| Repack | +20 |
| Scene release | +10 |
| High seeders (20+) | +10 |
| Low seeders (<5) | -30 |
| Old release (>2 years) | -20 |
| Suspicious size | -50 |

**Auto-grab threshold:** score >= 100 AND seeders >= 5

## Troubleshooting

### Connection Issues

Use the **Test Connection** buttons in Settings to verify:
- Prowlarr is reachable and API key is correct
- qBittorrent Web UI is enabled and credentials are correct

### No Search Results

- Check Prowlarr has indexers configured
- Verify category filters match your indexers
- Try a manual search with simpler terms

### Downloads Not Starting

- Check qBittorrent connection
- Verify the download URL/magnet is valid
- Check qBittorrent logs for errors
- Try enabling Dry-Run mode to see what would be grabbed

## License

MIT

## Acknowledgments

Inspired by [Radarr](https://github.com/Radarr/Radarr), [Sonarr](https://github.com/Sonarr/Sonarr), and the *arr ecosystem.
