#!/usr/bin/env pwsh
# Gamearr Startup Script for PowerShell

Write-Host "🎮 Starting Gamearr..." -ForegroundColor Cyan

# Check if Bun is installed
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Bun is not installed!" -ForegroundColor Red
    Write-Host "Install it from: https://bun.sh" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    bun install
}

# Check if frontend node_modules exists
if (-not (Test-Path "src/web/node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location src/web
    bun install
    Set-Location ../..
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  No .env file found!" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host ""
    Write-Host "⚠️  Please edit .env and add your IGDB credentials!" -ForegroundColor Red
    Write-Host "Get credentials from: https://dev.twitch.tv/console/apps" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Enter after configuring .env to continue..." -ForegroundColor Yellow
    Read-Host
}

# Check if database exists
if (-not (Test-Path "data/gamearr.db")) {
    Write-Host "🗄️  Initializing database..." -ForegroundColor Yellow
    bun run db:push
}

Write-Host ""
Write-Host "🚀 Starting servers..." -ForegroundColor Green
Write-Host "   Backend:  http://localhost:7878" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Yellow
Write-Host ""

# Start backend in background job
$backend = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    bun dev
}

# Start frontend in background job
$frontend = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    bun dev:web
}

# Function to cleanup on exit
function Cleanup {
    Write-Host ""
    Write-Host "🛑 Stopping servers..." -ForegroundColor Yellow
    Stop-Job $backend -ErrorAction SilentlyContinue
    Stop-Job $frontend -ErrorAction SilentlyContinue
    Remove-Job $backend -ErrorAction SilentlyContinue
    Remove-Job $frontend -ErrorAction SilentlyContinue
    Write-Host "✅ Servers stopped" -ForegroundColor Green
    exit
}

# Register cleanup on Ctrl+C
Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

try {
    # Stream output from both jobs
    while ($true) {
        Receive-Job $backend | ForEach-Object { Write-Host "[Backend]  $_" -ForegroundColor Blue }
        Receive-Job $frontend | ForEach-Object { Write-Host "[Frontend] $_" -ForegroundColor Magenta }

        # Check if jobs are still running
        if ($backend.State -ne "Running" -and $frontend.State -ne "Running") {
            Write-Host "❌ Both servers have stopped" -ForegroundColor Red
            break
        }

        Start-Sleep -Milliseconds 100
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    Cleanup
}
