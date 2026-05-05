# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1 AS dependencies

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock* ./

# Copy all package.json files from the monorepo to satisfy workspace dependencies
# We use a trick to copy only package.json files while preserving directory structure
COPY apps/web/package.json ./apps/web/
COPY packages/ts/config/package.json ./packages/ts/config/
COPY packages/ts/dto/package.json ./packages/ts/dto/
COPY packages/ts/utils/package.json ./packages/ts/utils/

# Install dependencies (monorepo-wide)
# This will link the packages and install all required node_modules
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Accept build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NODE_ENV=production
ENV PATH /app/node_modules/.bin:$PATH

# Build the application
WORKDIR /app/apps/web
RUN bun run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PATH /app/node_modules/.bin:$PATH
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build output
# Next.js standalone puts the server.js in .next/standalone
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Switch to non-root user
USER bun

EXPOSE 3000

# Start the server
CMD ["bun", "apps/web/server.js"]