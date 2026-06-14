# syntax=docker/dockerfile:1
# Build locally with `npm run build`, then package dist/ for production preview.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
COPY package.json package-lock.json vite.config.ts tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY dist ./dist
COPY src ./src
EXPOSE 8080
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "8080"]
