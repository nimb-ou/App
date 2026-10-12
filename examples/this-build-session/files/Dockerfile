# Baton relay hub: the public HTTPS endpoint ChatGPT and Claude connectors call.
# docker build -t baton-relay . && docker run -p 8787:8787 -v baton-data:/data -e BATON_PUBLIC_URL=https://your.host baton-relay
FROM node:22-alpine
WORKDIR /app
COPY dist/baton.mjs ./baton.mjs
ENV PORT=8787 BATON_STORE=/data NODE_ENV=production
VOLUME ["/data"]
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "baton.mjs", "relay"]
