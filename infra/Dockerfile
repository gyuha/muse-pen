FROM node:22-bookworm-slim AS workspace
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/story-engine/package.json ./packages/story-engine/package.json
COPY packages/image-engine/package.json ./packages/image-engine/package.json
COPY tests/package.json ./tests/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig*.json ./
COPY packages ./packages
COPY apps/api ./apps/api

FROM workspace AS api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "./apps/api", "start"]

FROM workspace AS web-build
COPY apps/web ./apps/web
RUN pnpm --filter ./apps/web build

FROM caddy:2-alpine AS caddy
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv
