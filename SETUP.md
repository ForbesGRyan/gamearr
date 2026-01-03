# Gamearr Setup Guide

Quick setup guide to get Gamearr running on your system.

## Step 1: Install Bun

If you don't have Bun installed:

### Windows (PowerShell)
```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

### macOS/Linux
```bash
curl -fsSL https://bun.sh/install | bash
```

Restart your terminal after installation.

## Step 2: Install Dependencies

```bash
# Install backend dependencies
bun install

# Install frontend dependencies
cd src/web
bun install
cd ../..
```

## Step 3: Get IGDB API Credentials

1. Go to https://dev.twitch.tv/console/apps
2. Log in with your Twitch account (create one if needed)
3. Click "Register Your Application"
4. Fill in:
   - **Name:** Gamearr (or any name)
   - **OAuth Redirect URLs:** http://localhost
   - **Category:** Website Integration
5. Click "Create"
6. Copy your **Client ID** and **Client Secret**

## Step 4: Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
IGDB_CLIENT_ID=your_client_id_here
IGDB_CLIENT_SECRET=your_client_secret_here
PORT=7878
```

## Step 5: Initialize Database

```bash
bun run db:push
```

This creates the SQLite database and tables automatically.

## Step 6: Start the Application

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
bun dev
```
Server will start on http://localhost:7878

**Terminal 2 - Frontend:**
```bash
bun dev:web
```
Frontend will start on http://localhost:3000

## Step 7: Use Gamearr!

1. Open http://localhost:3000 in your browser
2. Click "Add Game"
3. Search for a game (try "Elden Ring")
4. Click "Add" to add it to your library
5. Your game appears in the library grid!

## Troubleshooting

### "bun: command not found"
- Restart your terminal after installing Bun
- Make sure Bun is in your PATH

### "IGDB is not configured"
- Check that your `.env` file exists
- Verify credentials are correct
- Restart the backend server after changing `.env`

### Database errors
- Delete `data/gamearr.db` and run `bun run db:push` again
- Make sure the `data` directory exists

### Port already in use
- Change PORT in `.env` to a different number (e.g., 7879)
- Make sure nothing else is running on port 7878 or 3000

## What's Working (Phase 2)

✅ Search IGDB for games
✅ Add games to library
✅ View library with cover art
✅ Monitor/unmonitor games
✅ Delete games
✅ Beautiful responsive UI

## Coming Soon

- Phase 3: Prowlarr integration for finding releases
- Phase 4: Download client (qBittorrent)
- Phase 5: Automatic file organization
- Phase 6: RSS monitoring & automation
- Phase 7: Settings UI

## Need Help?

Check the main README.md or open an issue on GitHub.
