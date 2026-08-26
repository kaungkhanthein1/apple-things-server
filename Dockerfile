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
RUN npm install --omit=dev
ENV NODE_ENV=production
EXPOSE 9000
CMD ["npm", "start"]
