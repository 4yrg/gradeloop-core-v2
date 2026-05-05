# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1 AS dependencies

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock* ./

# Copy all package.json files from the monorepo to satisfy workspace dependencies
COPY apps/web/package.json ./apps/web/
COPY packages/ts/config/package.json ./packages/ts/config/
COPY packages/ts/dto/package.json ./packages/ts/dto/
COPY packages/ts/utils/package.json ./packages/ts/utils/

# Install dependencies (monorepo-wide)
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Stage 2: Development
# ============================================
FROM oven/bun:1 AS dev

WORKDIR /app

# Copy EVERYTHING from dependencies stage (including all node_modules and bins)
COPY --from=dependencies /app /app

# Copy source code
COPY . .

# Accept build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Ensure binaries are in PATH
ENV PATH /app/node_modules/.bin:$PATH

EXPOSE 3000

# Start the server in development mode
CMD ["bun", "--cwd", "apps/web", "dev"]

# ============================================
# Stage 3: Builder
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy EVERYTHING from dependencies stage (including all node_modules and bins)
COPY --from=dependencies /app /app

# Copy source code
COPY . .

# Accept build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NODE_ENV=production
# Ensure binaries are in PATH
ENV PATH /app/node_modules/.bin:$PATH

# Build the application
WORKDIR /app/apps/web
# Use 'bun x' to ensure we find the local 'next' binary
RUN bun x next build

# ============================================
# Stage 4: Production Runtime
# ============================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build output with correct ownership
# In monorepos, standalone output preserves the directory structure
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Ensure the bun user owns the files
RUN chown -R bun:bun /app

# Switch to non-root user
USER bun

EXPOSE 3000

# Start the server
# Based on monorepo structure, server.js should be in apps/web/server.js within the standalone output
CMD ["bun", "apps/web/server.js"]