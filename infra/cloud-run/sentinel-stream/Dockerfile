# sentinel-stream. Build context: repository root.
FROM node:22.23.3-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/stream ./apps/stream
COPY apps/core/package.json ./apps/core/package.json
COPY apps/simulator/package.json ./apps/simulator/package.json
COPY apps/ui/package.json ./apps/ui/package.json
RUN npm ci
RUN npm run build --workspace @sentinel/domain --workspace @sentinel/stream
RUN npm prune --omit=dev

FROM node:22.23.3-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /workspace/packages/domain/dist ./packages/domain/dist
COPY --from=build /workspace/apps/stream/package.json ./apps/stream/package.json
COPY --from=build /workspace/apps/stream/dist ./apps/stream/dist
USER node
EXPOSE 8080
CMD ["node", "apps/stream/dist/main.js"]
