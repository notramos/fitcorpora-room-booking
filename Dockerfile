# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

# ---- Dependencies -----------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build --------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_TEAMS_APP_ID_URI
ENV NEXT_PUBLIC_TEAMS_APP_ID_URI=$NEXT_PUBLIC_TEAMS_APP_ID_URI
ENV NEXT_TELEMETRY_DISABLED=1
# Small hosts (1-2 GB RAM) OOM in `next build`'s type-check phase at Node's
# auto-tuned heap limit; raise it and lean on swap.
ENV NODE_OPTIONS=--max-old-space-size=3072

# No database access needed at build time: the pages that read data
# (app/display/*, app/admin/*, dashboard) are all `dynamic = "force-dynamic"`
# or session-gated, so nothing is prerendered against Postgres.
RUN npm run build

# ---- Runtime ------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir -p /app/public/uploads/rooms \
  && chown -R nextjs:nodejs /app/public/uploads
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
