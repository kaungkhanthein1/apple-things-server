FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS build
COPY .npmrc .yarnrc.yml package-lock.json package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod=false
COPY . .
RUN pnpm build
RUN pnpm install --frozen-lockfile --prod

EXPOSE 9000
CMD ["pnpm", "start"]
