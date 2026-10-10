FROM node:22-bookworm-slim AS node-runtime
FROM python:3.12-slim-bookworm AS runtime
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libstdc++6 ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential
COPY package.json package-lock.json ./
COPY README.md THIRD_PARTY_NOTICES.md ./
RUN npm ci
# Explicit copies keep developer .env, .venv, ledgers and caches out of the image.
COPY server.mjs next.config.mjs next-env.d.ts tsconfig.json postcss.config.mjs tailwind.config.ts ./
COPY src ./src
COPY public ./public
COPY server ./server
ENV NEXT_TELEMETRY_DISABLED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ASTROLOGY_PYTHON=/usr/local/bin/python3.12 \
    KERYKEION_BACKEND=swisseph
RUN python server/kerykeion_worker.py --self-test > /dev/null && npm run build
RUN groupadd --system aeon && useradd --system --gid aeon --home-dir /app aeon \
    && chown -R aeon:aeon /app/.next
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/sensuslab/myAeon"
USER aeon
EXPOSE 3000
CMD ["node", "server.mjs"]
