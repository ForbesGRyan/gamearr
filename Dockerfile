# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

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

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 gamearr

# Copy compiled binary from builder
COPY --from=builder /app/gamearr /app/gamearr

# Create directories for volumes
RUN mkdir -p /config /library /downloads && \
    chown -R gamearr:gamearr /app /config /library /downloads

USER gamearr

# Environment variables
ENV PORT=7878
ENV DATA_PATH=/config

# Expose port
EXPOSE 7878

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7878/api/v1/system/status || exit 1

# Run the application
CMD ["/app/gamearr"]
