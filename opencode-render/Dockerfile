FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=10000

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global @opencode/cli@2.3.0

RUN mkdir -p /workspace
WORKDIR /workspace

EXPOSE 10000

CMD ["sh", "-c", "if [ -z \"$OPENCODE_SERVER_PASSWORD\" ]; then echo 'OPENCODE_SERVER_PASSWORD is required; configure it in Render environment variables.' >&2; exit 1; fi; exec opencode serve --hostname 0.0.0.0 --port ${PORT:-10000}"]
