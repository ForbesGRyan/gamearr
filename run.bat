@echo off
REM Gamearr Startup Script for Windows

echo.
echo 🎮 Starting Gamearr...
echo.

REM Check if Bun is installed
where bun >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Bun is not installed!
    echo Install it from: https://bun.sh
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing backend dependencies...
    call bun install
)

REM Check if frontend node_modules exists
if not exist "src\web\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd src\web
    call bun install
    cd ..\..
)

REM Check if .env exists
if not exist ".env" (
    echo.
    echo ⚠️  No .env file found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo ⚠️  Please edit .env and add your IGDB credentials!
    echo Get credentials from: https://dev.twitch.tv/console/apps
    echo.
    echo Press any key after configuring .env to continue...
    pause >nul
)

REM Check if database exists
if not exist "data\gamearr.db" (
    echo 🗄️  Initializing database...
    call bun run db:push
)

echo.
echo 🚀 Starting servers in separate windows...
echo    Backend:  http://localhost:7878
echo    Frontend: http://localhost:3000
echo.
echo Close the terminal windows to stop the servers
echo.

REM Start backend in new window
start "Gamearr Backend" cmd /k "bun dev"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start frontend in new window
start "Gamearr Frontend" cmd /k "bun dev:web"

echo.
echo ✅ Servers started in separate windows
echo.
echo Press any key to exit this window (servers will keep running)
pause >nul
