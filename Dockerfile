# Sequences for Slack — Railway image.
# Ships Chromium + FFmpeg for HyperFrames rendering and runs the TypeScript
# source directly with tsx (the app has no emitted JS build artifact).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Never download a bundled Chromium during install — the image already has one,
# and puppeteer-core does not need it. Belt-and-suspenders against any dep that
# would try (e.g. a transitive full puppeteer).
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --chown=node:node . .

# Install the whole workspace from the committed lockfile. There is no compile
# step: the slack app runs `.ts` directly via tsx, and typecheck stays in CI.
RUN npm ci

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PRODUCER_LOW_MEMORY_MODE=true \
    SLACK_SEQUENCES_DATA_DIR=/data

# Persistent volume for projects, renders, encrypted user tokens, and the job map.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node

# Railway injects PORT; the HTTP server (health + OAuth) binds it on 0.0.0.0.
CMD ["npm", "run", "start", "-w", "@sequences/slack"]
