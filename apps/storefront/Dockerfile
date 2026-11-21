# syntax=docker/dockerfile:1.7
# =============================================================================
#  Maghitech Storefront — Next.js (SSR/ISR) en mode "standalone"
#  Build depuis la racine du monorepo (pnpm + Turborepo) :
#    docker build -f apps/storefront/Dockerfile -t maghitech/storefront .
# =============================================================================
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# --- Stage 1 : ne garder que storefront + ses packages internes --------------
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2 prune @maghitech/storefront --docker

# --- Stage 2 : installation des dépendances (cache pnpm partagé) -------------
FROM base AS deps
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- Stage 3 : build Next.js --------------------------------------------------
FROM deps AS builder
COPY --from=pruner /repo/out/full/ .
# Les NEXT_PUBLIC_* sont injectées AU BUILD (inlinées dans le bundle client)
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPPLIER_FORM_ENDPOINT
ARG NEXT_PUBLIC_ORDER_FORM_ENDPOINT
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SUPPLIER_FORM_ENDPOINT=$NEXT_PUBLIC_SUPPLIER_FORM_ENDPOINT \
    NEXT_PUBLIC_ORDER_FORM_ENDPOINT=$NEXT_PUBLIC_ORDER_FORM_ENDPOINT \
    NODE_ENV=production
RUN pnpm turbo run build --filter=@maghitech/storefront

# --- Stage 4 : runtime minimal (pas de node_modules complet, pas de pnpm) -----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/storefront/public ./apps/storefront/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/storefront/server.js"]
