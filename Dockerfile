FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS build
COPY .npmrc .yarnrc.yml package-lock.json package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN NODE_ENV=production pnpm build

ENV NODE_ENV=production
EXPOSE 9000
CMD ["pnpm", "start"]
