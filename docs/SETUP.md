# Gamearr Setup Guide

Complete guide to setting up Gamearr and its dependencies.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installing Dependencies](#installing-dependencies)
- [IGDB Setup](#igdb-setup)
- [Prowlarr Setup](#prowlarr-setup)
- [qBittorrent Setup](#qbittorrent-setup)
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

Open Gamearr at `http://localhost:3000` and go to **Settings**.

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

Click **Test Connection** to verify.

### Metadata Tab

| Setting | Value | Example |
|---------|-------|---------|
| IGDB Client ID | From Twitch console | `abc123xyz` |
| IGDB Client Secret | From Twitch console | `secret123` |

Click **Test Connection** to verify.

### General Tab

| Setting | Description |
|---------|-------------|
| Library Path | Where your games are stored |
| Dry-Run Mode | Test without downloading |

---

## Verifying Setup

### 1. Check System Health

Go to `http://localhost:3000` and click the status indicator in the header, or visit `/api/v1/system/health`.

All services should show green:
- **IGDB:** Connected
- **Prowlarr:** Connected
- **qBittorrent:** Connected

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

1. Enable **Dry-Run Mode** in Settings
2. Click **Grab** on a release
3. Check the logs - it should say "DRY-RUN: Would grab..."

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

### Database errors

```bash
# Reset database
rm data/gamearr.db
bun run db:push
```

---

## Next Steps

- Read the [User Guide](USER_GUIDE.md) for detailed usage instructions
- Check [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for roadmap
- See the main [README](../README.md) for API documentation
