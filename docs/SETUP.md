# Gamearr Setup Guide

Complete guide to setting up Gamearr and its dependencies.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installing Dependencies](#installing-dependencies)
- [IGDB Setup](#igdb-setup)
- [Prowlarr Setup](#prowlarr-setup)
- [qBittorrent Setup](#qbittorrent-setup)
- [Steam Setup (Optional)](#steam-setup-optional)
- [GOG Setup (Optional)](#gog-setup-optional)
- [Gamearr Installation](#gamearr-installation)
- [Configuration](#configuration)
- [Verifying Setup](#verifying-setup)

---

## Prerequisites

Before installing Gamearr, you'll need:

| Software | Version | Purpose |
|----------|---------|---------|
| [Bun](https://bun.sh) | 1.0+ | JavaScript runtime |
| [Prowlarr](https://prowlarr.com/) | Any | Indexer management |
| [qBittorrent](https://www.qbittorrent.org/) | 4.1+ | Download client |
| IGDB Account | - | Game metadata |

---

## Installing Dependencies

### Bun (Required)

**Windows (PowerShell as Admin):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

Verify installation:
```bash
bun --version
```

### Prowlarr

**Windows:**
1. Download from [prowlarr.com](https://prowlarr.com/)
2. Run the installer
3. Access at `http://localhost:9696`

**Docker:**
```bash
docker run -d \
  --name prowlarr \
  -p 9696:9696 \
  -v /path/to/config:/config \
  linuxserver/prowlarr
```

### qBittorrent

**Windows/macOS:**
1. Download from [qbittorrent.org](https://www.qbittorrent.org/)
2. Install and launch
3. Enable Web UI (see below)

**Docker:**
```bash
docker run -d \
  --name qbittorrent \
  -p 8080:8080 \
  -v /path/to/downloads:/downloads \
  linuxserver/qbittorrent
```

---

## IGDB Setup

IGDB provides game metadata (titles, covers, release dates). You need free API credentials from Twitch.

### Step 1: Create Twitch Account

1. Go to [dev.twitch.tv](https://dev.twitch.tv/)
2. Log in or create a Twitch account
3. Enable Two-Factor Authentication (required)

### Step 2: Register Application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Click **Register Your Application**
3. Fill in:
   - **Name:** `Gamearr` (or anything unique)
   - **OAuth Redirect URLs:** `http://localhost`
   - **Category:** `Application Integration`
4. Click **Create**

### Step 3: Get Credentials

1. Click **Manage** on your new application
2. Copy the **Client ID**
3. Click **New Secret** and copy the **Client Secret**

> **Important:** Save these credentials securely. You'll need them for Gamearr settings.

---

## Prowlarr Setup

Prowlarr manages your torrent indexers and provides a unified search API.

### Step 1: Initial Setup

1. Open Prowlarr at `http://localhost:9696`
2. Complete the initial setup wizard
3. Set authentication (recommended)

### Step 2: Add Indexers

1. Go to **Indexers** > **Add Indexer**
2. Search for your preferred indexers
3. Configure each indexer with your credentials
4. Test the connection

**Recommended indexers for games:**
- 1337x
- RARBG (if available)
- FitGirl Repacks
- GOG Games

### Step 3: Get API Key

1. Go to **Settings** > **General**
2. Find **API Key** section
3. Copy the API key

### Step 4: Configure Categories (Optional)

Note the category IDs for game-related categories:
- `4000` - PC Games
- `4050` - Games (General)

---

## qBittorrent Setup

### Step 1: Enable Web UI

1. Open qBittorrent
2. Go to **Tools** > **Options** > **Web UI**
3. Check **Enable the Web User Interface**
4. Set:
   - **IP Address:** `*` (or `127.0.0.1` for local only)
   - **Port:** `8080` (default)
5. Set **Authentication:**
   - **Username:** Choose a username
   - **Password:** Choose a strong password
6. Click **Apply** and **OK**

### Step 2: Verify Web UI

1. Open `http://localhost:8080` in browser
2. Log in with your credentials
3. You should see the qBittorrent web interface

### Step 3: Create Category (Optional)

1. In qBittorrent, right-click in the left sidebar
2. Select **New Category**
3. Name it `gamearr`
4. Set the save path if desired

---

## Steam Setup (Optional)

Steam integration lets you import your existing Steam library into Gamearr.

### Step 1: Get Steam API Key

1. Go to [Steam Web API Key](https://steamcommunity.com/dev/apikey)
2. Log in with your Steam account
3. Enter a domain name (can be `localhost` for personal use)
4. Click **Register**
5. Copy your API key

### Step 2: Find Your Steam ID

Your Steam ID is the numeric ID for your account:

1. Go to your Steam profile page
2. The URL contains your ID: `steamcommunity.com/profiles/[YOUR_STEAM_ID]`
3. Or use a service like [SteamID.io](https://steamid.io/)
4. Copy the numeric Steam ID (e.g., `76561198012345678`)

> **Note:** If you have a custom URL, you'll need to convert it to the numeric ID.

---

## GOG Setup (Optional)

GOG integration uses OAuth to connect your GOG account.

### How It Works

1. In Gamearr settings, click **Connect to GOG**
2. A browser window opens to GOG's login page
3. Log in and authorize Gamearr
4. You're redirected back with the connection complete

No manual API keys needed - the OAuth flow handles authentication automatically.

### Privacy Note

GOG connection only grants read access to your library. Gamearr cannot:
- Make purchases
- Modify your account
- Access payment information

---

## Gamearr Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/gamearr.git
cd gamearr
```

### Step 2: Install Dependencies

```bash
# Install backend dependencies
bun install

# Install frontend dependencies
cd src/web && bun install && cd ../..
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` with your IGDB credentials:
```env
IGDB_CLIENT_ID=your_client_id_here
IGDB_CLIENT_SECRET=your_client_secret_here
```

### Step 4: Initialize Database

```bash
bun run db:push
```

### Step 5: Start Gamearr

**Development mode:**
```bash
bun run dev:all
```

**Production mode:**
```bash
bun run build
./gamearr
```

---

## Configuration

Open Gamearr at `http://localhost:3000` (development) or `http://localhost:7878` (production) and go to **Settings**.

### General Tab

| Setting | Description | Default |
|---------|-------------|---------|
| RSS Sync Interval | How often to check for new releases | 15 min |
| Search Interval | How often to search for wanted games | 15 min |
| Minimum Quality Score | Auto-grab threshold | 100 |
| Minimum Seeders | Required seeders for auto-grab | 5 |

### Libraries Tab

Configure your game storage locations:

| Setting | Description | Example |
|---------|-------------|---------|
| Library Path | Where games are stored | `C:\Games` or `/mnt/games` |
| Default | Mark as default for new downloads | Yes/No |

You can add multiple library paths for different drives or locations.

### Indexers Tab

| Setting | Value | Example |
|---------|-------|---------|
| Prowlarr URL | Your Prowlarr address | `http://localhost:9696` |
| Prowlarr API Key | From Prowlarr settings | `abc123...` |
| Categories | Select game categories | PC Games, Games |

Click **Test Connection** to verify.

### Downloads Tab

| Setting | Value | Example |
|---------|-------|---------|
| qBittorrent Host | Your qBittorrent address | `http://localhost:8080` |
| Username | Web UI username | `admin` |
| Password | Web UI password | `********` |
| Category | Download category | `gamearr` |
| Dry-Run Mode | Test without downloading | Off |

Click **Test Connection** to verify.

### Metadata Tab

**IGDB (Required):**

| Setting | Value | Example |
|---------|-------|---------|
| IGDB Client ID | From Twitch console | `abc123xyz` |
| IGDB Client Secret | From Twitch console | `secret123` |

**Steam (Optional):**

| Setting | Value | Example |
|---------|-------|---------|
| Steam API Key | From Steam | `ABC123...` |
| Steam ID | Your numeric ID | `76561198012345678` |

**GOG (Optional):**
- Click **Connect to GOG** to authenticate via OAuth

Click **Test Connection** for each service to verify.

### Updates Tab

| Setting | Description | Default |
|---------|-------------|---------|
| Enable Update Checking | Monitor for game updates | On |
| Check Schedule | How often to check | Daily |
| Default Policy | Action for new updates | Notify |

---

## Verifying Setup

### 1. Check System Health

Go to `http://localhost:3000` (development) or `http://localhost:7878` (production) and check the status indicator in the header.

All services should show green:
- **IGDB:** Connected
- **Prowlarr:** Connected
- **qBittorrent:** Connected
- **Steam:** Connected (if configured)
- **GOG:** Connected (if configured)

### 2. Test Search

1. Go to **Library**
2. Click **Add Game**
3. Search for a popular game (e.g., "Witcher 3")
4. Results should appear with cover art

### 3. Test Releases

1. Add a game to your library
2. Click on the game card
3. Click **Search Releases**
4. Releases should appear from your indexers

### 4. Test Download (Dry-Run)

1. Enable **Dry-Run Mode** in Settings > Downloads
2. Click **Grab** on a release
3. Check the logs - it should say "DRY-RUN: Would grab..."

### 5. Test Steam Import (Optional)

1. Go to **Library** > **Scan** tab
2. Click **Import from Steam**
3. Your Steam library should appear
4. Try importing a game

### 6. Test GOG Import (Optional)

1. Go to **Library** > **Scan** tab
2. Click **Import from GOG**
3. Your GOG library should appear
4. Try importing a game

---

## Troubleshooting

### "IGDB credentials not configured"

- Verify Client ID and Secret in Settings > Metadata
- Check for extra spaces in the credentials
- Ensure 2FA is enabled on your Twitch account

### "Prowlarr connection failed"

- Verify Prowlarr is running (`http://localhost:9696`)
- Check the API key is correct
- Ensure no firewall blocking the connection

### "qBittorrent authentication failed"

- Verify Web UI is enabled in qBittorrent
- Check username/password are correct
- Try accessing the Web UI directly in browser

### "No search results"

- Check Prowlarr has working indexers
- Verify category filters match your indexers
- Try searching in Prowlarr directly

### "Steam connection failed"

- Verify your Steam API key is valid
- Check your Steam ID is the numeric ID (not custom URL)
- Ensure your Steam profile is public (for library access)

### "GOG connection failed"

- Try disconnecting and reconnecting
- Clear browser cookies if OAuth popup fails
- Check if GOG services are available

### Database errors

```bash
# Reset database (Windows)
del data\gamearr.db
bun run db:push

# Reset database (macOS/Linux)
rm data/gamearr.db
bun run db:push
```

### Logs location

Gamearr logs are stored in `data/logs/`:
- `gamearr.log` - Current log file
- `gamearr.log.1.gz` - Previous day (compressed)
- Logs rotate daily with 30-day retention

---

## Next Steps

- Read the [User Guide](USER_GUIDE.md) for detailed usage instructions
- Check [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for roadmap
- See the main [README](../README.md) for API documentation
