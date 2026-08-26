FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS build
WORKDIR /app
COPY .npmrc .yarnrc.yml package-lock.json package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS production
WORKDIR /app/.medusa/server
COPY --from=build /app/.medusa/server ./
COPY --from=build /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 9000
CMD ["node", "node_modules/.bin/medusa", "start"]
