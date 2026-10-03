# Build context is the repository root; the Railway service config points build.dockerfilePath here.
FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter @voice-intake/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @voice-intake/api build

FROM base AS runtime
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter @voice-intake/api...
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/drizzle apps/api/drizzle
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
