#!/bin/sh
set -e

echo "Running database migrations..."
bun /app/migrate.ts

echo "Starting Gamearr..."
exec /app/gamearr
