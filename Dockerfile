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

# app/display/page.tsx statically prerenders using a real Google Sheets
# fetch (getRooms()), so `next build` needs live GOOGLE_* credentials even
# though they're also supplied via env_file at container start. Passed as
# BuildKit secrets so they never land in an image layer or build cache.
RUN --mount=type=secret,id=google_sa_email \
    --mount=type=secret,id=google_private_key \
    --mount=type=secret,id=google_sheet_id \
    export GOOGLE_SERVICE_ACCOUNT_EMAIL="$(cat /run/secrets/google_sa_email)" && \
    export GOOGLE_PRIVATE_KEY="$(cat /run/secrets/google_private_key)" && \
    export GOOGLE_SHEET_ID="$(cat /run/secrets/google_sheet_id)" && \
    npm run build

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
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
