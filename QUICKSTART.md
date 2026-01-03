# Gamearr Quick Start

## TL;DR

```bash
# 1. Install dependencies
bun install
cd src/web && bun install && cd ../..

# 2. Setup IGDB credentials
cp .env.example .env
# Edit .env with your credentials from https://dev.twitch.tv/console/apps

# 3. Initialize database
bun run db:push

# 4. Run it!
```

### Windows PowerShell
```powershell
.\run.ps1
```

### Windows CMD
```cmd
run.bat
```

### macOS/Linux/WSL
```bash
chmod +x run.sh
./run.sh
```

### Or use the npm script
```bash
bun run dev:all
```

## What Each Script Does

### `run.ps1` (PowerShell)
- ✅ Checks if Bun is installed
- ✅ Auto-installs dependencies if missing
- ✅ Creates .env if missing
- ✅ Initializes database if needed
- ✅ Runs both servers in background jobs
- ✅ Graceful shutdown on Ctrl+C

### `run.bat` (Windows CMD)
- ✅ Checks if Bun is installed
- ✅ Auto-installs dependencies if missing
- ✅ Creates .env if missing
- ✅ Initializes database if needed
- ✅ Opens servers in **separate windows**
- Close the windows to stop servers

### `run.sh` (Bash)
- ✅ Checks if Bun is installed
- ✅ Auto-installs dependencies if missing
- ✅ Creates .env if missing
- ✅ Initializes database if needed
- ✅ Runs both servers in background
- ✅ Graceful shutdown on Ctrl+C

### `bun run dev:all`
- Uses `concurrently` package
- Runs both servers in same terminal
- Color-coded output (blue=backend, magenta=frontend)
- Ctrl+C stops both

## URLs

- **Frontend:** http://localhost:3000 (your main UI)
- **Backend API:** http://localhost:7878/api/v1
- **Database Studio:** `bun run db:studio` (visual DB browser)

## First Time Setup

1. **Get IGDB Credentials:**
   - Go to https://dev.twitch.tv/console/apps
   - Register application
   - Copy Client ID and Secret
   - Add to `.env` file

2. **Run any of the scripts above**

3. **Open http://localhost:3000**

4. **Search and add games!**

## Common Issues

**Port already in use:**
```bash
# Change PORT in .env
PORT=7879
```

**IGDB not configured:**
- Check `.env` file exists
- Verify credentials are correct
- Restart the server

**Database errors:**
```bash
# Reset database
rm -rf data/gamearr.db
bun run db:push
```

## Full Documentation

- **README.md** - Complete documentation
- **SETUP.md** - Detailed setup guide
- **PRODUCT_PLAN.md** - Development roadmap
