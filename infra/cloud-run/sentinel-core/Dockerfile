# sentinel-core. Build context: repository root.
FROM node:22.23.3-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/core ./apps/core
COPY apps/stream/package.json ./apps/stream/package.json
COPY apps/simulator/package.json ./apps/simulator/package.json
COPY apps/ui/package.json ./apps/ui/package.json
RUN npm ci
RUN npm run build --workspace @sentinel/domain --workspace @sentinel/rules --workspace @sentinel/core
RUN npm prune --omit=dev

FROM node:22.23.3-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /workspace/packages/domain/dist ./packages/domain/dist
COPY --from=build /workspace/packages/rules/package.json ./packages/rules/package.json
COPY --from=build /workspace/packages/rules/dist ./packages/rules/dist
COPY --from=build /workspace/apps/core/package.json ./apps/core/package.json
COPY --from=build /workspace/apps/core/dist ./apps/core/dist
USER node
EXPOSE 8080
CMD ["node", "apps/core/dist/main.js"]
