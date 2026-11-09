# The terminal emulator: one image, UI included. Built and run on its own -
# the platform's docker-compose.yml knows nothing about it.

# ── ui ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS ui
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/tsconfig.json ui/vite.config.ts ui/index.html ./
COPY ui/src ./src
RUN npm run build

# ── server ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json server/nest-cli.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

# ── runtime ────────────────────────────────────────────────────────────────
# Node 24: node:sqlite is built in, so there is no native module to compile.
FROM node:24-alpine AS runtime
WORKDIR /app
# MQTT_URL / MQTT_ROOT_TOPIC default to the platform's own defaults (the
# Mosquitto on this machine), so the container works with no .env at all on
# the same server as the platform; an env file overrides them.
ENV NODE_ENV=production \
    EMULATOR_PORT=8095 \
    EMULATOR_DB_PATH=/app/data/emulator.db \
    EMULATOR_PUBLIC_DIR=/app/public \
    MQTT_URL=mqtt://host.docker.internal \
    MQTT_ROOT_TOPIC=Pay

RUN apk add --no-cache dumb-init curl \
  && addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/data && chown app:app /app/data

COPY --from=server --chown=app:app /app/node_modules ./node_modules
COPY --from=server --chown=app:app /app/dist ./dist
COPY --chown=app:app server/package.json ./
COPY --from=ui --chown=app:app /ui/dist ./public

USER app
EXPOSE 8095
VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8095/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
