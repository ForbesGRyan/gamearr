# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
# Node.js 22 LTS is installed because Bun's Node.js compatibility layer reports
# as Node 24, which causes node-gyp "Completion callback never invoked" failures.
# Having real Node.js in PATH ensures install scripts use a compatible runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    ca-certificates \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY src/web/package.json src/web/bun.lock ./src/web/

# Install dependencies
RUN bun install --frozen-lockfile
RUN cd src/web && bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend and compile binary
RUN bun run build

# Runtime stage - use Bun for running migrations
FROM oven/bun:1-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary and frontend assets from builder
COPY --from=builder /app/gamearr /app/gamearr
COPY --from=builder /app/dist /app/dist

# Copy migration files and dependencies
COPY --from=builder /app/src/server/db/migrations /app/migrations
COPY --from=builder /app/src/server/db/migrate.ts /app/migrate.ts
COPY --from=builder /app/node_modules/drizzle-orm /app/node_modules/drizzle-orm

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create directories for volumes
RUN mkdir -p /config /library /downloads && \
    chown -R bun:bun /app /config /library /downloads

USER bun

# Environment variables
ENV PORT=8484
ENV DATA_PATH=/config

# Expose port
EXPOSE 8484

# Health check (uses PORT env var)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8484}/api/v1/system/status || exit 1

# Run entrypoint (migrations + app)
ENTRYPOINT ["/app/docker-entrypoint.sh"]
