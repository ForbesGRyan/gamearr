# Gamearr User Guide

Complete guide to using Gamearr for managing your game library.

## Table of Contents

- [Overview](#overview)
- [Navigation](#navigation)
- [Library Management](#library-management)
- [Game Details](#game-details)
- [Searching and Downloading](#searching-and-downloading)
- [Library Import](#library-import)
- [Steam and GOG Integration](#steam-and-gog-integration)
- [Library Health](#library-health)
- [Activity Monitoring](#activity-monitoring)
- [Discover New Games](#discover-new-games)
- [Game Updates](#game-updates)
- [Settings](#settings)
- [Automation](#automation)
- [Tips and Best Practices](#tips-and-best-practices)

---

## Overview

Gamearr is an automated game library manager inspired by Radarr and Sonarr. It helps you:

- **Track** games you want to download
- **Search** multiple torrent indexers automatically
- **Download** games via qBittorrent
- **Organize** your existing game library
- **Monitor** for updates and better releases

---

## Navigation

The main navigation bar provides access to all features:

| Page | Description |
|------|-------------|
| **Library** | Your game collection - add, manage, and organize games |
| **Activity** | Monitor active and completed downloads |
| **Discover** | Find trending and popular games |
| **Updates** | View available updates for downloaded games |
| **Search** | Quick search for games and releases |
| **Settings** | Configure integrations and preferences |

The header shows:
- **Status Indicator** - Green when all services connected, yellow/red for issues
- **Add Game** button - Quick access to add new games

---

## Library Management

### View Modes

Switch between three view modes using the buttons in the toolbar:

1. **Posters** - Grid of game covers (default)
2. **Table** - Compact list with sortable columns
3. **Overview** - Detailed cards with full information

### Filtering and Sorting

**Filter by:**
- Status (All, Wanted, Downloading, Downloaded)
- Monitored (All, Monitored, Unmonitored)
- Genre
- Game Mode (Single Player, Multiplayer, Co-op)

**Sort by:**
- Title (A-Z or Z-A)
- Year
- Rating
- Status

### Adding Games

1. Click **Add Game** in the header or library toolbar
2. Search for a game by name
3. Browse results - each shows:
   - Cover art
   - Title and year
   - Platforms
   - Rating
   - Summary
4. Click **Add to Library**
5. Optionally select a digital store if you own it

### Managing Games

**From the game card:**
- **Eye icon** - Toggle monitoring (watched for new releases)
- **Pencil icon** - Edit game details
- **Magnifying glass** - Search for releases
- **Trash icon** - Remove from library

**Bulk Actions:**
1. Click the checkbox on game cards to select multiple
2. Use the bulk action toolbar that appears:
   - Monitor All
   - Unmonitor All
   - Delete Selected

### Game Statuses

| Status | Meaning |
|--------|---------|
| **Wanted** | Looking for releases to download |
| **Downloading** | Currently downloading |
| **Downloaded** | In your library, complete |

---

## Game Details

Click on any game to view its detailed information page.

### Tabs

| Tab | Description |
|-----|-------------|
| **Info** | Overview with cover art, summary, and quick actions |
| **Metadata** | Full game metadata (platforms, genres, themes, ratings) |
| **Releases** | Available torrent releases for the game |
| **Updates** | Available updates, DLC, and better quality releases |
| **History** | Download history and completed releases |
| **Events** | Audit log of all actions taken on this game |

### Quick Actions

From the game detail page:
- **Search Releases** - Find available torrents
- **Toggle Monitoring** - Enable/disable automatic searching
- **Edit** - Modify game information
- **Delete** - Remove from library

### Event Log

The Events tab tracks all activity:
- Game added to library
- Downloads started and completed
- Status changes
- Metadata updates
- Manual actions

---

## Searching and Downloading

### Manual Search

1. Click on a game card or the search icon
2. Click **Search Releases**
3. Review available releases

**Release Information:**
- **Title** - Release name (often includes quality info)
- **Indexer** - Source indexer
- **Size** - Download size
- **Seeders** - Number of seeders (higher = faster)
- **Quality Score** - Gamearr's rating of the release

**Quality Indicators:**
- 🟢 **GOG** - DRM-free, highest quality
- 🔵 **DRM-Free** - No DRM protection
- 🟡 **Repack** - Compressed, saves bandwidth
- ⚪ **Scene** - Standard scene release

### Grabbing Releases

1. Find a release you want
2. Check the quality score and seeders
3. Click **Grab**
4. The download starts in qBittorrent
5. Game status changes to "Downloading"

### Quality Scoring

Releases are automatically scored:

| Factor | Points |
|--------|--------|
| Title matches game | +50 |
| Year matches | +20 |
| GOG release | +50 |
| DRM-Free | +40 |
| Repack | +20 |
| Scene release | +10 |
| 20+ seeders | +10 |
| <5 seeders | -30 |
| >2 years old | -20 |
| Suspicious size | -50 |

**Recommended:** Look for scores of 100+ with 5+ seeders.

---

## Library Import

Import your existing game folders into Gamearr.

### Scanning Your Library

1. Go to **Library** > **Import** tab
2. Click **Refresh Scan**
3. Wait for the scan to complete

Gamearr parses folder names to extract:
- Game title
- Year (from `Title (Year)` format)
- Version numbers

### Matching Folders

**Auto Match:**
1. Click **Auto Match** on an unmatched folder
2. Gamearr searches IGDB and suggests a match
3. Review the suggestion
4. Click **Confirm** if correct, or **Edit** to search manually

**Manual Match:**
1. Click **Match** on an unmatched folder
2. Search for the correct game
3. Select from results
4. Click **Match**

### Ignoring Folders

For folders that aren't games:
1. Click the **X** icon on the folder
2. The folder is hidden from the import list
3. Use **Show Ignored** to manage ignored folders

---

## Steam and GOG Integration

Import games from your existing digital libraries.

### Steam Import

1. Configure Steam in **Settings > Metadata**:
   - Enter your Steam API Key
   - Enter your Steam ID (numeric ID)
   - Click **Test Connection**
2. Go to **Library** > **Scan** tab
3. Click **Import from Steam**
4. Filter options:
   - **Minimum playtime** - Filter by hours played
   - **Search** - Filter by game name
5. Select games to import (checkboxes)
6. Click **Import Selected**

Imported games are marked with their Steam ownership and automatically matched to IGDB metadata.

### GOG Import

1. Configure GOG in **Settings > Metadata**:
   - Click **Connect to GOG**
   - Authenticate with your GOG account in the popup
   - Connection status shows when linked
2. Go to **Library** > **Scan** tab
3. Click **Import from GOG**
4. Select games to import
5. Click **Import Selected**

GOG games are marked as DRM-free and linked to your GOG library.

### Multi-Store Ownership

When adding games, you can select multiple stores where you own the game:
- Steam
- GOG
- Epic
- Other

This helps track which games you already own across platforms.

---

## Library Health

The Health tab helps maintain a clean library.

### Duplicate Detection

Finds games with similar names (>80% match).

**For each duplicate pair:**
- Compare titles, years, and folder sizes
- Decide which to keep
- Click **Delete** on the duplicate
- Click **Dismiss** if it's a false positive

### Loose Files

Detects unorganized archive files (.iso, .rar, .zip, etc.) in your library root.

**To organize:**
1. Find the loose file
2. Click **Organize**
3. Gamearr creates a folder and moves the file
4. The folder appears in Import tab for matching

---

## Activity Monitoring

Track your downloads in real-time.

### Active Downloads

Shows currently downloading games:
- **Progress bar** - Download percentage
- **Speed** - Current download speed
- **ETA** - Estimated time remaining
- **Status** - Downloading, Stalled, etc.

**Actions:**
- **Pause** - Pause the download
- **Resume** - Resume paused download
- **Delete** - Cancel and remove

### History

View completed downloads with:
- Game name
- Completion date
- Final size
- Source indexer

---

## Discover New Games

Find new games to add to your library.

### Trending Games

Browse games by popularity:
- **Most Popular** - All-time popular games
- **Most Hyped** - Upcoming anticipated releases
- **Top Rated** - Highest user ratings
- **Recently Released** - New releases

### Filtering

Filter by:
- Genre (Action, RPG, Adventure, etc.)
- Theme (Sci-Fi, Fantasy, Horror, etc.)
- Multiplayer options

### Torrent Search

Search indexers directly:
- Enter a search term
- Set maximum age
- Browse results
- Grab directly or add game first

---

## Game Updates

Monitor your downloaded games for updates.

### Update Types

| Type | Description |
|------|-------------|
| **Version** | New game version available |
| **DLC** | New DLC or expansion |
| **Better Quality** | Higher quality release found |

### Managing Updates

1. Go to **Updates** page
2. Filter by type if desired
3. For each update:
   - **Grab** - Download the update
   - **Dismiss** - Hide this update

### Update Policies

Set per-game update behavior:
- **Notify** - Show in Updates page (default)
- **Auto** - Automatically download
- **Ignore** - Don't check for updates

---

## Settings

Access settings via the gear icon in the navigation bar. Settings are organized into six tabs.

### General Tab

**Automation Settings:**
- RSS Sync Interval (5-1440 minutes, default: 15)
- Search Scheduler Interval (5-1440 minutes, default: 15)
- Minimum Quality Score for auto-grab (0-500, default: 100)
- Minimum Seeders for auto-grab (0-100, default: 5)

### Libraries Tab

**Multi-Library Support:**
Configure multiple library paths for game storage:
- Add new library paths
- Set default library for downloads
- Remove unused libraries

Each library can have its own organization settings.

### Indexers Tab

**Prowlarr Configuration:**
- Prowlarr URL (e.g., `http://localhost:9696`)
- Prowlarr API Key
- Category Selection - Choose which indexer categories to search
- Test Connection button

### Downloads Tab

**qBittorrent Configuration:**
- Host URL (e.g., `http://localhost:8080`)
- Username and Password
- Download Category (filters which torrents Gamearr manages)
- Dry-Run Mode - Test configuration without starting downloads
- Test Connection button

### Metadata Tab

**IGDB Configuration (Required):**
- Client ID (from Twitch Developer Console)
- Client Secret
- Test Connection button

**Steam Configuration (Optional):**
- Steam API Key
- Steam ID (numeric)
- Test Connection button

**GOG Configuration (Optional):**
- Connect to GOG button (OAuth login)
- Connection status display
- Disconnect option

### Updates Tab

**Update Checking:**
- Enable/disable update checking
- Check schedule (Hourly, Daily, Weekly)
- Default update policy:
  - **Notify** - Show in Updates page (default)
  - **Auto** - Automatically download updates
  - **Ignore** - Don't check for updates

---

## Automation

Gamearr runs background jobs automatically. All intervals and thresholds are configurable in Settings.

### Background Jobs

| Job | Interval | Description |
|-----|----------|-------------|
| **RSS Sync** | 15 min (configurable) | Fetches latest releases from indexers |
| **Search Scheduler** | 15 min (configurable) | Actively searches for wanted games |
| **Download Monitor** | 30 seconds | Syncs download progress from qBittorrent |
| **Update Checker** | Hourly/Daily/Weekly | Monitors for game updates |
| **Metadata Refresh** | 5 minutes | Backfills missing game metadata |
| **Log Rotation** | Daily | Rotates and compresses old logs |

### RSS Sync

- Fetches latest releases from indexers
- Matches against wanted games
- Auto-grabs qualifying releases
- **Default interval:** 15 minutes (configurable: 5-1440 min)

### Search Scheduler

- Searches for all wanted games
- Finds new releases
- Auto-grabs based on quality score
- **Default interval:** 15 minutes (configurable: 5-1440 min)

### Auto-Grab Criteria

A release is automatically grabbed when:
- Quality score >= configured minimum (default: 100, configurable: 0-500)
- Seeders >= configured minimum (default: 5, configurable: 0-100)
- Game is monitored
- Game status is "Wanted"

### Configuring Automation

Go to **Settings > General** to adjust:

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| RSS Sync Interval | 15 min | 5-1440 min | How often to fetch RSS releases |
| Search Interval | 15 min | 5-1440 min | How often to search for wanted games |
| Minimum Quality Score | 100 | 0-500 | Threshold for auto-downloads |
| Minimum Seeders | 5 | 0-100 | Required seeders for auto-downloads |

**Tips:**
- Lower the minimum score to auto-grab more releases (riskier)
- Raise the minimum seeders for more reliable downloads
- Increase intervals if you have limited API calls

### Update Checker

Configure in **Settings > Updates**:
- **Schedule:** Hourly, Daily, or Weekly
- **Default Policy:** Notify, Auto, or Ignore
- Checks for new versions, DLC, and better quality releases

### Download Monitor

- Runs every 30 seconds
- Syncs download progress from qBittorrent
- Updates game/release status when complete
- Moves to "Downloaded" when finished

### Metadata Refresh

- Runs every 5 minutes
- Automatically fills in missing game metadata
- Fetches cover art and details from IGDB

### Logging

Gamearr maintains comprehensive logs:
- Stored in `data/logs/` directory
- Automatic daily rotation
- 30-day retention with compression
- Useful for troubleshooting

---

## Tips and Best Practices

### Getting Good Results

1. **Use specific game titles** - "The Witcher 3" not just "Witcher"
2. **Check categories** - Ensure Prowlarr categories match your indexers
3. **Prefer GOG/DRM-Free** - Higher quality scores for a reason
4. **Check seeders** - More seeders = faster, more reliable downloads

### Organizing Your Library

1. **Use consistent naming** - `Game Title (Year)` format
2. **One game per folder** - Easier to manage
3. **Run Health checks** - Find and fix duplicates
4. **Organize loose files** - Keep library clean

### Optimizing Automation

1. **Monitor only wanted games** - Reduces noise
2. **Set update policies** - Auto for favorites, ignore for completed
3. **Use Dry-Run first** - Test configuration before real downloads
4. **Check Activity regularly** - Ensure downloads complete

### Troubleshooting Downloads

1. **Stalled downloads** - Check seeders, try different release
2. **Slow speeds** - Normal for older releases, be patient
3. **Failed downloads** - Check qBittorrent logs, try manual grab
4. **Wrong content** - Use quality scoring, prefer trusted indexers

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `Esc` | Close modal |
| `Enter` | Confirm action |

---

## Getting Help

- Check [SETUP.md](SETUP.md) for installation issues
- Review [README](../README.md) for API documentation
- Check system health at Settings or `/api/v1/system/health`
