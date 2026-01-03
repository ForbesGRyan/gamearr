#!/bin/bash
# Gamearr Startup Script for Unix-like systems (macOS, Linux, WSL)

set -e

echo ""
echo "🎮 Starting Gamearr..."
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed!"
    echo "Install it from: https://bun.sh"
    echo ""
    echo "Run: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    bun install
fi

# Check if frontend node_modules exists
if [ ! -d "src/web/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd src/web
    bun install
    cd ../..
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  No .env file found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env and add your IGDB credentials!"
    echo "Get credentials from: https://dev.twitch.tv/console/apps"
    echo ""
    echo "Press Enter after configuring .env to continue..."
    read
fi

# Check if database exists
if [ ! -f "data/gamearr.db" ]; then
    echo "🗄️  Initializing database..."
    bun run db:push
fi

echo ""
echo "🚀 Starting servers..."
echo "   Backend:  http://localhost:7878"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup INT TERM

# Start backend in background
bun dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend in background
bun dev:web &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
