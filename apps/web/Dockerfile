# =============================================================================
# Next.js + Bun Production Dockerfile
# Optimized for monorepos
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — Dependencies
# -----------------------------------------------------------------------------
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock* ./

# Copy workspace package files
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies (this will install for workspace too)
RUN bun install --frozen-lockfile

# Also install in the web directory to ensure binaries are available
WORKDIR /app/apps/web
RUN bun install --frozen-lockfile


# -----------------------------------------------------------------------------
# Stage 2 — Builder
# -----------------------------------------------------------------------------
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy installed dependencies from both locations
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy project files
COPY . .

# Accept build arguments for public env vars
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_IAM_SERVICE_URL=http://localhost:8000/api/v1

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_IAM_SERVICE_URL=$NEXT_PUBLIC_IAM_SERVICE_URL

WORKDIR /app/apps/web

# Build Next.js app
RUN bun run build


# -----------------------------------------------------------------------------
# Stage 3 — Production Runtime
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user (Alpine compatible)
RUN addgroup -S bunjs && adduser -S nextjs -G bunjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:bunjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:bunjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:bunjs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# Start Next.js server using standalone build
CMD ["node", "apps/web/server.js"]