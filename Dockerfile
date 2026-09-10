# Build UI and server with the locked dependency tree.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --legacy-peer-deps
COPY tsconfig.json ./
COPY server ./server
COPY web/ui ./web/ui
RUN npm test && npm run build

# Install only production dependencies, using the same lockfile.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    FEED_DATA_DIR=/data
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/ui/dist ./web/ui/dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.FEED_HTTP_PORT||8080)+'/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
