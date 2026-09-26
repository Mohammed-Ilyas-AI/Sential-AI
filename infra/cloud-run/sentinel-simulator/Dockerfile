# sentinel-simulator (Cloud Run Job). Build context: repository root.
FROM node:22.23.3-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/simulator ./apps/simulator
COPY apps/core/package.json ./apps/core/package.json
COPY apps/stream/package.json ./apps/stream/package.json
COPY apps/ui/package.json ./apps/ui/package.json
RUN npm ci
RUN npm run build --workspace @sentinel/domain --workspace @sentinel/scenarios --workspace @sentinel/simulator
RUN npm prune --omit=dev

FROM node:22.23.3-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /workspace/packages/domain/dist ./packages/domain/dist
COPY --from=build /workspace/packages/scenarios/package.json ./packages/scenarios/package.json
COPY --from=build /workspace/packages/scenarios/dist ./packages/scenarios/dist
COPY --from=build /workspace/apps/simulator/package.json ./apps/simulator/package.json
COPY --from=build /workspace/apps/simulator/dist ./apps/simulator/dist
USER node
CMD ["node", "apps/simulator/dist/main.js"]
